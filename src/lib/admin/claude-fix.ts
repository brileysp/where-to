import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { places, type ContentStamp } from '../db/schema';
import { applyAdminEdits, type EditPatch, type ApplyEditsResult } from './apply-edits';
import { CLAUDE_ACTOR } from './auth';

export interface ClaudeFixInput {
  placeId: string;
  interestKey: string;
  /** New overview text — omit to leave the overview untouched. */
  overview?: string;
  /** Month index (0 = January) -> new text — a month left out of this map
   * is untouched, exactly like the admin panel's own per-month editing. */
  monthly?: Partial<Record<number, string>>;
  /** WHY this specific correction was made — becomes every touched field's
   * `lastChange`, so the reason stays attached to the content itself, not
   * just a generic "edited" (unlike apply-edits.ts's auto-stamp for admin-
   * UI edits, which can't know a reason the UI itself never collected). */
  note: string;
}

/**
 * The write path for Claude's own direct corrections (e.g. the expert-
 * review pass — docs/todo.md's Gemini-pipeline standing rule). Builds
 * explicit sliderOverviewMeta/sliderMonthlyWeatherMeta patches (same
 * approach as src/lib/gemini/apply.ts for Gemini) rather than relying on
 * apply-edits.ts's auto-stamp, specifically so `note` can be a real,
 * specific reason instead of the auto-stamp's generic "Overview edited".
 * Preserves `origin` from whatever the field already had — a correction to
 * Gemini-authored content stays attributable as "Gemini, corrected by
 * Claude", not silently reset to a fresh Claude origin.
 */
export async function applyClaudeFix(input: ClaudeFixInput): Promise<ApplyEditsResult> {
  const [place] = await db.select().from(places).where(eq(places.id, input.placeId));
  if (!place) throw new Error(`applyClaudeFix: no place with id "${input.placeId}"`);

  const loadedUpdatedAt = place.updatedAt.toISOString();
  const now = new Date().toISOString();
  const patches: EditPatch[] = [];

  if (input.overview !== undefined) {
    const existingOverviews = (place.sliderOverview as Record<string, string>) ?? {};
    const existingMeta = (place.sliderOverviewMeta as Record<string, ContentStamp>) ?? {};
    const prevStamp = existingMeta[input.interestKey];
    const stamp: ContentStamp = {
      origin: prevStamp?.origin ?? 'claude',
      originGenerationId: prevStamp?.originGenerationId,
      lastEditedBy: 'claude',
      lastEditorName: 'claude-sonnet-5',
      lastEditedAt: now,
      lastChange: input.note,
    };
    patches.push(
      { entityType: 'destination', entityId: input.placeId, field: 'sliderOverview', value: { ...existingOverviews, [input.interestKey]: input.overview }, loadedUpdatedAt },
      { entityType: 'destination', entityId: input.placeId, field: 'sliderOverviewMeta', value: { ...existingMeta, [input.interestKey]: stamp }, loadedUpdatedAt },
    );
  }

  if (input.monthly && Object.keys(input.monthly).length > 0) {
    const existingMonthly = (place.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {};
    const existingMeta = (place.sliderMonthlyWeatherMeta as Record<string, (ContentStamp | null)[]>) ?? {};
    const prevArr = existingMonthly[input.interestKey] ?? new Array(12).fill(null);
    const prevMetaArr = existingMeta[input.interestKey] ?? new Array(12).fill(null);
    const nextArr = [...prevArr];
    const nextMetaArr = [...prevMetaArr];
    for (const [idxStr, text] of Object.entries(input.monthly)) {
      const idx = Number(idxStr);
      if (idx < 0 || idx > 11) throw new Error(`applyClaudeFix: month index ${idx} out of range (0-11)`);
      nextArr[idx] = text ?? null;
      const prevStamp = prevMetaArr[idx];
      nextMetaArr[idx] = {
        origin: prevStamp?.origin ?? 'claude',
        originGenerationId: prevStamp?.originGenerationId,
        lastEditedBy: 'claude',
        lastEditorName: 'claude-sonnet-5',
        lastEditedAt: now,
        lastChange: input.note,
      };
    }
    patches.push(
      { entityType: 'destination', entityId: input.placeId, field: 'sliderMonthlyWeather', value: { ...existingMonthly, [input.interestKey]: nextArr }, loadedUpdatedAt },
      { entityType: 'destination', entityId: input.placeId, field: 'sliderMonthlyWeatherMeta', value: { ...existingMeta, [input.interestKey]: nextMetaArr }, loadedUpdatedAt },
    );
  }

  if (patches.length === 0) throw new Error('applyClaudeFix: nothing to change — pass overview and/or monthly.');

  return applyAdminEdits(patches, CLAUDE_ACTOR);
}
