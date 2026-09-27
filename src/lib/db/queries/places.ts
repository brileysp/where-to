import { getPrimaryPlaceRows, type PlaceRow } from './primary-place-rows';
import { deriveDestinationScoresFromCurves } from '@/lib/scoring/curveScoring';
import type { ScoredDestination, ScoringDestination } from '@/lib/scoring/types';

/**
 * Place migration, Phase 3 (docs/final-architecture-plan.md): reads from the
 * new `places` table, restricted to primary destinations, through the same
 * scoring adapter as `toScoringDestination` in destinations.ts. Every shared
 * column between `destinations` and `places` was copied 1:1 by Phase 2's
 * backfill, so this mapping is identical field-for-field — it's a separate
 * function (not a shared helper taking either row type) because the two
 * source tables are structurally distinct Drizzle tables, and duplicating
 * this small mapping is cheaper than a generic-row abstraction that would
 * only ever have two callers.
 *
 * This lives alongside getAllScoredDestinations, not in place of it —
 * `destinations` stays the live read path until Phase 4's cutover.
 *
 * Curve-based scoring, Phase 4 (docs/scoring-v2-proposal.html): scorePlace
 * now computes `monthly` via deriveDestinationScoresFromCurves rather than
 * the old formula. scoreDestination (destinations.ts) deliberately still
 * uses the OLD formula — the admin panel has no anchor-editing UI yet, so
 * admin's own screens keep showing immediate, formula-based feedback while
 * editing baseScores/sliderCaps/etc. The public page (this function) gets
 * curve-based scores, kept live by lib/admin/write.ts's write-time refit:
 * every admin save recomputes sliderCurves from the same edit, so this path
 * tracks admin content exactly as immediately as the old formula did — see
 * that file's doc comment. Validated against 113,964 real slider-months
 * before this switch: every fittable slider matched the old formula within
 * fitCurve.ts's own tolerance; only crowds/deals differ meaningfully, by
 * design (see curve.ts's seasonalQuietness).
 */
export function toScoringPlace(row: PlaceRow): ScoringDestination {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    emoji: row.emoji,
    climate: row.climate,
    about: row.about,
    overview: row.overview,
    costRange: row.costMin && row.costMax ? { min: row.costMin, max: row.costMax } : null,
    costOverview: row.costOverview,
    // Strip the admin-only edit-tracking fields (editor email etc.) so they
    // never reach the public payload.
    costItems: row.costItems.map(({ label, price, unit, emoji }) => ({ label, price, unit, ...(emoji ? { emoji } : {}) })),
    base: row.baseScores,
    budgetBands: row.budgetBands,
    vibeBands: row.vibeBands,
    physicalBands: row.physicalBands,
    dry: row.dryMonths,
    wet: row.wetMonths,
    hot: row.hotMonths,
    cold: row.coldMonths,
    peak: row.peakMonths,
    low: row.lowMonths,
    peakIntensity: row.peakIntensity,
    crowdBaseline: row.crowdBaseline,
    hotSeverity: row.hotSeverity,
    coldSeverity: row.coldSeverity,
    wetSeverity: row.wetSeverity,
    seasonalHazards: row.seasonalHazards,
    wildlifePeak: row.wildlifePeakMonths,
    wildlifeClosed: row.wildlifeClosedMonths,
    birdingPeak: row.birdingPeakMonths,
    hikingBest: row.hikingBestMonths,
    hikingWorst: row.hikingWorstMonths,
    inaccessible: row.inaccessibleMonths,
    swimHazard: row.swimHazardMonths,
    noSnow: row.noSnowMonths,
    sliderCaps: row.sliderCaps,
    sliderEvents: row.sliderEvents,
    shopClosures: row.shopClosures,
    specialSeasons: row.specialSeasons,
    monthlyWeather: row.monthlyWeather,
    sliderOverview: row.sliderOverview,
    sliderMonthlyWeather: row.sliderMonthlyWeather,
    naSliders: row.naSliders,
    searchAliases: row.searchAliases,
    activityStyleTiers: row.activityStyleTiers,
    signatureTier: row.signatureTier,
    scoreOverrides: row.scoreOverrides,
    sliderCurves: row.sliderCurves,
  };
}

export function scorePlace(row: PlaceRow): ScoredDestination {
  const scoring = toScoringPlace(row);
  const derived = deriveDestinationScoresFromCurves(scoring);
  return { ...scoring, ...derived };
}

export async function getAllScoredPlaces(): Promise<ScoredDestination[]> {
  const rows = await getPrimaryPlaceRows();
  return rows.map(scorePlace);
}
