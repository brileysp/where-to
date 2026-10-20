'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { interestQuestions, INTEREST_QUESTION_KINDS } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { SLIDERS } from '@/lib/scoring/constants';
import { factDefsFor } from '@/lib/admin/interest-pages/config';
import type { QuestionRow } from '@/lib/admin/interest-pages/types';

/**
 * Server actions behind the Questions section of the Chips tab. Each re-checks the admin session and writes through withAdminAudit.
 * Approval is the owner's agreement with the wording; changing the wording, the options or how many may be picked takes it away.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
const validInterest = (key: string) => SLIDERS.some((s) => s.key === key);

type Row = typeof interestQuestions.$inferSelect;
const toRow = (r: Row): QuestionRow => ({ key: r.questionKey, order: r.sortOrder, text: r.text, options: r.options, maxPicks: r.maxPicks, kind: r.kind, columns: r.columns, note: r.note, approvedBy: r.approvedBy, approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null });
const byOrder = (a: Row, b: Row) => a.sortOrder - b.sortOrder;

const patchSchema = z.object({
  text: z.string().trim().min(1, 'A question needs its wording').max(200, 'Keep the question under 200 characters').optional(),
  options: z.array(z.string().trim().min(1, 'An answer cannot be empty').max(120, 'Keep each answer under 120 characters')).min(2, 'A question needs at least two answers').max(10, 'Ten answers at most').optional(),
  maxPicks: z.number().int().min(1).max(3).optional(),
  kind: z.enum(INTEREST_QUESTION_KINDS).optional(),
  columns: z.array(z.string().min(1)).max(6, 'Six columns at most').optional(),
  note: z.string().trim().max(300).optional(),
});
export type QuestionPatch = z.input<typeof patchSchema>;

const loadAll = (interestKey: string) => db.select().from(interestQuestions).where(eq(interestQuestions.interestKey, interestKey));

export async function createQuestion(interestKey: string): Promise<Result<{ question: QuestionRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const all = await loadAll(interestKey);
  const n = all.reduce((m, r) => Math.max(m, Number(r.questionKey.replace(/^q/, '')) || 0), 0) + 1;
  const values = { interestKey, questionKey: `q${n}`, sortOrder: all.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1, text: 'New question', options: ['Answer one', 'Answer two'], maxPicks: 1, kind: 'lean' as const, columns: [], note: '', updatedBy: admin.email };
  const [row] = await withAdminAudit<Row[]>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_question', entityId: `${interestKey}:${values.questionKey}`, action: 'create', before: null, after: values,
    write: (tx) => tx.insert(interestQuestions).values(values).returning(),
  });
  return { ok: true, question: toRow(row) };
}

export async function updateQuestion(interestKey: string, questionKey: string, patch: QuestionPatch): Promise<Result<{ question: QuestionRow; approvalCleared: boolean }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = patchSchema.safeParse(patch);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid change');
  const cur = (await loadAll(interestKey)).find((r) => r.questionKey === questionKey);
  if (!cur) return fail('Question not found');
  const defs = factDefsFor(interestKey);
  if (p.data.columns?.some((c) => !defs.some((d) => d.key === c))) return fail('That column does not exist for this interest');
  const next = { ...cur, ...p.data };
  if (next.maxPicks > next.options.length) return fail('You cannot allow more picks than there are answers');
  // The wording the owner approved changed: the approval no longer applies.
  const wordingChanged = (p.data.text !== undefined && p.data.text !== cur.text) || (p.data.options !== undefined && JSON.stringify(p.data.options) !== JSON.stringify(cur.options)) || (p.data.maxPicks !== undefined && p.data.maxPicks !== cur.maxPicks);
  const approvalCleared = wordingChanged && !!cur.approvedAt;
  const set = { text: next.text, options: next.options, maxPicks: next.maxPicks, kind: next.kind, columns: next.columns, note: next.note, ...(approvalCleared ? { approvedBy: '', approvedAt: null } : {}), updatedBy: admin.email, updatedAt: new Date() };
  const [row] = await withAdminAudit<Row[]>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_question', entityId: `${interestKey}:${questionKey}`, action: 'update', before: cur, after: { ...cur, ...set },
    write: (tx) => tx.update(interestQuestions).set(set).where(and(eq(interestQuestions.interestKey, interestKey), eq(interestQuestions.questionKey, questionKey))).returning(),
  });
  return { ok: true, question: toRow(row), approvalCleared };
}

export async function setQuestionApproval(interestKey: string, questionKey: string, approved: boolean): Promise<Result<{ question: QuestionRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const cur = (await loadAll(interestKey)).find((r) => r.questionKey === questionKey);
  if (!cur) return fail('Question not found');
  const set = approved ? { approvedBy: admin.email, approvedAt: new Date() } : { approvedBy: '', approvedAt: null };
  const [row] = await withAdminAudit<Row[]>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_question', entityId: `${interestKey}:${questionKey}`, action: 'update', before: cur, after: { ...cur, ...set },
    write: (tx) => tx.update(interestQuestions).set({ ...set, updatedBy: admin.email, updatedAt: new Date() }).where(and(eq(interestQuestions.interestKey, interestKey), eq(interestQuestions.questionKey, questionKey))).returning(),
  });
  return { ok: true, question: toRow(row) };
}

export async function moveQuestion(interestKey: string, questionKey: string, direction: 'up' | 'down'): Promise<Result<{ order: Array<{ key: string; order: number }> }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const sorted = (await loadAll(interestKey)).sort(byOrder);
  const idx = sorted.findIndex((r) => r.questionKey === questionKey);
  if (idx < 0) return fail('Question not found');
  const other = direction === 'up' ? idx - 1 : idx + 1;
  if (other >= 0 && other < sorted.length) [sorted[idx], sorted[other]] = [sorted[other], sorted[idx]];
  const order = sorted.map((r, i) => ({ key: r.questionKey, order: i + 1 }));
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_question_order', entityId: interestKey, action: 'update',
    before: sorted.map((r) => ({ key: r.questionKey, order: r.sortOrder })), after: order,
    write: async (tx) => { for (const o of order) await tx.update(interestQuestions).set({ sortOrder: o.order }).where(and(eq(interestQuestions.interestKey, interestKey), eq(interestQuestions.questionKey, o.key))); },
  });
  return { ok: true, order };
}

export async function deleteQuestion(interestKey: string, questionKey: string): Promise<Result<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const cur = (await loadAll(interestKey)).find((r) => r.questionKey === questionKey);
  if (!cur) return fail('Question not found');
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_question', entityId: `${interestKey}:${questionKey}`, action: 'delete', before: cur, after: null,
    write: (tx) => tx.delete(interestQuestions).where(and(eq(interestQuestions.interestKey, interestKey), eq(interestQuestions.questionKey, questionKey))),
  });
  return { ok: true };
}
