import { getAllScoredPlaces } from '@/lib/db/queries/places';
import { listDestinationsForAdmin } from '@/lib/db/queries/admin-destinations';
import { getContinent } from '@/lib/scoring/continents';
import { VISIBLE_SLIDERS } from '@/lib/scoring/constants';
import { MatrixGrid, type MatrixRow } from '@/components/admin/MatrixGrid';
import type { SliderSource } from '@/components/admin/cells';
import type { ContentStamp } from '@/lib/db/schema';

export default async function AdminDestinationMatrixPage() {
  const [scored, adminRows] = await Promise.all([getAllScoredPlaces(), listDestinationsForAdmin()]);
  const updatedAtById = new Map(adminRows.map((r) => [r.id, r.updatedAt.toISOString()]));
  // sliderSources, sliderOverview and sliderMonthlyWeather aren't part of
  // the scoring pipeline (ScoringDestination has no reason to carry them),
  // so they come from the plain admin rows rather than `scored`, unlike
  // every other per-slider column on this grid.
  const sliderSourcesById = new Map(adminRows.map((r) => [r.id, (r.sliderSources ?? {}) as Record<string, SliderSource[]>]));
  const sliderOverviewById = new Map(adminRows.map((r) => [r.id, (r.sliderOverview ?? {}) as Record<string, string>]));
  const sliderMonthlyWeatherById = new Map(adminRows.map((r) => [r.id, (r.sliderMonthlyWeather ?? {}) as Record<string, (string | null)[]>]));
  // Content provenance — display-only (see schema.ts's ContentStamp), so
  // unlike sliderOverview/sliderMonthlyWeather above these don't need a
  // "ByDest" read-modify-write map: nothing ever patches these fields
  // directly from this grid, the server computes them as a side effect of
  // editing the content itself (apply-edits.ts).
  const sliderOverviewMetaById = new Map(adminRows.map((r) => [r.id, (r.sliderOverviewMeta ?? {}) as Record<string, ContentStamp>]));
  const sliderMonthlyWeatherMetaById = new Map(adminRows.map((r) => [r.id, (r.sliderMonthlyWeatherMeta ?? {}) as Record<string, (ContentStamp | null)[]>]));

  // Base score, tier, and N/A are each one key inside a whole-object/array
  // column (baseScores jsonb, signatureTier jsonb, naSliders text[]) — the
  // grid needs the full per-destination object to do a read-modify-write
  // on a single-cell edit, the same pattern the mockup itself used.
  const baseScoresByDest: Record<string, Record<string, number>> = {};
  const signatureTierByDest: Record<string, Record<string, string>> = {};
  const naSlidersByDest: Record<string, string[]> = {};
  const sliderCapsByDest: Record<string, Record<string, number>> = {};
  const sliderCurvesByDest: Record<string, Record<string, unknown>> = {};
  const sliderEventsByDest: Record<string, Record<string, (typeof scored)[number]['sliderEvents'][string]>> = {};
  const activityStyleTiersByDest: Record<string, Record<string, Record<string, string>>> = {};
  const sliderSourcesByDest: Record<string, Record<string, SliderSource[]>> = {};
  const sliderOverviewByDest: Record<string, Record<string, string>> = {};
  const sliderMonthlyWeatherByDest: Record<string, Record<string, (string | null)[]>> = {};

  const rows: MatrixRow[] = [];
  for (const d of scored) {
    baseScoresByDest[d.id] = d.base;
    signatureTierByDest[d.id] = d.signatureTier;
    naSlidersByDest[d.id] = d.naSliders;
    sliderCapsByDest[d.id] = d.sliderCaps;
    sliderCurvesByDest[d.id] = d.sliderCurves;
    sliderEventsByDest[d.id] = d.sliderEvents;
    activityStyleTiersByDest[d.id] = d.activityStyleTiers;
    sliderSourcesByDest[d.id] = sliderSourcesById.get(d.id) ?? {};
    sliderOverviewByDest[d.id] = sliderOverviewById.get(d.id) ?? {};
    sliderMonthlyWeatherByDest[d.id] = sliderMonthlyWeatherById.get(d.id) ?? {};
    const continent = getContinent(d.id);
    const updatedAt = updatedAtById.get(d.id) ?? new Date().toISOString();
    for (const s of VISIBLE_SLIDERS) {
      const na = d.naSliders.includes(s.key);
      const monthly = d.monthly[s.key] ?? [];
      rows.push({
        destId: d.id,
        destName: d.name,
        continent,
        sliderKey: s.key,
        sliderLabel: s.label,
        sliderIcon: s.icon,
        group: s.group,
        base: d.base[s.key] ?? null,
        min: na || monthly.length === 0 ? null : Math.min(...monthly),
        max: na || monthly.length === 0 ? null : Math.max(...monthly),
        tier: d.signatureTier[s.key] ?? null,
        na,
        cap: d.sliderCaps[s.key] ?? null,
        events: d.sliderEvents[s.key] ?? [],
        styleTiers: d.activityStyleTiers[s.key] ?? {},
        sources: sliderSourcesById.get(d.id)?.[s.key] ?? [],
        overview: sliderOverviewById.get(d.id)?.[s.key] ?? '',
        monthlyText: sliderMonthlyWeatherById.get(d.id)?.[s.key] ?? [],
        overviewMeta: sliderOverviewMetaById.get(d.id)?.[s.key] ?? null,
        monthlyMeta: sliderMonthlyWeatherMetaById.get(d.id)?.[s.key] ?? [],
        updatedAt,
      });
    }
  }

  return (
    <MatrixGrid
      initialRows={rows}
      initialBaseScoresByDest={baseScoresByDest}
      initialSignatureTierByDest={signatureTierByDest}
      initialNaSlidersByDest={naSlidersByDest}
      initialSliderCapsByDest={sliderCapsByDest}
      initialSliderCurvesByDest={sliderCurvesByDest}
      initialSliderEventsByDest={sliderEventsByDest}
      initialActivityStyleTiersByDest={activityStyleTiersByDest}
      initialSliderSourcesByDest={sliderSourcesByDest}
      initialSliderOverviewByDest={sliderOverviewByDest}
      initialSliderMonthlyWeatherByDest={sliderMonthlyWeatherByDest}
    />
  );
}
