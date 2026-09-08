import { getAllScoredPlaces } from '@/lib/db/queries/places';
import { listDestinationsForAdmin } from '@/lib/db/queries/admin-destinations';
import { getContinent } from '@/lib/scoring/continents';
import { SLIDERS } from '@/lib/scoring/constants';
import { MatrixGrid, type MatrixRow } from '@/components/admin/MatrixGrid';

export default async function AdminDestinationMatrixPage() {
  const [scored, adminRows] = await Promise.all([getAllScoredPlaces(), listDestinationsForAdmin()]);
  const updatedAtById = new Map(adminRows.map((r) => [r.id, r.updatedAt.toISOString()]));

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

  const rows: MatrixRow[] = [];
  for (const d of scored) {
    baseScoresByDest[d.id] = d.base;
    signatureTierByDest[d.id] = d.signatureTier;
    naSlidersByDest[d.id] = d.naSliders;
    sliderCapsByDest[d.id] = d.sliderCaps;
    sliderCurvesByDest[d.id] = d.sliderCurves;
    sliderEventsByDest[d.id] = d.sliderEvents;
    activityStyleTiersByDest[d.id] = d.activityStyleTiers;
    const continent = getContinent(d.id);
    const updatedAt = updatedAtById.get(d.id) ?? new Date().toISOString();
    for (const s of SLIDERS) {
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
    />
  );
}
