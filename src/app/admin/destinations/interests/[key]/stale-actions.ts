'use server';

import { z } from 'zod';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { interestStaleChecks, interestStaleFactors, interestStaleOptOuts, interestTodos, STALE_CATEGORIES, STALE_CHECKERS, STALE_RESULTS, STALE_SITE_KEY } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { SLIDERS } from '@/lib/scoring/constants';
import { CADENCE_TODO_SOURCE } from '@/lib/scoring/planning';
import { getStaleFactors } from '@/lib/db/queries/stale-factors';
import type { StaleFactorRow } from '@/lib/admin/stale-checks';

/** Server actions behind the Staleness checks card and the review checklist. Each re-checks the admin session and writes through withAdminAudit. */
type Result<T> = ({ ok: true } & T) | { ok: false; message: string };
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
/** The site-wide reasons live under the key '_site'; every other key must be a real interest. */
const validInterest = (k: string) => k === STALE_SITE_KEY || SLIDERS.some((s) => s.key === k);

const factorInput = z.object({
  category: z.enum(STALE_CATEGORIES),
  statement: z.string().trim().min(3, 'Write the reason').max(600),
  howToCheck: z.string().trim().max(800),
  checker: z.enum(STALE_CHECKERS),
  checkEvery: z.enum(['weekly', 'monthly', 'quarterly', 'annually']).nullable(),
});
export type StaleFactorInput = z.input<typeof factorInput>;

export interface ReviewRound { id: string; dueOn: string | null }
/** The reasons for an interest with the results recorded against its open review to-do (or the one named by todoId). */
export async function loadChecklist(interestKey: string, todoId?: string | null): Promise<Result<{ factors: StaleFactorRow[]; round: ReviewRound | null }>> {
  await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  let round: ReviewRound | null = null;
  if (interestKey === STALE_SITE_KEY) return { ok: true, factors: await getStaleFactors(interestKey, null), round };
  const todos = await db.select().from(interestTodos).where(and(eq(interestTodos.interestKey, interestKey), eq(interestTodos.source, CADENCE_TODO_SOURCE), ne(interestTodos.status, 'done'))).orderBy(asc(interestTodos.dueOn));
  const chosen = todoId ? todos.find((t) => t.id === todoId) : todos[0];
  if (chosen) round = { id: chosen.id, dueOn: chosen.dueOn };
  return { ok: true, factors: await getStaleFactors(interestKey, round?.id ?? null), round };
}

export async function addFactor(interestKey: string, input: StaleFactorInput, todoId: string | null): Promise<Result<{ factors: StaleFactorRow[] }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = factorInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid reason');
  const existing = await db.select({ n: interestStaleFactors.sortOrder }).from(interestStaleFactors).where(eq(interestStaleFactors.interestKey, interestKey));
  const values = { ...p.data, interestKey, sortOrder: existing.reduce((m, r) => Math.max(m, r.n), -1) + 1 };
  await withAdminAudit({ actor: admin, skipPlaceCache: true, entityType: 'interest_stale_factor', entityId: `${interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestStaleFactors).values(values).returning() });
  return { ok: true, factors: await getStaleFactors(interestKey, todoId) };
}

export async function updateFactor(id: string, input: StaleFactorInput, todoId: string | null): Promise<Result<{ factors: StaleFactorRow[] }>> {
  const admin = await requireAdminUser();
  const p = factorInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid reason');
  const [before] = await db.select().from(interestStaleFactors).where(eq(interestStaleFactors.id, id));
  if (!before) return fail('Reason not found');
  await withAdminAudit({ actor: admin, skipPlaceCache: true, entityType: 'interest_stale_factor', entityId: id, action: 'update', before, after: { ...before, ...p.data }, write: (tx) => tx.update(interestStaleFactors).set({ ...p.data, updatedAt: new Date() }).where(eq(interestStaleFactors.id, id)).returning() });
  return { ok: true, factors: await getStaleFactors(before.interestKey, todoId) };
}

/** Retires or restores a reason. Retired reasons stay on record but are no longer asked in a review. */
export async function setFactorActive(id: string, active: boolean, todoId: string | null): Promise<Result<{ factors: StaleFactorRow[] }>> {
  const admin = await requireAdminUser();
  const [before] = await db.select().from(interestStaleFactors).where(eq(interestStaleFactors.id, id));
  if (!before) return fail('Reason not found');
  await withAdminAudit({ actor: admin, skipPlaceCache: true, entityType: 'interest_stale_factor', entityId: id, action: 'update', before, after: { ...before, active }, write: (tx) => tx.update(interestStaleFactors).set({ active, updatedAt: new Date() }).where(eq(interestStaleFactors.id, id)).returning() });
  return { ok: true, factors: await getStaleFactors(before.interestKey, todoId) };
}

const checkInput = z.object({ result: z.enum(STALE_RESULTS), note: z.string().trim().max(1000) });
/** Records a result for one reason in one review round (replacing an earlier result for the same reason and round), or outside a round when todoId is null. */
export async function recordCheck(factorId: string, todoId: string | null, raw: z.input<typeof checkInput>, forInterest?: string): Promise<Result<{ factors: StaleFactorRow[] }>> {
  const admin = await requireAdminUser();
  const p = checkInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid result');
  if (p.data.result === 'changed' && !p.data.note) return fail('Say what changed.');
  const [factor] = await db.select().from(interestStaleFactors).where(eq(interestStaleFactors.id, factorId));
  if (!factor) return fail('Reason not found');
  // A site-wide reason is checked for one interest at a time, so the interest must be named; an interest's own reason is always checked for that interest.
  const interestKey = factor.interestKey === STALE_SITE_KEY ? forInterest : factor.interestKey;
  if (!interestKey || interestKey === STALE_SITE_KEY || !SLIDERS.some((s) => s.key === interestKey)) return fail('Say which interest this result is for');
  if (forInterest && factor.interestKey !== STALE_SITE_KEY && forInterest !== factor.interestKey) return fail('That reason belongs to another interest');
  if (todoId) {
    const [todo] = await db.select().from(interestTodos).where(eq(interestTodos.id, todoId));
    if (!todo || todo.interestKey !== interestKey || todo.source !== CADENCE_TODO_SOURCE) return fail('That is not this interest\'s review');
  }
  const values = { factorId, todoId, interestKey, result: p.data.result, note: p.data.note, checkedBy: admin.email };
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_stale_check', entityId: factorId, action: 'create', before: null, after: values,
    write: async (tx) => {
      if (todoId) await tx.delete(interestStaleChecks).where(and(eq(interestStaleChecks.factorId, factorId), eq(interestStaleChecks.todoId, todoId)));
      return tx.insert(interestStaleChecks).values(values).returning();
    },
  });
  return { ok: true, factors: await getStaleFactors(interestKey, todoId) };
}

/** Marks a site-wide reason as not applying to one interest (or puts it back). Not asked in that interest's review while opted out. */
export async function setOptOut(interestKey: string, factorId: string, optedOut: boolean, note: string, todoId: string | null): Promise<Result<{ factors: StaleFactorRow[] }>> {
  const admin = await requireAdminUser();
  if (interestKey === STALE_SITE_KEY || !SLIDERS.some((s) => s.key === interestKey)) return fail('Unknown interest');
  const [factor] = await db.select().from(interestStaleFactors).where(eq(interestStaleFactors.id, factorId));
  if (!factor || factor.interestKey !== STALE_SITE_KEY) return fail('That is not a site-wide reason');
  if (optedOut && note.trim().length < 3) return fail('Say why it does not apply to this interest.');
  const [before] = await db.select().from(interestStaleOptOuts).where(and(eq(interestStaleOptOuts.interestKey, interestKey), eq(interestStaleOptOuts.factorId, factorId)));
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_stale_opt_out', entityId: `${interestKey}:${factorId}`, action: optedOut ? 'create' : 'delete', before: before ?? null, after: optedOut ? { interestKey, factorId, note: note.trim() } : null,
    write: async (tx) => {
      await tx.delete(interestStaleOptOuts).where(and(eq(interestStaleOptOuts.interestKey, interestKey), eq(interestStaleOptOuts.factorId, factorId)));
      if (optedOut) await tx.insert(interestStaleOptOuts).values({ interestKey, factorId, note: note.trim() });
    },
  });
  return { ok: true, factors: await getStaleFactors(interestKey, todoId) };
}
