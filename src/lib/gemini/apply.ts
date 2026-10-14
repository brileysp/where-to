import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { places, contentGenerations, placeInterestFacts, type ContentStamp } from '../db/schema';
import { withAdminAudit } from '../admin/write';
import { fitMonthlyToCurve } from '../scoring/fitCurve';
import { applyAdminEdits, type EditPatch } from '../admin/apply-edits';
import { MODEL } from './client';
import { SYSTEM_ACTOR } from './apply-actor';
import { closeTodosForApplied } from './todo-sync';
import type { GenerationOutput } from './schema';
import { isNotApplicable } from './validate';
import { syncAndGate } from './fact-check';
import { EMPHASIS_INTERESTS, markSpecies, placeWordsFor } from '../text/species-marker';

// Same well-known "this was a script, not a logged-in human" actor id the
// existing author-<interest>-blurbs-batchN.ts scripts already use for their
// own admin_audit_log inserts (interest-content-authoring-playbook.md §4's
// skeleton) — reused rather than inventing a second convention, so "which
// rows came from a script" stays one query. admin_audit_log.actor_id has no
// DB-level FK to auth.users (see schema.ts's own comment on it), so this is
// safe to insert without a real Supabase Auth user existing.
export { SYSTEM_ACTOR };

/** Fact-column keys for the extra fields a generation can carry (snorkeling & diving fit, surfing beginner and advanced ratings). */
const EXTRA_TO_FACT: Record<string, string> = { diving_rating: 'divingRating', snorkeling_rating: 'snorkelingRating', best_for: 'bestFor', beginner_rating: 'beginnerRating', advanced_rating: 'advancedRating', day_hike_rating: 'dayHikeRating', trek_rating: 'trekRating' };

/** Writes a generation's extra fields into the interest's data columns, keeping every other column as it is. `clear` removes them (N/A). */
export async function writeExtraFacts(placeId: string, interestKey: string, extras: Record<string, number | string> | undefined, clear: boolean): Promise<void> {
  const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, interestKey)));
  if (!extras && !clear) return;
  const before = (existing?.facts ?? {}) as Record<string, unknown>;
  const after: Record<string, unknown> = { ...before };
  for (const factKey of Object.values(EXTRA_TO_FACT)) delete after[factKey];
  if (!clear && extras) for (const [k, v] of Object.entries(extras)) if (EXTRA_TO_FACT[k]) after[EXTRA_TO_FACT[k]] = v;
  if (!existing && Object.keys(after).length === 0) return;
  await withAdminAudit({
    actor: SYSTEM_ACTOR,
    skipPlaceCache: true,
    entityType: 'place_interest_fact',
    entityId: `${placeId}:${interestKey}`,
    action: existing ? 'update' : 'create',
    before: existing ? { placeId, interestKey, facts: before } : null,
    after: { placeId, interestKey, facts: after },
    write: (tx) => tx.insert(placeInterestFacts).values({ placeId, interestKey, facts: after as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: after as never, updatedAt: new Date() } }),
  });
}

export interface ApplyResult {
  outcome: 'applied' | 'error' | 'conflict';
  detail: string;
  /** Set when outcome is 'applied': whether the generation marked the place N/A. */
  notApplicable?: boolean;
  /** Titles of the to-dos this apply closed (see todo-sync.ts). */
  closedTodos?: string[];
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
export interface ApplyOptions {
  /** Owner override only: skips the fact-check gate. Never set by default; the pipeline script needs --skip-fact-check to pass it. */
  skipFactCheck?: boolean;
}

export async function applyGeneration(generationId: string, options: ApplyOptions = {}): Promise<ApplyResult> {
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

  const notApplicable = isNotApplicable(output);

  // Fact-check gate (14 Oct 2026, after a Sedona overview went through with invented loops and wrong trail facts): text that makes
  // checkable claims is not applied until each one has been checked against a source. See docs/fact-check-process.md.
  if (!notApplicable && !options.skipFactCheck) {
    const gate = await syncAndGate(gen.placeId, gen.interestKey, output, place.name);
    if (!gate.ok) {
      const examples = gate.unresolved.slice(0, 3).map((u) => `"${u.sentence.slice(0, 90)}${u.sentence.length > 90 ? '…' : ''}"`).join('; ');
      return { outcome: 'error', detail: `Not applied: ${gate.unresolved.length} of ${gate.total} factual claims in ${place.name}'s ${gen.interestKey} text have not been fact-checked (for example ${examples}). Run: npx tsx scripts/fact-check.ts list --generation-id=${gen.id}` };
    }
  }
  const { curve } = notApplicable ? { curve: null } : fitMonthlyToCurve(output.monthly.map((m) => m.score));
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

  if (notApplicable) {
    // The model judged this place not applicable. By catalog convention an N/A place carries no content at all, so
    // this flags it N/A and clears the interest's text, scores and overrides (reviewed first via pipeline:diff).
    const without = <T,>(obj: Record<string, T>): Record<string, T> => {
      const { [gen.interestKey]: _drop, ...rest } = obj;
      return rest;
    };
    const naList = place.naSliders.includes(gen.interestKey) ? place.naSliders : [...place.naSliders, gen.interestKey];
    const naPatches: EditPatch[] = [
      { entityType: 'destination', entityId: place.id, field: 'naSliders', value: naList, loadedUpdatedAt },
      { entityType: 'destination', entityId: place.id, field: 'sliderCurves', value: without(existingCurves), loadedUpdatedAt },
      { entityType: 'destination', entityId: place.id, field: 'sliderOverview', value: without(existingOverviews), loadedUpdatedAt },
      { entityType: 'destination', entityId: place.id, field: 'sliderMonthlyWeather', value: without(existingMonthly), loadedUpdatedAt },
      { entityType: 'destination', entityId: place.id, field: 'sliderOverviewMeta', value: without(existingOverviewMeta), loadedUpdatedAt },
      { entityType: 'destination', entityId: place.id, field: 'sliderMonthlyWeatherMeta', value: without(existingMonthlyMeta), loadedUpdatedAt },
    ];
    // Keep the model's reason on the place so it can be shown and edited later (it used to be thrown away here).
    const existingReasons = (place.naReasons as Record<string, unknown>) ?? {};
    naPatches.push({
      entityType: 'destination',
      entityId: place.id,
      field: 'naReasons',
      value: {
        ...existingReasons,
        [gen.interestKey]: {
          reason: output.overview.trim().slice('NOT_APPLICABLE:'.length).trim(),
          source: 'gemini',
          by: gen.model ?? MODEL,
          at: new Date().toISOString(),
          generationId: gen.id,
        },
      },
      loadedUpdatedAt,
    });
    if (existingOverrides[gen.interestKey]) naPatches.push({ entityType: 'destination', entityId: place.id, field: 'scoreOverrides', value: without(existingOverrides), loadedUpdatedAt });
    const naResult = await applyAdminEdits(naPatches, SYSTEM_ACTOR);
    if (naResult.errors.length > 0) return { outcome: 'error', detail: naResult.errors.map((e) => e.message).join('; ') };
    if (naResult.conflicts.length > 0) {
      return { outcome: 'conflict', detail: `${place.name} was edited elsewhere since this generation was created — not applied, re-run gemini-author-batch to regenerate against current data.` };
    }
    await writeExtraFacts(place.id, gen.interestKey, undefined, true);
    await db.update(contentGenerations).set({ validationStatus: 'applied', appliedAt: new Date() }).where(eq(contentGenerations.id, generationId));
    const closedNa = await closeTodosForApplied({ placeId: place.id, interestKey: gen.interestKey, generationId, promptVersion: gen.promptVersion, notApplicable: true });
    return { outcome: 'applied', detail: `${place.name} (${place.id}) — ${gen.interestKey} marked N/A and its content cleared.`, notApplicable: true, closedTodos: closedNa };
  }

  // Species names in new text are marked (**Name**) for the interests whose word list is ready; see src/lib/text/species-marker.ts.
  const placeWords = placeWordsFor(place);
  const markText = (t: string) => (EMPHASIS_INTERESTS.has(gen.interestKey) ? markSpecies(t, { placeWords }) : t);

  const patches: EditPatch[] = [
    { entityType: 'destination', entityId: place.id, field: 'sliderCurves', value: { ...existingCurves, [gen.interestKey]: curve! }, loadedUpdatedAt },
    { entityType: 'destination', entityId: place.id, field: 'sliderOverview', value: { ...existingOverviews, [gen.interestKey]: markText(output.overview) }, loadedUpdatedAt },
    {
      entityType: 'destination',
      entityId: place.id,
      field: 'sliderMonthlyWeather',
      value: { ...existingMonthly, [gen.interestKey]: output.monthly.map((m) => markText(m.text)) },
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
  if (place.naSliders.includes(gen.interestKey)) {
    // The place was marked N/A for this interest but the model judged it applicable (low or real): drop the flag.
    patches.push({ entityType: 'destination', entityId: place.id, field: 'naSliders', value: place.naSliders.filter((k) => k !== gen.interestKey), loadedUpdatedAt });
    const { [gen.interestKey]: _dropReason, ...keptReasons } = (place.naReasons as Record<string, unknown>) ?? {};
    patches.push({ entityType: 'destination', entityId: place.id, field: 'naReasons', value: keptReasons, loadedUpdatedAt });
  }

  const result = await applyAdminEdits(patches, SYSTEM_ACTOR);
  if (result.errors.length > 0) {
    return { outcome: 'error', detail: result.errors.map((e) => e.message).join('; ') };
  }
  if (result.conflicts.length > 0) {
    return { outcome: 'conflict', detail: `${place.name} was edited elsewhere since this generation was created — not applied, re-run gemini-author-batch to regenerate against current data.` };
  }

  await writeExtraFacts(place.id, gen.interestKey, output.extras, false);
  await db.update(contentGenerations).set({ validationStatus: 'applied', appliedAt: new Date() }).where(eq(contentGenerations.id, generationId));
  const closed = await closeTodosForApplied({ placeId: place.id, interestKey: gen.interestKey, generationId, promptVersion: gen.promptVersion, notApplicable: false });
  return { outcome: 'applied', detail: `${place.name} (${place.id}) — ${gen.interestKey} committed.`, notApplicable: false, closedTodos: closed };
}
