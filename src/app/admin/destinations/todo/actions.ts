'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { interestTodos, INTEREST_TODO_STATUSES } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { SLIDERS } from '@/lib/scoring/constants';
import { SITE_TODO_KEY, nextDueOn, todayIso } from '@/lib/admin/todo-dates';
import type { SiteTodoRow } from '@/lib/db/queries/site-todos';

/** Server actions behind the To do tab. Each one re-checks the admin session and writes through withAdminAudit. */

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

const input = z.object({
  interestKey: z.string().refine((k) => k === SITE_TODO_KEY || SLIDERS.some((s) => s.key === k), 'Unknown scope'),
  title: z.string().trim().min(1, 'Give the item a title').max(200),
  detail: z.string().trim().max(2000),
  status: z.enum(INTEREST_TODO_STATUSES),
  source: z.string().trim().max(200),
  priority: z.number().int().min(1).max(3),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a real date').refine((s) => !Number.isNaN(Date.parse(s)), 'Not a real date').nullable(),
  repeatEvery: z.enum(['weekly', 'monthly']).nullable(),
});
export type SiteTodoInput = z.input<typeof input>;

function toRow(r: typeof interestTodos.$inferSelect): SiteTodoRow {
  return { id: r.id, interestKey: r.interestKey, title: r.title, detail: r.detail, status: r.status, source: r.source, placeId: r.placeId, closeOnApply: r.closeOnApply, priority: r.priority, dueOn: r.dueOn, repeatEvery: r.repeatEvery, createdAt: r.createdAt.toISOString(), doneAt: r.doneAt ? r.doneAt.toISOString() : null };
}

export async function addSiteTodo(raw: SiteTodoInput): Promise<Result<{ todos: SiteTodoRow[] }>> {
  const admin = await requireAdminUser();
  const p = input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid item');
  const values = { ...p.data, doneAt: p.data.status === 'done' ? new Date() : null };
  const [row] = await withAdminAudit<Array<typeof interestTodos.$inferSelect>>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${p.data.interestKey}:new`, action: 'create', before: null, after: values,
    write: (tx) => tx.insert(interestTodos).values(values).returning(),
  });
  return { ok: true, todos: [toRow(row)] };
}

/**
 * Change an item. Marking a repeating item done also creates its next copy (same text, "Needs you", next date)
 * in the same step, and the finished one stops repeating, so ticking it twice cannot create two.
 * Returns every row that changed or appeared.
 */
export async function updateSiteTodo(id: string, raw: SiteTodoInput): Promise<Result<{ todos: SiteTodoRow[] }>> {
  const admin = await requireAdminUser();
  const p = input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid item');
  const [before] = await db.select().from(interestTodos).where(eq(interestTodos.id, id));
  if (!before) return fail('Item not found');
  const finishing = before.status !== 'done' && p.data.status === 'done';
  const repeat = p.data.repeatEvery;
  const spawn = finishing && repeat ? { interestKey: p.data.interestKey, title: p.data.title, detail: p.data.detail, status: 'needs_you' as const, source: p.data.source, priority: p.data.priority, dueOn: nextDueOn(p.data.dueOn, repeat, todayIso()), repeatEvery: repeat, placeId: before.placeId, closeOnApply: false } : null;
  const doneAt = p.data.status === 'done' ? before.doneAt ?? new Date() : null;
  const set = { ...p.data, repeatEvery: spawn ? null : p.data.repeatEvery, doneAt, updatedAt: new Date() };
  const out = await withAdminAudit<Array<typeof interestTodos.$inferSelect>>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_todo', entityId: id, action: 'update', before, after: { ...before, ...set },
    write: async (tx) => {
      const [updated] = await tx.update(interestTodos).set(set).where(eq(interestTodos.id, id)).returning();
      if (!spawn) return [updated];
      const [created] = await tx.insert(interestTodos).values(spawn).returning();
      return [updated, created];
    },
  });
  return { ok: true, todos: out.map(toRow) };
}

export async function deleteSiteTodo(id: string): Promise<Result<object>> {
  const admin = await requireAdminUser();
  const [before] = await db.select().from(interestTodos).where(eq(interestTodos.id, id));
  if (!before) return fail('Item not found');
  await withAdminAudit({ actor: admin, skipPlaceCache: true, entityType: 'interest_todo', entityId: id, action: 'delete', before, after: null, write: (tx) => tx.delete(interestTodos).where(eq(interestTodos.id, id)) });
  return { ok: true };
}
