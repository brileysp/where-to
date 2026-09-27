import { readFileSync } from 'fs';
import { join } from 'path';
import { SLIDERS } from '../src/lib/scoring/constants';
import { deriveDestinationScores, isSliderNA } from '../src/lib/scoring/destinations';
import { fitMonthlyToCurve } from '../src/lib/scoring/fitCurve';
import { crowdsScore, curveValue, dealsScore, type SliderCurve } from '../src/lib/scoring/curve';
import type { ScoringDestination } from '../src/lib/scoring/types';

/**
 * Migration Phase 3: "New evaluator runs alongside the old formula; assert
 * its output matches today's for all 200 x 53" — see
 * docs/scoring-v2-proposal.html's Migration section. This is that gate, run
 * against the real database rather than synthetic data, in two genuinely
 * different senses:
 *
 * PART A — curve-fit parity (a correctness check; should be ~zero always).
 * For every non-N/A, non-derived slider, fit a SliderCurve to the current
 * formula's 12 monthly values (Phase 2's fitMonthlyToCurve) and diff the new
 * evaluator's output against the old formula's output, month by month. A
 * real discrepancy here means the fit or the evaluator has a bug — this
 * should never fire given fitCurve.ts's own tolerance guarantee, and this
 * script exists specifically to keep proving that as both files evolve,
 * not just to have proved it once in a one-off exploration script.
 *
 * PART B — crowds/deals: old formula vs. the new derived formula (a content
 * question, not a bug report). `deals`/`crowds` are excluded from Part A on
 * purpose — under the new design they're computed from every OTHER slider's
 * curve (crowdsScore/dealsScore in curve.ts), not authored or fitted
 * per-destination, so there is no "should match exactly" claim to check.
 * Real, sometimes large differences here are the expected, useful output:
 * they're the first real evidence of whether the new crowds/deals formula
 * actually tracks the same real-world "busy season" intuition the old
 * peak/low-month flags did, for destinations a human can sanity-check.
 *
 * Place migration Phase 6 completed (2026-09-07): `destinations` no longer
 * exists — reads `places` and computes the "old formula" comparison
 * baseline directly via deriveDestinationScores (still exported,
 * intentionally kept as the same-day rollback and as curve-fitting's own
 * source), rather than through a live read path that no longer uses it.
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
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnvLocal();

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Matches fitCurve.ts's own ERROR_TOLERANCE — a real discrepancy above this
// in Part A means fitting or evaluation diverged, not floating-point noise.
const PARITY_TOLERANCE = 0.5;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL found in .env.local — refusing to run this audit against the PGlite fallback.');
    process.exit(1);
  }

  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { toScoringPlace } = await import('../src/lib/db/queries/places');

  const rows = await db.select().from(places);
  const dests = rows.map((row) => {
    const scoring: ScoringDestination = toScoringPlace(row);
    const { monthly } = deriveDestinationScores(scoring); // the OLD formula, on purpose — this is the comparison baseline
    return { ...scoring, monthly };
  });
  const fittableSliders = SLIDERS.filter((s) => s.key !== 'deals' && s.key !== 'crowds');

  // --- Part A: curve-fit parity ---
  let curvesChecked = 0;
  let anchorsTotal = 0;
  let denseCount = 0;
  const parityFailures: Array<{ dest: string; slider: string; month: string; old: number; fitted: number }> = [];

  // Also build, per destination, the fitted SliderCurve for every fittable
  // slider — Part B needs these to compute the NEW crowdsScore, which reads
  // every other slider's curve, not just deals/crowds' own (nonexistent) one.
  const fittedCurvesByDest = new Map<string, Record<string, SliderCurve>>();
  const naSlidersByDest = new Map<string, string[]>();

  for (const d of dests) {
    const curves: Record<string, SliderCurve> = {};
    const na: string[] = [];
    for (const s of fittableSliders) {
      if (isSliderNA(d, s.key)) {
        na.push(s.key);
        continue;
      }
      const monthly = d.monthly[s.key];
      if (!monthly) continue;
      curvesChecked++;
      const fit = fitMonthlyToCurve(monthly);
      anchorsTotal += fit.anchorCount;
      if (fit.usedDenseFallback) denseCount++;
      curves[s.key] = fit.curve;
      for (let m = 1; m <= 12; m++) {
        const fitted = curveValue(m, fit.curve);
        const diff = Math.abs(fitted - monthly[m - 1]);
        if (diff > PARITY_TOLERANCE) {
          parityFailures.push({ dest: d.id, slider: s.key, month: MONTH_NAMES[m - 1], old: monthly[m - 1], fitted });
        }
      }
    }
    fittedCurvesByDest.set(d.id, curves);
    naSlidersByDest.set(d.id, na);
  }

  console.log('=== Part A: curve-fit parity (correctness check) ===');
  console.log(`curves checked: ${curvesChecked}`);
  console.log(`mean anchors per curve: ${(anchorsTotal / curvesChecked).toFixed(2)}`);
  console.log(`dense-fallback (12-anchor) curves: ${denseCount} (${((denseCount / curvesChecked) * 100).toFixed(2)}%)`);
  if (parityFailures.length === 0) {
    console.log(`PASS — every fitted curve matches the old formula's output within ${PARITY_TOLERANCE} across all 12 months.`);
  } else {
    console.log(`FAIL — ${parityFailures.length} month-level discrepancies above tolerance:`);
    for (const f of parityFailures.slice(0, 30)) {
      console.log(`  ${f.dest} / ${f.slider} / ${f.month}: old=${f.old} fitted=${f.fitted.toFixed(3)}`);
    }
    if (parityFailures.length > 30) console.log(`  ... and ${parityFailures.length - 30} more`);
  }

  // --- Part B: crowds/deals, old formula vs. new derived formula ---
  const diffs: Array<{ dest: string; slider: 'crowds' | 'deals'; month: string; old: number; next: number; diff: number }> = [];

  for (const d of dests) {
    if (isSliderNA(d, 'crowds') && isSliderNA(d, 'deals')) continue;
    const curves = fittedCurvesByDest.get(d.id)!;
    const na = naSlidersByDest.get(d.id)!;
    for (let m = 1; m <= 12; m++) {
      const newCrowds = crowdsScore(curves, na, m);
      const newDeals = dealsScore(curves, na, m);
      if (!isSliderNA(d, 'crowds')) {
        const oldCrowds = d.monthly.crowds[m - 1];
        diffs.push({ dest: d.id, slider: 'crowds', month: MONTH_NAMES[m - 1], old: oldCrowds, next: newCrowds, diff: newCrowds - oldCrowds });
      }
      if (!isSliderNA(d, 'deals')) {
        const oldDeals = d.monthly.deals[m - 1];
        diffs.push({ dest: d.id, slider: 'deals', month: MONTH_NAMES[m - 1], old: oldDeals, next: newDeals, diff: newDeals - oldDeals });
      }
    }
  }

  const absDiffs = diffs.map((d) => Math.abs(d.diff)).sort((a, b) => a - b);
  const mean = absDiffs.reduce((s, v) => s + v, 0) / absDiffs.length;
  const median = absDiffs[Math.floor(absDiffs.length / 2)];
  const p90 = absDiffs[Math.floor(absDiffs.length * 0.9)];
  const bigDiffs = diffs.filter((d) => Math.abs(d.diff) >= 4).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  console.log('\n=== Part B: crowds/deals — old formula vs. new derived formula (content review, not a bug list) ===');
  console.log(`month-level comparisons: ${diffs.length}`);
  console.log(`mean |diff|: ${mean.toFixed(2)}  median |diff|: ${median.toFixed(2)}  p90 |diff|: ${p90.toFixed(2)} (0-10 scale)`);
  console.log(`comparisons with |diff| >= 4 (a genuinely different read on the month): ${bigDiffs.length} (${((bigDiffs.length / diffs.length) * 100).toFixed(2)}%)`);
  console.log('\nLargest 20 disagreements — worth a human eyeballing whether the NEW read is the more honest one:');
  for (const d of bigDiffs.slice(0, 20)) {
    console.log(`  ${d.dest.padEnd(28)} ${d.slider.padEnd(7)} ${d.month}  old=${d.old.toFixed(1)}  new=${d.next.toFixed(1)}  diff=${d.diff >= 0 ? '+' : ''}${d.diff.toFixed(1)}`);
  }

  process.exit(parityFailures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
