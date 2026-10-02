import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { places, contentGenerations, type ContentStamp } from '../db/schema';
import { fitMonthlyToCurve } from '../scoring/fitCurve';
import { applyAdminEdits, type EditPatch } from '../admin/apply-edits';
import { MODEL } from './client';
import type { AdminUser } from '../admin/auth';
import type { GenerationOutput } from './schema';

// Same well-known "this was a script, not a logged-in human" actor id the
// existing author-<interest>-blurbs-batchN.ts scripts already use for their
// own admin_audit_log inserts (interest-content-authoring-playbook.md §4's
// skeleton) — reused rather than inventing a second convention, so "which
// rows came from a script" stays one query. admin_audit_log.actor_id has no
// DB-level FK to auth.users (see schema.ts's own comment on it), so this is
// safe to insert without a real Supabase Auth user existing.
export const SYSTEM_ACTOR: AdminUser = { id: '00000000-0000-0000-0000-000000000000', email: 'gemini-pipeline@system' };

export interface ApplyResult {
  outcome: 'applied' | 'error' | 'conflict';
  detail: string;
}

/**
 * Commits one already-valid generation to `places`, via the exact same
 * validated, audited, optimistic-locked path every admin-screen edit goes
 * through (applyAdminEdits/entity-registry.ts) — not a parallel raw write.
 * This matters beyond "less code": withAdminAudit (called inside
 * applyAdminEdits) also refits every OTHER slider's curve from the formula
 * on every save, preserving only sliders listed in `authoredCurves` — and
 * applyAdminEdits itself is what adds a changed sliderCurves key to
 * authoredCurves in the first place. Writing sliderCurves any other way
 * would have this destination's very next admin save (or this pipeline's
 * own next run) silently discard the fitted curve back to the formula's
 * default shape.
 *
 * Called only from scripts/pipeline-apply.ts — generation (gemini-author-
 * batch.ts) never calls this directly; see that script's own doc comment
 * for why apply is a deliberately separate, explicit, id-scoped step.
 *
 * Also clears any pre-existing `scoreOverrides[interestKey]` for this place
 * — a real bug found and fixed during the first live pilot run (2026-09-29):
 * `scoreOverrides` is the scoring engine's highest-precedence layer (see
 * curveScoring.ts's own comment on it), so a place carrying a full 12-month
 * override from earlier low-quality legacy content silently masked a
 * freshly-fitted curve entirely — `sliderCurves` was written correctly,
 * `authoredCurves` correctly listed it, and the live computed score was
 * still the OLD value, because the override always wins regardless. Exactly
 * the failure mode this pipeline exists to replace, so it has to actively
 * clear it, not just add a new curve alongside it.
 */
export async function applyGeneration(generationId: string): Promise<ApplyResult> {
  const [gen] = await db.select().from(contentGenerations).where(eq(contentGenerations.id, generationId));
  if (!gen) return { outcome: 'error', detail: `No content_generations row with id ${generationId}` };
  if (gen.validationStatus !== 'valid') {
    return { outcome: 'error', detail: `Generation is '${gen.validationStatus}', not 'valid' — refusing to apply. Re-run gemini-author-batch or inspect validation_errors.` };
  }
  if (gen.appliedAt) {
    return { outcome: 'error', detail: `Already applied at ${gen.appliedAt.toISOString()} — not re-applying.` };
  }
  const output = gen.parsedOutput as GenerationOutput | null;
  if (!output) return { outcome: 'error', detail: 'parsed_output is empty — cannot apply.' };

  const [place] = await db.select().from(places).where(eq(places.id, gen.placeId));
  if (!place) return { outcome: 'error', detail: `No place with id ${gen.placeId}` };

  const { curve } = fitMonthlyToCurve(output.monthly.map((m) => m.score));
  const loadedUpdatedAt = place.updatedAt.toISOString();

  const existingCurves = (place.sliderCurves as Record<string, unknown>) ?? {};
  const existingOverviews = (place.sliderOverview as Record<string, string>) ?? {};
  const existingMonthly = (place.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {};
  const existingOverrides = (place.scoreOverrides as Record<string, Record<string, number>>) ?? {};
  const existingOverviewMeta = (place.sliderOverviewMeta as Record<string, ContentStamp>) ?? {};
  const existingMonthlyMeta = (place.sliderMonthlyWeatherMeta as Record<string, (ContentStamp | null)[]>) ?? {};

  // One stamp, reused for the overview and all 12 months — they all came
  // from this same generation call, applied atomically, so there's nothing
  // to distinguish between them provenance-wise (unlike a manual edit,
  // which might touch only one month and needs per-month diffing instead —
  // see entity-registry.ts's write path for that case).
  const stamp: ContentStamp = {
    origin: 'gemini',
    originGenerationId: gen.id,
    lastEditedBy: 'gemini',
    lastEditorName: gen.model ?? MODEL,
    lastEditedAt: new Date().toISOString(),
    lastChange: gen.kind === 'correct' ? 'Gemini correction' : 'Gemini reauthor',
  };

  const patches: EditPatch[] = [
    { entityType: 'destination', entityId: place.id, field: 'sliderCurves', value: { ...existingCurves, [gen.interestKey]: curve }, loadedUpdatedAt },
    { entityType: 'destination', entityId: place.id, field: 'sliderOverview', value: { ...existingOverviews, [gen.interestKey]: output.overview }, loadedUpdatedAt },
    {
      entityType: 'destination',
      entityId: place.id,
      field: 'sliderMonthlyWeather',
      value: { ...existingMonthly, [gen.interestKey]: output.monthly.map((m) => m.text) },
      loadedUpdatedAt,
    },
    { entityType: 'destination', entityId: place.id, field: 'sliderOverviewMeta', value: { ...existingOverviewMeta, [gen.interestKey]: stamp }, loadedUpdatedAt },
    {
      entityType: 'destination',
      entityId: place.id,
      field: 'sliderMonthlyWeatherMeta',
      value: { ...existingMonthlyMeta, [gen.interestKey]: new Array(12).fill(stamp) },
      loadedUpdatedAt,
    },
  ];

  if (existingOverrides[gen.interestKey]) {
    const { [gen.interestKey]: _removed, ...rest } = existingOverrides;
    patches.push({ entityType: 'destination', entityId: place.id, field: 'scoreOverrides', value: rest, loadedUpdatedAt });
  }

  const result = await applyAdminEdits(patches, SYSTEM_ACTOR);
  if (result.errors.length > 0) {
    return { outcome: 'error', detail: result.errors.map((e) => e.message).join('; ') };
  }
  if (result.conflicts.length > 0) {
    return { outcome: 'conflict', detail: `${place.name} was edited elsewhere since this generation was created — not applied, re-run gemini-author-batch to regenerate against current data.` };
  }

  await db.update(contentGenerations).set({ validationStatus: 'applied', appliedAt: new Date() }).where(eq(contentGenerations.id, generationId));
  return { outcome: 'applied', detail: `${place.name} (${place.id}) — ${gen.interestKey} committed.` };
}
