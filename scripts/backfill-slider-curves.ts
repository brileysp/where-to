import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Curve-based scoring, Phase 2 materialized: populate the `sliderCurves`
 * column by fitting a SliderCurve to each destination's own current,
 * already-computed monthly output — see src/lib/scoring/fitCurve.ts and the
 * Migration section of docs/scoring-v2-proposal.html.
 *
 * `deals`/`crowds` are excluded on purpose — they're derived at read time
 * from every other slider's curve (crowdsScore/dealsScore in curve.ts),
 * not authored or fitted per-slider. An N/A slider is skipped entirely
 * (absent from the map, same sparse convention as every other jsonb column
 * on this table).
 *
 * Fits against monthly output computed with `{ skipHazards: true }`, not
 * the live formula's normal output. seasonalHazards stays a live,
 * dynamically-reapplied mechanism under curve-based scoring (see
 * docs/scoring-v2-proposal.html section 04's "Unchanged" list) — baking a
 * hazard's effect into a curve's anchors would double-apply it once the
 * new evaluator reapplies it on top, and would freeze it at fit-time even
 * if the hazard is edited later. See the opts.skipHazards doc comment on
 * deriveDestinationScores (scoring/destinations.ts) for the full reasoning.
 *
 * Idempotent and safe to re-run: this only ever writes to the additive
 * sliderCurves column, nothing else on the row.
 *
 * Fitting itself lives in scoring/fitCurve.ts's fitDestinationCurves —
 * shared with lib/admin/write.ts's live write-time refit, so the batch
 * backfill here and the per-save refit can't drift into two different
 * fitting behaviors.
 *
 * Place migration Phase 6 completed (2026-09-07): `destinations` no longer
 * exists — `places` is the only table, and has been the only live read/write
 * path (admin and public) since Phase 4's full cutover. This script
 * previously fit both tables independently, since `places` used to be a
 * one-time snapshot that could silently drift from `destinations`; that
 * whole class of problem is gone along with the second table.
 */

function loadDotEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq2 = trimmed.indexOf('=');
    if (eq2 === -1) continue;
    const key = trimmed.slice(0, eq2).trim();
    let value = trimmed.slice(eq2 + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnvLocal();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL found in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }

  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { toScoringPlace } = await import('../src/lib/db/queries/places');

  const allRows = await db.select().from(places);
  let anchorTotal = 0;
  let curveCount = 0;
  let denseTotal = 0;
  console.log(`=== places: ${allRows.length} rows ===`);
  for (const row of allRows) {
    const scoring = toScoringPlace(row);
    const curves = fitDestinationCurves(scoring);
    for (const curve of Object.values(curves)) {
      anchorTotal += curve.anchors.length;
      if (curve.anchors.length === 12) denseTotal++;
    }
    curveCount += Object.keys(curves).length;
    if (!dryRun) {
      await db.update(places).set({ sliderCurves: curves }).where(eq(places.id, row.id));
    }
  }
  console.log(
    `${dryRun ? '[dry-run] would set' : 'set'} sliderCurves on ${allRows.length} rows — ` +
      `${curveCount} curves total, mean ${(anchorTotal / curveCount).toFixed(2)} anchors/curve, ` +
      `${denseTotal} needed the 12-anchor dense fallback.`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
