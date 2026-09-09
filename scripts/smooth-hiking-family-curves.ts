import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve } from '../src/lib/scoring/curve';

/**
 * Track A of the curve-smoothness fix (see audit-curve-smoothness.ts):
 * mechanical, one script, no content decisions, scoped to the family that
 * dominated that audit by roughly 25x over anything else.
 *
 * These 15 sliders share one formula (destinations.ts's `case 'hiking'`)
 * built almost entirely from boolean month-flags — hikingBest/hikingWorst,
 * dry/wet/hot/cold. That produces genuinely piecewise-constant monthly
 * values, and fitCurve.ts's Phase 2 fitter was explicitly built to
 * reproduce those values faithfully — so it correctly, and unhelpfully,
 * reaches for maximum steepness (a near-vertical ease) to bridge each
 * block exactly, whenever that is the fastest way to clear its 0.5-point
 * tolerance. curve.ts's own comment says what that produces: "the curve
 * has effectively become a step function."
 *
 * This does NOT re-derive scores from the raw formula. It takes each
 * destination's CURRENT rendered monthly values for these 15 sliders —
 * which already reflect a full session of editorial work (saturation
 * demotions, anchor-set ceilings, the hiking-inflation deflation pass) —
 * and re-fits a SMOOTHER curve that reproduces those same values, via the
 * FitOptions added to fitMonthlyToCurve for exactly this purpose. Every
 * month's value is preserved within tolerance; only how the curve gets
 * between them changes. Nothing here re-ranks anything.
 *
 * Parameters were chosen empirically (see the tuning sweep in the PR/commit
 * this shipped in): maxSteepness 4 eliminates every steepness>=7 anchor
 * across all 2,057 non-flat hiking-family curves in the catalogue, and
 * errorTolerance 0.75 keeps mean anchor count at 7.0 — actually slightly
 * BELOW the unconstrained default's 7.3, so this is not "more anchors to
 * compensate," it is the algorithm choosing gentler eases at essentially
 * no added complexity.
 *
 * No hiking-family curve in this codebase's history has ever been
 * hand-drawn with genuine multi-anchor judgment — every touch on record
 * (review-scenic-saturation, review-parks-hiking-saturation,
 * fix-hiking-inflation, apply-interest-anchors, cap-landscape-photography,
 * the admin MatrixGrid Min/Max cell) only ever calls rescaleCurve, which
 * preserves the ORIGINAL formula-fit's shape while moving the ceiling or
 * floor. So there is no "hand-authored, skip" set to carve out here the
 * way sunbathing needed one — every non-flat curve in scope is eligible.
 *
 * Marks authoredCurves for anything it touches, same as every other
 * shape-changing script this session — see write.ts's refit guard: without
 * it, the very next unrelated admin edit to that destination would
 * silently regenerate the original stepped curve from the raw formula.
 */

const HIKING_FAMILY = [
  'hiking', 'mountaineering', 'cyclingRoad', 'mountainBiking', 'adventureSports',
  'golf', 'fishing', 'horsebackRiding', 'trailRunning', 'scenicLandscapes',
  'landscapePhotography', 'nationalParks', 'campingBackcountry', 'geologyVolcanoes',
  'roadtrip',
];

const MAX_STEEPNESS = 4;
const ERROR_TOLERANCE = 0.75;

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = value;
  }
  return out;
}

function maxSteepnessOf(curve: { anchors: { steepness?: number }[] }): number {
  return Math.max(2, ...curve.anchors.map((a) => a.steepness ?? 2));
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  let touched = 0;
  let skippedFlat = 0;
  let skippedAlreadySmooth = 0;
  const perSlider: Record<string, number> = {};
  let maxStepBefore = 0;
  let hardStepsBefore = 0;
  let hardStepsAfter = 0;

  for (const d of scored) {
    const row = byId.get(d.id);
    if (!row) continue;
    let rowCurves: Record<string, unknown> | null = null;

    for (const key of HIKING_FAMILY) {
      if (isSliderNA(d, key)) continue;
      const monthly = d.monthly[key];
      if (!monthly || monthly.length !== 12) continue;
      if (monthly.every((v) => Math.abs(v - monthly[0]) < 1e-9)) { skippedFlat++; continue; }

      const rawExisting = (row.sliderCurves as Record<string, unknown>)[key];
      const existingSteepness = rawExisting ? maxSteepnessOf(parseSliderCurve(rawExisting)) : 0;
      if (existingSteepness >= 7) hardStepsBefore++;
      maxStepBefore = Math.max(maxStepBefore, existingSteepness);

      if (existingSteepness < MAX_STEEPNESS) { skippedAlreadySmooth++; continue; }

      const fit = fitMonthlyToCurve(monthly, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
      const newSteepness = maxSteepnessOf(fit.curve);
      if (newSteepness >= 7) hardStepsAfter++; // shouldn't happen given MAX_STEEPNESS, kept as a tripwire

      if (!rowCurves) rowCurves = { ...(row.sliderCurves as Record<string, unknown>) };
      rowCurves[key] = fit.curve;
      perSlider[key] = (perSlider[key] ?? 0) + 1;
      touched++;
    }

    if (rowCurves) {
      const authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), ...Object.keys(rowCurves).filter((k) => HIKING_FAMILY.includes(k))]));
      const patch = { sliderCurves: rowCurves, authoredCurves };
      const after = { ...row, ...patch };
      if (!dryRun) {
        await db.transaction(async (tx) => {
          await tx.update(places)
            .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
            .where(eq(places.id, d.id));
          await tx.insert(adminAuditLog).values({
            actorId: '00000000-0000-0000-0000-000000000000',
            entityType: 'destination',
            entityId: d.id,
            action: 'update',
            beforeValue: row,
            afterValue: after,
          });
        });
      }
      byId.set(d.id, after as typeof row);
    }
  }

  console.log('Curves smoothed per slider:');
  for (const [key, n] of Object.entries(perSlider).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(22)} ${n}`);
  }
  console.log(`\n${touched} curves re-fit across ${new Set(scored.map((d) => d.id)).size} destinations.`);
  console.log(`Skipped: ${skippedFlat} flat (nothing to smooth), ${skippedAlreadySmooth} already under the steepness ceiling.`);
  console.log(`Hard steps (steepness >= 7) before: ${hardStepsBefore}. After: ${hardStepsAfter} (should be 0 — MAX_STEEPNESS=${MAX_STEEPNESS} guarantees it).`);
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
