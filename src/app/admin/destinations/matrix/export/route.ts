import { NextRequest } from 'next/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getAllScoredPlaces } from '@/lib/db/queries/places';
import { listDestinationsForAdmin } from '@/lib/db/queries/admin-destinations';
import { getContinent } from '@/lib/scoring/continents';
import { VISIBLE_SLIDERS } from '@/lib/scoring/constants';
import { toCsv } from '@/lib/admin/csv';

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * CSV export of the Matrix screen — the first (and highest-value) piece of
 * the content-authoring-via-spreadsheet workflow (docs/todo.md). One row
 * per place × interest, with a place's current effective score and
 * authored monthly blurb broken into 12 real columns each, so an editor in
 * Sheets (or Gemini working there) can read and change any single month
 * directly without touching JSON.
 *
 * `score_*` is the CURRENTLY EFFECTIVE score (curve + seasonal hazards +
 * any existing admin override already applied — exactly what the public
 * site shows), not a raw stored value: there is no single stored "score for
 * this month," it's computed. On the way back in, a changed score cell
 * doesn't rewrite the underlying curve — it becomes a `scoreOverrides`
 * entry, the same highest-precedence "fix this one month" escape hatch the
 * Place Profile screen's override field already uses (see
 * deriveDestinationScoresFromCurves and this screen's own footer note).
 * Cells left unchanged from what was exported are left alone, so a partial
 * content pass never freezes untouched months out of the live curve.
 *
 * `blurb_*` is `sliderMonthlyWeather[interest][month]` — already labeled
 * "monthly blurbs" in this screen's own edit UI — and round-trips as a
 * plain per-month text overwrite, no override layer involved. `blurb_overall`
 * is `sliderOverview[interest]`, the one non-seasonal summary per interest
 * (schema.ts's own distinction: "why does this month score the way it does,
 * for THIS interest" vs the destination overall), separate from any one
 * month's blurb.
 *
 * `tier` is `signatureTier[interest]` (none/casual/strong/signature) — the
 * same field and same values as this screen's own "Tier" column — and
 * `score_max`/`score_min` are the extremes of that row's 12 `score_*`
 * columns, both included so a reviewer can judge an interest's overall
 * standing at a place without scanning all twelve month cells first.
 *
 * N/A rows are included, not filtered out — deliberately: an interest
 * wrongly marked N/A for a place is exactly the kind of mistake this export
 * is meant to help surface (a genuinely-N/A row shows as all-zero scores
 * and empty blurbs; one that shouldn't be N/A stands out against that).
 * The `na` column makes it sortable/filterable in the sheet. Pass
 * ?interest=<key> to export just one interest (matching the screen's own
 * filter dropdown) instead of all of them.
 */
export async function GET(req: NextRequest) {
  await requireAdminUser();

  const interestFilter = req.nextUrl.searchParams.get('interest');
  const sliders = interestFilter ? VISIBLE_SLIDERS.filter((s) => s.key === interestFilter) : VISIBLE_SLIDERS;

  const [scored, adminRows] = await Promise.all([getAllScoredPlaces(), listDestinationsForAdmin()]);
  const adminById = new Map(adminRows.map((r) => [r.id, r]));

  const header = [
    'place_id',
    'place_name',
    'region',
    'continent',
    'interest_key',
    'interest_label',
    'na',
    'updated_at',
    'tier',
    'score_max',
    'score_min',
    ...MONTH_ABBR.map((m) => `score_${m}`),
    'blurb_overall',
    ...MONTH_ABBR.map((m) => `blurb_${m}`),
  ];

  const rows: Array<Array<string | number | boolean | null>> = [];
  for (const d of scored) {
    const admin = adminById.get(d.id);
    const updatedAt = (admin?.updatedAt ?? new Date()).toISOString();
    const continent = getContinent(d.id);
    const blurbsBySlider = (admin?.sliderMonthlyWeather ?? {}) as Record<string, (string | null)[]>;
    const overviewBySlider = (admin?.sliderOverview ?? {}) as Record<string, string>;

    for (const s of sliders) {
      const na = d.naSliders.includes(s.key);
      const monthly = d.monthly[s.key] ?? [];
      const blurbs = blurbsBySlider[s.key] ?? [];
      const tier = d.signatureTier[s.key] ?? 'none';
      const scoreMax = na || monthly.length === 0 ? null : Math.round(Math.max(...monthly) * 10) / 10;
      const scoreMin = na || monthly.length === 0 ? null : Math.round(Math.min(...monthly) * 10) / 10;
      rows.push([
        d.id,
        d.name,
        d.region,
        continent,
        s.key,
        s.label,
        na,
        updatedAt,
        tier,
        scoreMax,
        scoreMin,
        ...Array.from({ length: 12 }, (_, i) => (typeof monthly[i] === 'number' ? Math.round(monthly[i] * 10) / 10 : null)),
        overviewBySlider[s.key] ?? '',
        ...Array.from({ length: 12 }, (_, i) => blurbs[i] ?? ''),
      ]);
    }
  }

  const csv = toCsv(header, rows);
  const filename = `matrix-export${interestFilter ? `-${interestFilter}` : ''}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
