'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  places,
  interestReviews,
  interestReferenceSites,
  interestTodos,
  interestPlaceIdeas,
  placeInterestFacts,
  authoringPasses,
  contentGenerations,
  interestRuleSections,
  interestAnchorOverrides,
  AUTHORING_PASS_KINDS,
  INTEREST_TODO_STATUSES,
  INTEREST_IDEA_STAGES,
  REFERENCE_SITE_ACCESS,
  type InterestFactValue,
} from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { applyAdminEdits } from '@/lib/admin/apply-edits';
import { SLIDERS } from '@/lib/scoring/constants';
import { factDefsFor, parseFact } from '@/lib/admin/interest-pages/config';
import type { IdeaRow, NaReasonInfo, ReferenceSiteRow, ReviewRow, TodoRow } from '@/lib/admin/interest-pages/types';
import { PLACE_TYPES } from '@/lib/admin/interest-pages/place-types';

/**
 * Server actions behind the per-interest admin page. Every one re-checks the
 * admin session itself (never trust the page alone) and writes through
 * withAdminAudit, so each change lands in admin_audit_log like every other
 * admin edit.
 */

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; message: string };

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function validInterest(key: string): boolean {
  return SLIDERS.some((s) => s.key === key);
}

async function placeExists(placeId: string): Promise<boolean> {
  const rows = await db.select({ id: places.id }).from(places).where(eq(places.id, placeId));
  return rows.length > 0;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-05').refine((s) => !Number.isNaN(Date.parse(s)), 'Not a real date');

// ---- Facts (the per-place columns) ------------------------------------------

export async function saveFact(interestKey: string, placeId: string, factKey: string, raw: unknown): Promise<ActionResult<{ value: InterestFactValue }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const def = factDefsFor(interestKey).find((d) => d.key === factKey);
  if (!def) return fail('Unknown field');
  const parsed = parseFact(def, raw);
  if (!parsed.ok) return fail(parsed.message);
  if (!(await placeExists(placeId))) return fail('Unknown place');

  const [existing] = await db
    .select()
    .from(placeInterestFacts)
    .where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, interestKey)));
  const before = existing?.facts ?? {};
  const after: Record<string, InterestFactValue> = { ...before };
  if (parsed.value === null) delete after[factKey];
  else after[factKey] = parsed.value;

  await withAdminAudit({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'place_interest_fact',
    entityId: `${placeId}:${interestKey}`,
    action: existing ? 'update' : 'create',
    before: existing ? { placeId, interestKey, facts: before } : null,
    after: { placeId, interestKey, facts: after },
    write: (tx) =>
      tx
        .insert(placeInterestFacts)
        .values({ placeId, interestKey, facts: after })
        .onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: after, updatedAt: new Date() } }),
  });
  return { ok: true, value: parsed.value };
}

// ---- Expert reviews -----------------------------------------------------------

const reviewInput = z.object({
  placeId: z.string().min(1).nullable(),
  reviewerName: z.string().trim().min(1, 'Reviewer name is required').max(120),
  reviewerRole: z.string().trim().max(160).nullable(),
  reviewedOn: isoDate,
  notes: z.string().trim().max(8000),
});
export type ReviewInput = z.input<typeof reviewInput>;

function toReviewRow(r: typeof interestReviews.$inferSelect): ReviewRow {
  return {
    id: r.id,
    placeId: r.placeId,
    reviewerName: r.reviewerName,
    reviewerRole: r.reviewerRole,
    reviewedOn: r.reviewedOn,
    notes: r.notes,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function addReview(interestKey: string, input: ReviewInput): Promise<ActionResult<{ review: ReviewRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = reviewInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid review');
  if (p.data.placeId && !(await placeExists(p.data.placeId))) return fail('Unknown place');
  const values = { interestKey, ...p.data, reviewerRole: p.data.reviewerRole || null, createdBy: admin.email };
  const [row] = await withAdminAudit<Array<typeof interestReviews.$inferSelect>>({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_review',
    entityId: `${interestKey}:new`,
    action: 'create',
    before: null,
    after: values,
    write: (tx) => tx.insert(interestReviews).values(values).returning(),
  });
  return { ok: true, review: toReviewRow(row) };
}

export async function updateReview(interestKey: string, id: string, input: ReviewInput): Promise<ActionResult<{ review: ReviewRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = reviewInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid review');
  if (p.data.placeId && !(await placeExists(p.data.placeId))) return fail('Unknown place');
  const [before] = await db.select().from(interestReviews).where(and(eq(interestReviews.id, id), eq(interestReviews.interestKey, interestKey)));
  if (!before) return fail('Review not found');
  const [row] = await withAdminAudit<Array<typeof interestReviews.$inferSelect>>({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_review',
    entityId: id,
    action: 'update',
    before,
    after: { ...before, ...p.data },
    write: (tx) =>
      tx
        .update(interestReviews)
        .set({ ...p.data, reviewerRole: p.data.reviewerRole || null, updatedAt: new Date() })
        .where(eq(interestReviews.id, id))
        .returning(),
  });
  return { ok: true, review: toReviewRow(row) };
}

export async function deleteReview(interestKey: string, id: string): Promise<ActionResult<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [before] = await db.select().from(interestReviews).where(and(eq(interestReviews.id, id), eq(interestReviews.interestKey, interestKey)));
  if (!before) return fail('Review not found');
  await withAdminAudit({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_review',
    entityId: id,
    action: 'delete',
    before,
    after: null,
    write: (tx) => tx.delete(interestReviews).where(eq(interestReviews.id, id)),
  });
  return { ok: true };
}

// ---- Reference sites (the few sites we come back to for fact checks) ---------------

const siteInput = z.object({
  siteUrl: z
    .string()
    .trim()
    .min(3, 'Enter the site address')
    .max(300)
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .refine((v) => {
      try {
        return new URL(v).hostname.includes('.');
      } catch {
        return false;
      }
    }, 'That is not a web address'),
  label: z.string().trim().min(1, 'Give the site a name').max(120),
  goodFor: z.string().trim().max(600),
  usefulness: z.coerce.number().int('Use a whole number').min(1, 'Use 1 to 100').max(100, 'Use 1 to 100'),
  aiAccess: z.enum(REFERENCE_SITE_ACCESS),
  lastUsedOn: z.union([isoDate, z.literal('')]).nullable().optional(),
  placesChecked: z.coerce.number().int('Use a whole number').min(0).max(100000),
});
export type SiteInput = z.input<typeof siteInput>;

function toSiteRow(r: typeof interestReferenceSites.$inferSelect): ReferenceSiteRow {
  return { id: r.id, siteUrl: r.siteUrl, label: r.label, goodFor: r.goodFor, usefulness: r.usefulness, aiAccess: r.aiAccess, lastUsedOn: r.lastUsedOn, placesChecked: r.placesChecked, createdAt: r.createdAt.toISOString() };
}

export async function addReferenceSite(interestKey: string, input: SiteInput): Promise<ActionResult<{ site: ReferenceSiteRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = siteInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid site');
  const [dupe] = await db.select({ id: interestReferenceSites.id }).from(interestReferenceSites).where(and(eq(interestReferenceSites.interestKey, interestKey), eq(interestReferenceSites.siteUrl, p.data.siteUrl)));
  if (dupe) return fail('That site is already on this list');
  const values = { interestKey, ...p.data, lastUsedOn: p.data.lastUsedOn || null, createdBy: admin.email };
  const [row] = await withAdminAudit<Array<typeof interestReferenceSites.$inferSelect>>({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_reference_site',
    entityId: `${interestKey}:new`,
    action: 'create',
    before: null,
    after: values,
    write: (tx) => tx.insert(interestReferenceSites).values(values).returning(),
  });
  return { ok: true, site: toSiteRow(row) };
}

export async function updateReferenceSite(interestKey: string, id: string, input: SiteInput): Promise<ActionResult<{ site: ReferenceSiteRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = siteInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid site');
  const [before] = await db.select().from(interestReferenceSites).where(and(eq(interestReferenceSites.id, id), eq(interestReferenceSites.interestKey, interestKey)));
  if (!before) return fail('Site not found');
  const clash = await db.select({ id: interestReferenceSites.id }).from(interestReferenceSites).where(and(eq(interestReferenceSites.interestKey, interestKey), eq(interestReferenceSites.siteUrl, p.data.siteUrl)));
  if (clash.some((c) => c.id !== id)) return fail('Another entry already uses that address');
  const set = { ...p.data, lastUsedOn: p.data.lastUsedOn || null };
  const [row] = await withAdminAudit<Array<typeof interestReferenceSites.$inferSelect>>({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_reference_site',
    entityId: id,
    action: 'update',
    before,
    after: { ...before, ...set },
    write: (tx) => tx.update(interestReferenceSites).set({ ...set, updatedAt: new Date() }).where(eq(interestReferenceSites.id, id)).returning(),
  });
  return { ok: true, site: toSiteRow(row) };
}

export async function deleteReferenceSite(interestKey: string, id: string): Promise<ActionResult<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [before] = await db.select().from(interestReferenceSites).where(and(eq(interestReferenceSites.id, id), eq(interestReferenceSites.interestKey, interestKey)));
  if (!before) return fail('Site not found');
  await withAdminAudit({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_reference_site',
    entityId: id,
    action: 'delete',
    before,
    after: null,
    write: (tx) => tx.delete(interestReferenceSites).where(eq(interestReferenceSites.id, id)),
  });
  return { ok: true };
}

// ---- Outstanding items ----------------------------------------------------------

const todoInput = z.object({
  title: z.string().trim().min(1, 'Give the item a title').max(200),
  detail: z.string().trim().max(2000),
  status: z.enum(INTEREST_TODO_STATUSES),
  source: z.string().trim().max(200),
  placeId: z.string().trim().min(1).nullable().default(null),
  closeOnApply: z.boolean().default(false),
  priority: z.number().int().min(1).max(3).default(2),
});
export type TodoInput = z.input<typeof todoInput>;

function toTodoRow(r: typeof interestTodos.$inferSelect): TodoRow {
  return { id: r.id, title: r.title, detail: r.detail, status: r.status, source: r.source, placeId: r.placeId, closeOnApply: r.closeOnApply, priority: r.priority, dueOn: r.dueOn, repeatEvery: r.repeatEvery, createdAt: r.createdAt.toISOString(), doneAt: r.doneAt ? r.doneAt.toISOString() : null };
}

export async function addTodo(interestKey: string, input: TodoInput): Promise<ActionResult<{ todo: TodoRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = todoInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid item');
  const values = { interestKey, ...p.data, doneAt: p.data.status === 'done' ? new Date() : null };
  const [row] = await withAdminAudit<Array<typeof interestTodos.$inferSelect>>({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_todo',
    entityId: `${interestKey}:new`,
    action: 'create',
    before: null,
    after: values,
    write: (tx) => tx.insert(interestTodos).values(values).returning(),
  });
  return { ok: true, todo: toTodoRow(row) };
}

export async function updateTodo(interestKey: string, id: string, input: TodoInput): Promise<ActionResult<{ todo: TodoRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = todoInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid item');
  const [before] = await db.select().from(interestTodos).where(and(eq(interestTodos.id, id), eq(interestTodos.interestKey, interestKey)));
  if (!before) return fail('Item not found');
  const doneAt = p.data.status === 'done' ? before.doneAt ?? new Date() : null;
  const [row] = await withAdminAudit<Array<typeof interestTodos.$inferSelect>>({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_todo',
    entityId: id,
    action: 'update',
    before,
    after: { ...before, ...p.data, doneAt },
    write: (tx) => tx.update(interestTodos).set({ ...p.data, doneAt, updatedAt: new Date() }).where(eq(interestTodos.id, id)).returning(),
  });
  return { ok: true, todo: toTodoRow(row) };
}

export async function deleteTodo(interestKey: string, id: string): Promise<ActionResult<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [before] = await db.select().from(interestTodos).where(and(eq(interestTodos.id, id), eq(interestTodos.interestKey, interestKey)));
  if (!before) return fail('Item not found');
  await withAdminAudit({ actor: admin, skipPlaceCache: true, entityType: 'interest_todo', entityId: id, action: 'delete', before, after: null, write: (tx) => tx.delete(interestTodos).where(eq(interestTodos.id, id)) });
  return { ok: true };
}

// ---- Future place ideas ----------------------------------------------------------

const ideaInput = z.object({
  name: z.string().trim().min(1, 'Give the place a name').max(160),
  region: z.string().trim().max(160),
  why: z.string().trim().max(1000),
  nearestExisting: z.string().trim().max(200),
  placeType: z.string().default('').refine((v) => v === '' || (PLACE_TYPES as readonly string[]).includes(v), 'Pick one of the ten place types'),
  stage: z.enum(INTEREST_IDEA_STAGES),
  grain: z.number().int().min(-3).max(3).nullable().default(null),
  grainNote: z.string().trim().max(400).default(''),
  sortOrder: z.number().int().nullable().optional(),
});
export type IdeaInput = z.input<typeof ideaInput>;

function toIdeaRow(r: typeof interestPlaceIdeas.$inferSelect): IdeaRow {
  return { id: r.id, name: r.name, region: r.region, why: r.why, nearestExisting: r.nearestExisting, placeType: r.placeType, stage: r.stage, grain: r.grain, grainNote: r.grainNote, sortOrder: r.sortOrder, promotedPlaceId: r.promotedPlaceId, createdAt: r.createdAt.toISOString() };
}

export async function addIdea(interestKey: string, input: IdeaInput): Promise<ActionResult<{ idea: IdeaRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = ideaInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid idea');
  const values = { interestKey, ...p.data };
  const [row] = await withAdminAudit<Array<typeof interestPlaceIdeas.$inferSelect>>({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_place_idea',
    entityId: `${interestKey}:new`,
    action: 'create',
    before: null,
    after: values,
    write: (tx) => tx.insert(interestPlaceIdeas).values(values).returning(),
  });
  return { ok: true, idea: toIdeaRow(row) };
}

export async function updateIdea(interestKey: string, id: string, input: IdeaInput): Promise<ActionResult<{ idea: IdeaRow }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = ideaInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid idea');
  const [before] = await db.select().from(interestPlaceIdeas).where(and(eq(interestPlaceIdeas.id, id), eq(interestPlaceIdeas.interestKey, interestKey)));
  if (!before) return fail('Idea not found');
  const [row] = await withAdminAudit<Array<typeof interestPlaceIdeas.$inferSelect>>({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'interest_place_idea',
    entityId: id,
    action: 'update',
    before,
    after: { ...before, ...p.data },
    write: (tx) => tx.update(interestPlaceIdeas).set({ ...p.data, updatedAt: new Date() }).where(eq(interestPlaceIdeas.id, id)).returning(),
  });
  return { ok: true, idea: toIdeaRow(row) };
}

export async function deleteIdea(interestKey: string, id: string): Promise<ActionResult<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [before] = await db.select().from(interestPlaceIdeas).where(and(eq(interestPlaceIdeas.id, id), eq(interestPlaceIdeas.interestKey, interestKey)));
  if (!before) return fail('Idea not found');
  await withAdminAudit({ actor: admin, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: id, action: 'delete', before, after: null, write: (tx) => tx.delete(interestPlaceIdeas).where(eq(interestPlaceIdeas.id, id)) });
  return { ok: true };
}

// ---- Authoring passes (docs/authoring-passes-spec.md) ---------------------------------

const passInput = z.object({
  label: z.string().trim().min(1, 'Give the pass a name').max(120),
  kind: z.enum(AUTHORING_PASS_KINDS),
  notes: z.string().trim().max(2000),
  promptVersion: z.string().trim().max(80).nullable().optional(),
});

export async function savePass(interestKey: string, id: string, input: { label: string; kind: string; notes: string; promptVersion?: string | null }): Promise<ActionResult<{ label: string; kind: string; notes: string; promptVersion?: string | null }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const p = passInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid pass');
  const [before] = await db.select().from(authoringPasses).where(and(eq(authoringPasses.id, id), eq(authoringPasses.interestKey, interestKey)));
  if (!before) return fail('Pass not found');
  await withAdminAudit({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'authoring_pass',
    entityId: id,
    action: 'update',
    before,
    after: { ...before, ...p.data },
    write: (tx) => tx.update(authoringPasses).set({ ...p.data, ...(p.data.promptVersion !== undefined ? { promptVersion: p.data.promptVersion || null } : {}) }).where(eq(authoringPasses.id, id)),
  });
  return { ok: true, ...p.data };
}

/** Mark a pass finished on a date (YYYY-MM-DD), or pass null to reopen it. */
export async function setPassFinished(interestKey: string, id: string, finishedOn: string | null): Promise<ActionResult<{ finishedAt: string | null }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  let finishedAt: Date | null = null;
  if (finishedOn !== null) {
    const d = isoDate.safeParse(finishedOn);
    if (!d.success) return fail(d.error.issues[0]?.message ?? 'Invalid date');
    finishedAt = new Date(`${finishedOn}T12:00:00Z`);
  }
  const [before] = await db.select().from(authoringPasses).where(and(eq(authoringPasses.id, id), eq(authoringPasses.interestKey, interestKey)));
  if (!before) return fail('Pass not found');
  await withAdminAudit({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'authoring_pass',
    entityId: id,
    action: 'update',
    before,
    after: { ...before, finishedAt },
    write: (tx) => tx.update(authoringPasses).set({ finishedAt }).where(eq(authoringPasses.id, id)),
  });
  return { ok: true, finishedAt: finishedAt?.toISOString() ?? null };
}


// ---- Not-applicable reasons -----------------------------------------------------

const naReasonInput = z.string().trim().min(5, 'Write at least a short sentence').max(600, 'Keep it under 600 characters');

/** Edit the reason a place is not applicable for this interest. Keeps the model's original wording the first time it is changed. */
export async function saveNaReason(interestKey: string, placeId: string, raw: string): Promise<ActionResult<{ info: NaReasonInfo }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const parsed = naReasonInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid reason');
  const [place] = await db.select().from(places).where(eq(places.id, placeId));
  if (!place) return fail('Unknown place');
  if (!place.naSliders.includes(interestKey)) return fail('This place is not marked N/A for this interest any more. Refresh the page.');

  const existing = (place.naReasons ?? {}) as Record<string, NaReasonInfo>;
  const prev = existing[interestKey];
  const info: NaReasonInfo = {
    reason: parsed.data,
    source: 'manual',
    by: admin.email,
    at: new Date().toISOString(),
    ...(prev?.source === 'gemini' ? { geminiText: prev.reason } : prev?.geminiText ? { geminiText: prev.geminiText } : {}),
  };
  const result = await applyAdminEdits(
    [{ entityType: 'destination', entityId: place.id, field: 'naReasons', value: { ...existing, [interestKey]: info }, loadedUpdatedAt: place.updatedAt.toISOString() }],
    admin,
  );
  if (result.errors.length > 0) return fail(result.errors.map((e) => e.message).join('; '));
  if (result.conflicts.length > 0) return fail('This place was edited elsewhere just now. Refresh the page and try again.');
  return { ok: true, info };
}

/** Take a place off the N/A list for this interest (and drop its reason). The place then has no text for the interest until one is authored. */
export async function removeNa(interestKey: string, placeId: string): Promise<ActionResult<{ updatedAt: string | null }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [place] = await db.select().from(places).where(eq(places.id, placeId));
  if (!place) return fail('Unknown place');
  if (!place.naSliders.includes(interestKey)) return { ok: true, updatedAt: null };
  const { [interestKey]: _dropped, ...kept } = (place.naReasons ?? {}) as Record<string, NaReasonInfo>;
  void _dropped;
  const result = await applyAdminEdits(
    [
      { entityType: 'destination', entityId: place.id, field: 'naSliders', value: place.naSliders.filter((k) => k !== interestKey), loadedUpdatedAt: place.updatedAt.toISOString() },
      { entityType: 'destination', entityId: place.id, field: 'naReasons', value: kept, loadedUpdatedAt: place.updatedAt.toISOString() },
    ],
    admin,
  );
  if (result.errors.length > 0) return fail(result.errors.map((e) => e.message).join('; '));
  if (result.conflicts.length > 0) return fail('This place was edited elsewhere just now. Refresh the page and try again.');
  return { ok: true, updatedAt: result.saved[0]?.updatedAt ?? null };
}

/**
 * Mark a place N/A for an interest, and record why, in one save. The reason is required: an N/A with no reason is what left
 * thousands of unexplained flags. Used by the Interests x Places grid, the place profile and the interest page.
 */
export async function markNa(interestKey: string, placeId: string, raw: string): Promise<ActionResult<{ info: NaReasonInfo; updatedAt: string | null }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const parsed = naReasonInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid reason');
  const [place] = await db.select().from(places).where(eq(places.id, placeId));
  if (!place) return fail('Unknown place');
  const info: NaReasonInfo = { reason: parsed.data, source: 'manual', by: admin.email, at: new Date().toISOString() };
  const existing = (place.naReasons ?? {}) as Record<string, NaReasonInfo>;
  const na = place.naSliders.includes(interestKey) ? place.naSliders : [...place.naSliders, interestKey];
  const result = await applyAdminEdits(
    [
      { entityType: 'destination', entityId: place.id, field: 'naSliders', value: na, loadedUpdatedAt: place.updatedAt.toISOString() },
      { entityType: 'destination', entityId: place.id, field: 'naReasons', value: { ...existing, [interestKey]: info }, loadedUpdatedAt: place.updatedAt.toISOString() },
    ],
    admin,
  );
  if (result.errors.length > 0) return fail(result.errors.map((e) => e.message).join('; '));
  if (result.conflicts.length > 0) return fail('This place was edited elsewhere just now. Refresh the page and try again.');
  return { ok: true, info, updatedAt: result.saved[0]?.updatedAt ?? null };
}


// ---- Written text, edited from the interest page -----------------------------------

const textSlice = z.string().max(2000, 'Keep it under 2,000 characters');

/** Save one place's overview for this interest. Only this interest's slice of the overview record is changed. */
export async function saveInterestOverview(interestKey: string, placeId: string, raw: string): Promise<ActionResult<{ updatedAt: string | null }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const parsed = textSlice.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid text');
  const [place] = await db.select().from(places).where(eq(places.id, placeId));
  if (!place) return fail('Unknown place');
  const next = { ...((place.sliderOverview ?? {}) as Record<string, string>) };
  const text = parsed.data.trim();
  if (text) next[interestKey] = text;
  else delete next[interestKey];
  const result = await applyAdminEdits([{ entityType: 'destination', entityId: place.id, field: 'sliderOverview', value: next, loadedUpdatedAt: place.updatedAt.toISOString() }], admin);
  if (result.errors.length > 0) return fail(result.errors.map((e) => e.message).join('; '));
  if (result.conflicts.length > 0) return fail('This place was edited elsewhere just now. Refresh the page and try again.');
  return { ok: true, updatedAt: result.saved[0]?.updatedAt ?? null };
}

/** Save one place's twelve monthly blurbs for this interest. Twelve entries, January first; an empty one means no text for that month. */
export async function saveInterestMonthly(interestKey: string, placeId: string, months: Array<string | null>): Promise<ActionResult<{ updatedAt: string | null }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  if (!Array.isArray(months) || months.length !== 12) return fail('Expected twelve months.');
  const cleaned: Array<string | null> = [];
  for (const m of months) {
    const t = typeof m === 'string' ? m.trim() : '';
    const ok = textSlice.safeParse(t);
    if (!ok.success) return fail(ok.error.issues[0]?.message ?? 'Invalid text');
    cleaned.push(t === '' ? null : t);
  }
  const [place] = await db.select().from(places).where(eq(places.id, placeId));
  if (!place) return fail('Unknown place');
  const next = { ...((place.sliderMonthlyWeather ?? {}) as Record<string, Array<string | null>>) };
  if (cleaned.every((m) => m === null)) delete next[interestKey];
  else next[interestKey] = cleaned;
  const result = await applyAdminEdits([{ entityType: 'destination', entityId: place.id, field: 'sliderMonthlyWeather', value: next, loadedUpdatedAt: place.updatedAt.toISOString() }], admin);
  if (result.errors.length > 0) return fail(result.errors.map((e) => e.message).join('; '));
  if (result.conflicts.length > 0) return fail('This place was edited elsewhere just now. Refresh the page and try again.');
  return { ok: true, updatedAt: result.saved[0]?.updatedAt ?? null };
}

// ---- Staged Gemini drafts -----------------------------------------------------------

/** Put a staged draft live: the same validated, audited path the pipeline's apply step uses. */
export async function applyStagedDraft(interestKey: string, generationId: string): Promise<ActionResult<{ detail: string; notApplicable: boolean }>> {
  await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [gen] = await db.select({ interestKey: contentGenerations.interestKey }).from(contentGenerations).where(eq(contentGenerations.id, generationId));
  if (!gen || gen.interestKey !== interestKey) return fail('That draft does not belong to this interest.');
  const { applyGeneration } = await import('@/lib/gemini/apply');
  const res = await applyGeneration(generationId);
  if (res.outcome !== 'applied') return fail(res.detail);
  return { ok: true, detail: res.detail, notApplicable: !!res.notApplicable };
}

/** Throw a staged draft away. It stays in the table, marked superseded, so the record of what Gemini wrote is kept. */
export async function discardStagedDraft(interestKey: string, generationId: string): Promise<ActionResult<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [gen] = await db.select().from(contentGenerations).where(eq(contentGenerations.id, generationId));
  if (!gen || gen.interestKey !== interestKey) return fail('That draft does not belong to this interest.');
  if (gen.appliedAt) return fail('That draft is already live.');
  await withAdminAudit({
    actor: admin,
    skipPlaceCache: true,
    entityType: 'content_generation',
    entityId: generationId,
    action: 'update',
    before: { validationStatus: gen.validationStatus },
    after: { validationStatus: 'superseded' },
    write: (tx) => tx.update(contentGenerations).set({ validationStatus: 'superseded' }).where(eq(contentGenerations.id, generationId)),
  });
  return { ok: true };
}


// ---- To-dos: bulk actions -----------------------------------------------------------

/** Mark several to-dos done, or change their priority or status together. */
export async function bulkUpdateTodos(
  interestKey: string,
  ids: string[],
  patch: { status?: (typeof INTEREST_TODO_STATUSES)[number]; priority?: number },
): Promise<ActionResult<{ todos: TodoRow[] }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  if (ids.length === 0) return fail('Pick at least one to-do.');
  if (patch.status && !(INTEREST_TODO_STATUSES as readonly string[]).includes(patch.status)) return fail('Unknown status');
  if (patch.priority !== undefined && (patch.priority < 1 || patch.priority > 3)) return fail('Priority is 1, 2 or 3.');
  const rows = (await db.select().from(interestTodos).where(eq(interestTodos.interestKey, interestKey))).filter((r) => ids.includes(r.id));
  const out: TodoRow[] = [];
  for (const before of rows) {
    const doneAt = patch.status ? (patch.status === 'done' ? before.doneAt ?? new Date() : null) : before.doneAt;
    const set = { ...(patch.status ? { status: patch.status } : {}), ...(patch.priority !== undefined ? { priority: patch.priority } : {}), doneAt, updatedAt: new Date() };
    const [row] = await withAdminAudit<Array<typeof interestTodos.$inferSelect>>({
      actor: admin, skipPlaceCache: true, entityType: 'interest_todo', entityId: before.id, action: 'update', before, after: { ...before, ...set },
      write: (tx) => tx.update(interestTodos).set(set).where(eq(interestTodos.id, before.id)).returning(),
    });
    out.push(toTodoRow(row));
  }
  return { ok: true, todos: out };
}

// ---- Future places: order and promotion --------------------------------------------

/** Move an idea one step up or down the manual order. The whole list is renumbered 1..n in one audited step. */
export async function moveIdea(interestKey: string, id: string, direction: 'up' | 'down'): Promise<ActionResult<{ order: Array<{ id: string; sortOrder: number }> }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const rows = await db.select().from(interestPlaceIdeas).where(eq(interestPlaceIdeas.interestKey, interestKey));
  const sorted = [...rows].sort((a, b) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.name.localeCompare(b.name));
  const idx = sorted.findIndex((r) => r.id === id);
  if (idx < 0) return fail('Idea not found');
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sorted.length) return { ok: true, order: sorted.map((r, i) => ({ id: r.id, sortOrder: i + 1 })) };
  [sorted[idx], sorted[swapWith]] = [sorted[swapWith], sorted[idx]];
  const order = sorted.map((r, i) => ({ id: r.id, sortOrder: i + 1 }));
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_place_idea_order', entityId: interestKey, action: 'update',
    before: rows.map((r) => ({ id: r.id, sortOrder: r.sortOrder })), after: order,
    write: async (tx) => { for (const o of order) await tx.update(interestPlaceIdeas).set({ sortOrder: o.sortOrder }).where(eq(interestPlaceIdeas.id, o.id)); },
  });
  return { ok: true, order };
}

/**
 * Turns a future-place idea into a real place: creates an empty place (retired and unpublished until you switch it on) from the idea's
 * name and region, and marks the idea "added". You choose the id and climate, which an idea does not carry.
 */
export async function promoteIdea(interestKey: string, ideaId: string, input: { id: string; climate: string; countryCode?: string | null; continent?: string | null }): Promise<ActionResult<{ idea: IdeaRow; placeId: string }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [idea] = await db.select().from(interestPlaceIdeas).where(and(eq(interestPlaceIdeas.id, ideaId), eq(interestPlaceIdeas.interestKey, interestKey)));
  if (!idea) return fail('Idea not found');
  if (idea.promotedPlaceId) return fail('This idea was already turned into a place.');
  const { insertNewPlace } = await import('@/lib/admin/create-place');
  const error = await insertNewPlace(admin, { id: input.id, name: idea.name, region: idea.region || 'To be set', climate: input.climate, countryCode: input.countryCode ?? null, continent: input.continent ?? null, summary: idea.why || null });
  if (error) return fail(error);
  const newId = input.id.trim().toLowerCase();
  const [row] = await withAdminAudit<Array<typeof interestPlaceIdeas.$inferSelect>>({
    actor: admin, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: ideaId, action: 'update', before: idea,
    after: { ...idea, stage: 'added', promotedPlaceId: newId },
    write: (tx) => tx.update(interestPlaceIdeas).set({ stage: 'added', promotedPlaceId: newId, updatedAt: new Date() }).where(eq(interestPlaceIdeas.id, ideaId)).returning(),
  });
  return { ok: true, idea: toIdeaRow(row), placeId: newId };
}


// ---- Rules & scoring text ----------------------------------------------------------

const ruleCell = z.union([z.string().max(1500), z.number()]);
const ruleItem = z.union([z.string().max(1500), z.record(z.string(), ruleCell)]);
const ruleItems = z.array(ruleItem).max(60);

/** Save an edited list for one section of the Rules & scoring tab. This is the admin reference text; the Gemini directive files are separate. */
export async function saveRuleSection(interestKey: string, sectionKey: string, items: unknown): Promise<ActionResult<{ items: unknown[] }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  if (!/^[a-zA-Z]+\.[a-zA-Z]+$/.test(sectionKey)) return fail('Unknown section');
  const parsed = ruleItems.safeParse(items);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid list');
  const [before] = await db.select().from(interestRuleSections).where(and(eq(interestRuleSections.interestKey, interestKey), eq(interestRuleSections.sectionKey, sectionKey)));
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_rule_section', entityId: `${interestKey}:${sectionKey}`, action: before ? 'update' : 'create',
    before: before ?? null, after: { interestKey, sectionKey, items: parsed.data },
    write: (tx) => tx.insert(interestRuleSections).values({ interestKey, sectionKey, items: parsed.data, updatedBy: admin.email }).onConflictDoUpdate({ target: [interestRuleSections.interestKey, interestRuleSections.sectionKey], set: { items: parsed.data, updatedBy: admin.email, updatedAt: new Date() } }),
  });
  return { ok: true, items: parsed.data };
}

/** Drop an edited list so the section goes back to the built-in text. */
export async function resetRuleSection(interestKey: string, sectionKey: string): Promise<ActionResult<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [before] = await db.select().from(interestRuleSections).where(and(eq(interestRuleSections.interestKey, interestKey), eq(interestRuleSections.sectionKey, sectionKey)));
  if (!before) return { ok: true };
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_rule_section', entityId: `${interestKey}:${sectionKey}`, action: 'delete', before, after: null,
    write: (tx) => tx.delete(interestRuleSections).where(and(eq(interestRuleSections.interestKey, interestKey), eq(interestRuleSections.sectionKey, sectionKey))),
  });
  return { ok: true };
}


// ---- What a 10 means (the anchors) -------------------------------------------------

/** Save the definition and the list of places allowed a peak of 10 for this interest. Applies to the Gemini validator and the audits. */
export async function saveAnchor(interestKey: string, definition: string, ten: string[]): Promise<ActionResult<{ definition: string; ten: Array<{ id: string; name: string }> }>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const def = definition.trim();
  if (def.length < 10) return fail('Write a sentence saying what a 10 means.');
  if (def.length > 1200) return fail('Keep the definition under 1,200 characters.');
  const ids = Array.from(new Set(ten));
  if (ids.length > 40) return fail('That is a lot of places for a top grade. Keep it to 40 or fewer.');
  const known = await db.select({ id: places.id, name: places.name }).from(places);
  const nameById = new Map(known.map((p) => [p.id, p.name]));
  const bad = ids.filter((id) => !nameById.has(id));
  if (bad.length) return fail(`Unknown place id: ${bad.join(', ')}`);
  const [before] = await db.select().from(interestAnchorOverrides).where(eq(interestAnchorOverrides.interestKey, interestKey));
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'interest_anchor', entityId: interestKey, action: before ? 'update' : 'create',
    before: before ?? null, after: { interestKey, definition: def, ten: ids },
    write: (tx) => tx.insert(interestAnchorOverrides).values({ interestKey, definition: def, ten: ids, updatedBy: admin.email }).onConflictDoUpdate({ target: interestAnchorOverrides.interestKey, set: { definition: def, ten: ids, updatedBy: admin.email, updatedAt: new Date() } }),
  });
  const { invalidateAnchorOverrides } = await import('@/lib/scoring/anchorOverrides');
  invalidateAnchorOverrides();
  return { ok: true, definition: def, ten: ids.map((id) => ({ id, name: nameById.get(id) ?? id })) };
}

/** Drop the edit so this interest goes back to the built-in list in anchors.ts. */
export async function resetAnchor(interestKey: string): Promise<ActionResult<object>> {
  const admin = await requireAdminUser();
  if (!validInterest(interestKey)) return fail('Unknown interest');
  const [before] = await db.select().from(interestAnchorOverrides).where(eq(interestAnchorOverrides.interestKey, interestKey));
  if (!before) return { ok: true };
  await withAdminAudit({ actor: admin, skipPlaceCache: true, entityType: 'interest_anchor', entityId: interestKey, action: 'delete', before, after: null, write: (tx) => tx.delete(interestAnchorOverrides).where(eq(interestAnchorOverrides.interestKey, interestKey)) });
  const { invalidateAnchorOverrides } = await import('@/lib/scoring/anchorOverrides');
  invalidateAnchorOverrides();
  return { ok: true };
}
