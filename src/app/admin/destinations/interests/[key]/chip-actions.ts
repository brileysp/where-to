'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { interestChips, interestQuestionChips, interestQuestions, placeChipOverrides, places, INTEREST_CHIP_STATUSES, type InterestChipDriver } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { SLIDERS } from '@/lib/scoring/constants';
import { factDefsFor } from '@/lib/admin/interest-pages/config';
import { chipKeyFor, driverProblem, MAX_DRIVERS, MAX_LIVE_CHIPS } from '@/lib/admin/interest-pages/chips';
import type { ChipOverrideRow, ChipRow } from '@/lib/admin/interest-pages/types';

/**
 * Server actions behind the Chips tab of the per-interest admin page. Each one re-checks the admin session and writes through
 * withAdminAudit, like the rest of the page. Rules the page also shows: five live chips at most, a live chip needs at least one
 * complete driver and no "needs a new column" note, and an override needs a reason.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
const validInterest = (key: string) => SLIDERS.some((s) => s.key === key);

type ChipDbRow = typeof interestChips.$inferSelect;
const toRow = (c: ChipDbRow): ChipRow => ({ key: c.chipKey, label: c.label, order: c.sortOrder, status: c.status, drivers: c.drivers, needsColumn: c.needsColumn, approvedBy: c.approvedBy, approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null });
const byOrder = (a: ChipDbRow, b: ChipDbRow) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);

const driverSchema = z.object({
  column: z.string().min(1),
  option: z.string().optional(),
  fullAt: z.number().positive().optional(),
});
const patchSchema = z.object({
  label: z.string().trim().min(1, 'A chip needs a name').max(40, 'Keep the name under 40 characters').optional(),
  status: z.enum(INTEREST_CHIP_STATUSES).optional(),
  drivers: z.array(driverSchema).max(MAX_DRIVERS, `A chip can have up to ${MAX_DRIVERS} columns`).optional(),
  needsColumn: z.string().trim().max(200).optional(),
});
export type ChipPatch = z.input<typeof patchSchema>;

async function loadAll(interestKey: string): Promise<ChipDbRow[]> {
  return db.select().from(interestChips).where(eq(interestChips.interestKey, interestKey));
}

/** The rules a chip must meet to be live. Null when it may. */
function liveProblem(c: { drivers: InterestChipDriver[]; needsColumn: string }, interestKey: string): string | null {
  if (c.needsColumn) return 'This chip is waiting on a new column, so it stays a draft until the column is added.';
  if (c.drivers.length === 0) return 'Add at least one column before the chip goes live.';
  const defs = factDefsFor(interestKey);
  for (const d of c.drivers) {
    const p = driverProblem(d, defs);
    if (p) return p;
  }
  return null;
}

export async function createChip(interestKey: string, label: string): Promise<Result<{ chip: ChipRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const name = z.string().trim().min(1, 'A chip needs a name').max(40, 'Keep the name under 40 characters').safeParse(label);
  if (!name.success) return fail(name.error.issues[0]?.message ?? 'Invalid name');
  const all = await loadAll(interestKey);
  const key = chipKeyFor(name.data, new Set(all.map((c) => c.chipKey)));
  const values = { interestKey, chipKey: key, label: name.data, sortOrder: all.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1, status: 'draft' as const, drivers: [], needsColumn: '', updatedBy: admin.email };
  const [row] = await withAdminAudit<ChipDbRow[]>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_chip', entityId: `${interestKey}:${key}`, action: 'create', before: null, after: values,
    write: (tx) => tx.insert(interestChips).values(values).returning(),
  });
  return { ok: true, chip: toRow(row) };
}

export async function updateChip(interestKey: string, chipKey: string, patch: ChipPatch): Promise<Result<{ chip: ChipRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = patchSchema.safeParse(patch);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid change');
  const all = await loadAll(interestKey);
  const cur = all.find((c) => c.chipKey === chipKey);
  if (!cur) return fail('Chip not found');
  const next = { ...cur, ...p.data, drivers: p.data.drivers ?? cur.drivers, needsColumn: p.data.needsColumn ?? cur.needsColumn };
  // Drivers must point at real columns. Incomplete ones are allowed while the chip is a draft (an option is picked after the column).
  const defs = factDefsFor(interestKey);
  for (const d of next.drivers) {
    const def = defs.find((x) => x.key === d.column);
    if (!def) return fail('That column does not exist for this interest');
  }
  if (next.status === 'live') {
    const problem = liveProblem(next, interestKey);
    if (problem) return fail(problem);
    if (cur.status !== 'live' && !cur.approvedAt) return fail('This chip has not been approved yet. Approve it first, then it can go live.');
    if (cur.status !== 'live' && all.filter((c) => c.status === 'live').length >= MAX_LIVE_CHIPS) return fail(`Five chips are already live. Make one a draft first.`);
  }
  const set = { label: next.label, status: next.status, drivers: next.drivers, needsColumn: next.needsColumn, updatedBy: admin.email, updatedAt: new Date() };
  const [row] = await withAdminAudit<ChipDbRow[]>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_chip', entityId: `${interestKey}:${chipKey}`, action: 'update', before: cur, after: { ...cur, ...set },
    write: (tx) => tx.update(interestChips).set(set).where(and(eq(interestChips.interestKey, interestKey), eq(interestChips.chipKey, chipKey))).returning(),
  });
  return { ok: true, chip: toRow(row) };
}

/** Move a chip one step earlier or later. The whole list is renumbered 1..n in one audited step. */
export async function moveChip(interestKey: string, chipKey: string, direction: 'up' | 'down'): Promise<Result<{ order: Array<{ key: string; order: number }> }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const sorted = (await loadAll(interestKey)).sort(byOrder);
  const idx = sorted.findIndex((c) => c.chipKey === chipKey);
  if (idx < 0) return fail('Chip not found');
  const other = direction === 'up' ? idx - 1 : idx + 1;
  if (other >= 0 && other < sorted.length) [sorted[idx], sorted[other]] = [sorted[other], sorted[idx]];
  const order = sorted.map((c, i) => ({ key: c.chipKey, order: i + 1 }));
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_chip_order', entityId: interestKey, action: 'update',
    before: sorted.map((c) => ({ key: c.chipKey, order: c.sortOrder })), after: order,
    write: async (tx) => { for (const o of order) await tx.update(interestChips).set({ sortOrder: o.order }).where(and(eq(interestChips.interestKey, interestKey), eq(interestChips.chipKey, o.key))); },
  });
  return { ok: true, order };
}

/** Record (or take back) the owner's approval of a chip. Approval is the gate for going live; it does not switch anything on. */
export async function setChipApproval(interestKey: string, chipKey: string, approved: boolean): Promise<Result<{ chip: ChipRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const cur = (await loadAll(interestKey)).find((c) => c.chipKey === chipKey);
  if (!cur) return fail('Chip not found');
  if (!approved && cur.status === 'live') return fail('A live chip cannot lose its approval. Make it a draft first.');
  const set = approved ? { approvedBy: admin.email, approvedAt: new Date() } : { approvedBy: '', approvedAt: null };
  const [row] = await withAdminAudit<ChipDbRow[]>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_chip', entityId: `${interestKey}:${chipKey}`, action: 'update', before: cur, after: { ...cur, ...set },
    write: (tx) => tx.update(interestChips).set({ ...set, updatedBy: admin.email, updatedAt: new Date() }).where(and(eq(interestChips.interestKey, interestKey), eq(interestChips.chipKey, chipKey))).returning(),
  });
  return { ok: true, chip: toRow(row) };
}

/**
 * Deletes a chip. A chip that still opens onboarding questions is not deleted unless `untie` is set: those questions would otherwise
 * quietly become "asked of everyone". Untying removes the chip from each question's list (a question left with no chips is then asked of
 * everyone) and takes back those questions' approval, because who they are asked of has changed.
 */
export async function deleteChip(interestKey: string, chipKey: string, opts: { untie?: boolean } = {}): Promise<Result<{ untied: number }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const cur = (await loadAll(interestKey)).find((c) => c.chipKey === chipKey);
  if (!cur) return fail('Chip not found');
  const opens = await db.select({ q: interestQuestionChips.questionKey, s: interestQuestionChips.suggested }).from(interestQuestionChips).where(and(eq(interestQuestionChips.interestKey, interestKey), eq(interestQuestionChips.chipKey, chipKey)));
  if (opens.length && !opts.untie) return fail(`${opens.length} onboarding question${opens.length === 1 ? ' is' : 's are'} opened by this chip. Untie ${opens.length === 1 ? 'it' : 'them'} first, or delete the chip and untie ${opens.length === 1 ? 'it' : 'them'} in one go.`);
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_chip', entityId: `${interestKey}:${chipKey}`, action: 'delete', before: { ...cur, opensQuestions: opens.map((o) => o.q) }, after: null,
    write: async (tx) => {
      for (const { q, s: wasSuggested } of opens) {
        await tx.delete(interestQuestionChips).where(and(eq(interestQuestionChips.interestKey, interestKey), eq(interestQuestionChips.questionKey, q), eq(interestQuestionChips.chipKey, chipKey)));
        if (!wasSuggested) await tx.update(interestQuestions).set({ approvedBy: '', approvedAt: null, updatedBy: admin.email, updatedAt: new Date() }).where(and(eq(interestQuestions.interestKey, interestKey), eq(interestQuestions.questionKey, q)));
      }
      await tx.delete(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, interestKey), eq(placeChipOverrides.chipKey, chipKey)));
      await tx.delete(interestChips).where(and(eq(interestChips.interestKey, interestKey), eq(interestChips.chipKey, chipKey)));
    },
  });
  return { ok: true, untied: opens.length };
}

const overrideSchema = z.object({
  fit: z.number().min(0, 'The number is 0 to 10').max(10, 'The number is 0 to 10'),
  reason: z.string().trim().min(1, 'A reason is required').max(500),
});

export async function saveChipOverride(interestKey: string, chipKey: string, placeId: string, input: { fit: number; reason: string }): Promise<Result<{ override: ChipOverrideRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = overrideSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid number');
  if (!(await loadAll(interestKey)).some((c) => c.chipKey === chipKey)) return fail('Chip not found');
  if ((await db.select({ id: places.id }).from(places).where(eq(places.id, placeId))).length === 0) return fail('Unknown place');
  const [existing] = await db.select().from(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, interestKey), eq(placeChipOverrides.chipKey, chipKey), eq(placeChipOverrides.placeId, placeId)));
  const values = { interestKey, chipKey, placeId, fit: Math.round(p.data.fit * 10) / 10, reason: p.data.reason, setBy: admin.email, setAt: new Date() };
  const [row] = await withAdminAudit<Array<typeof placeChipOverrides.$inferSelect>>({
    actor: admin, skipPlaceCache: true, entityType: 'place_chip_override', entityId: `${interestKey}:${chipKey}:${placeId}`, action: existing ? 'update' : 'create', before: existing ?? null, after: values,
    write: (tx) => tx.insert(placeChipOverrides).values(values).onConflictDoUpdate({ target: [placeChipOverrides.interestKey, placeChipOverrides.chipKey, placeChipOverrides.placeId], set: values }).returning(),
  });
  return { ok: true, override: { chipKey, placeId, fit: row.fit, reason: row.reason, setBy: row.setBy, setAt: row.setAt.toISOString() } };
}

export async function clearChipOverride(interestKey: string, chipKey: string, placeId: string): Promise<Result<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [existing] = await db.select().from(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, interestKey), eq(placeChipOverrides.chipKey, chipKey), eq(placeChipOverrides.placeId, placeId)));
  if (!existing) return { ok: true };
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'place_chip_override', entityId: `${interestKey}:${chipKey}:${placeId}`, action: 'delete', before: existing, after: null,
    write: (tx) => tx.delete(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, interestKey), eq(placeChipOverrides.chipKey, chipKey), eq(placeChipOverrides.placeId, placeId))),
  });
  return { ok: true };
}
