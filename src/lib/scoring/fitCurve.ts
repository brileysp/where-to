import { curveValue, ease, parseSliderCurve, type SliderCurve } from './curve';
import { SLIDERS } from './constants';
import { deriveDestinationScores, isSliderNA } from './destinations';
import type { ScoringDestination } from './types';

/**
 * Migration Phase 2: fits a sparse SliderCurve to 12 already-computed monthly
 * values from the current formula engine (deriveDestinationScores). This is
 * the algorithm the design doc's Open Decisions flagged as unspecified —
 * "fit a sparse anchor set that reproduces the existing 12 values" was a
 * sentence, not code, until this file.
 *
 * `deals` and `crowds` are NOT fed through this: under the new design they're
 * derived at read time (crowdsScore/dealsScore in curve.ts), not authored
 * curves, so there is nothing to fit for them — see docs/scoring-v2-proposal.html
 * section 03.
 *
 * Algorithm, in one pass over real production data (200 destinations x 51
 * fittable sliders, 9,497 non-N/A curves): most real curves are flat
 * (47.8%) — the current formula's inputs are almost entirely boolean
 * month-flags (dry/wet/hot/cold/...), so non-flat curves are piecewise-
 * constant "block" shapes, not smooth ramps. That means the right fit is
 * usually a small number of anchors with HIGH steepness bracketing each
 * block, not a gentle curve through every point.
 *
 * Greedy, RDP-style growth: start from the global min and max months (the
 * curve's dominant swing), fit the best steepness for every arc via a grid
 * search, then repeatedly add the single worst-error month as a new anchor
 * until the fit is within tolerance. There's no separate sparsity budget or
 * "give up, go dense" branch — growth simply continues, one worst-error
 * month at a time, up to the natural ceiling of 12 (one anchor per month,
 * where error is trivially 0). Correctness is never traded away for
 * sparsity; a curve that genuinely needs most or all 12 months (real ones do
 * exist — see `usedDenseFallback` below) gets exactly that, reported rather
 * than hidden behind a smaller cap that would have forced silent truncation.
 */

export interface CurveFitResult {
  curve: SliderCurve;
  anchorCount: number;
  maxError: number;
  exact: boolean;
  /** True once this curve needed every month as its own anchor — a genuine
   * outcome for a handful of real curves, not a bug in the fit. */
  usedDenseFallback: boolean;
}

// Half a point on the 0-10 scale: the source values are the current
// formula's already-rounded output, so a fit within this tolerance rounds
// to the identical integer a human comparing "before" and "after" would see.
const ERROR_TOLERANCE = 0.5;
const STEEPNESS_CANDIDATES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Optional overrides used ONLY by one-off smoothing passes (see
 * scripts/smooth-curves.ts) — every existing call site (the live
 * write-time refit in admin/write.ts, backfill-slider-curves.ts) omits
 * `opts` entirely and gets byte-identical behavior to before this existed.
 *
 * The formula's real inputs are almost entirely boolean month-flags
 * (dry/wet/hot/cold/wildlifePeak/hikingBest/hikingWorst/...), so the 12
 * monthly values this function is handed are frequently genuinely
 * piecewise-constant. The default grid search (steepness up to 10, 0.5
 * tolerance) correctly minimizes error against that — but "correctly fit a
 * step function" and "look like a smooth, physically plausible season" are
 * different goals, and the default has always optimized for the first one.
 *
 * `maxSteepness` narrows the grid search, so the algorithm can no longer
 * bridge a real transition with a near-vertical ease — it has to either
 * represent an intermediate month more honestly or add it as its own
 * anchor. `errorTolerance` loosens how exactly the fit must reproduce the
 * source values, since insisting on exact reproduction of a value that
 * shouldn't have existed as a hard edge in the first place just pushes the
 * algorithm to add anchors it doesn't need for a curve to look right.
 */
export interface FitOptions {
  maxSteepness?: number;
  errorTolerance?: number;
}

interface CandidateAnchor {
  month: number;
  value: number;
  steepness: number;
}

// A local copy of curveValue's bracket-and-ease math, used only during the
// search below. Real, branded SliderCurves aren't in play yet at this point
// — the algorithm is still choosing between many transient candidate anchor
// sets, and re-running full zod validation on every one of them (thousands
// per real curve, across 9,497 curves) would be pure overhead for data that
// never leaves this function. The final answer is never trusted from this
// path: fitMonthlyToCurve always constructs the real SliderCurve via
// parseSliderCurve and re-measures error with the authoritative curveValue
// before returning, so a divergence here could only make the search pick a
// slightly worse anchor set — never report a wrong error for the one it did.
function evalCandidate(anchors: CandidateAnchor[], month: number): number {
  if (anchors.length === 1) return anchors[0].value;
  const sorted = [...anchors].sort((a, b) => a.month - b.month);
  for (let i = 0; i < sorted.length; i++) {
    const A = sorted[i];
    const B = sorted[(i + 1) % sorted.length];
    let spanAB = B.month - A.month;
    if (spanAB <= 0) spanAB += 12;
    let spanAm = month - A.month;
    if (spanAm < 0) spanAm += 12;
    if (spanAm <= spanAB) {
      const t = spanAm / spanAB;
      return A.value + (B.value - A.value) * ease(t, B.steepness);
    }
  }
  throw new Error('evalCandidate: no bracketing anchors found — internal invariant violated');
}

function computeMaxError(anchors: CandidateAnchor[], monthly: number[]): number {
  let maxErr = 0;
  for (let m = 1; m <= 12; m++) {
    maxErr = Math.max(maxErr, Math.abs(evalCandidate(anchors, m) - monthly[m - 1]));
  }
  return maxErr;
}

/** Best steepness (by sum-of-squared-error grid search) for the transition
 * arriving at B, given the actual values at every intermediate month.
 * `maxSteepness` narrows the candidate list — see FitOptions. */
function fitBestSteepnessForArc(A: { month: number; value: number }, B: { month: number; value: number }, monthly: number[], maxSteepness: number): number {
  let spanAB = B.month - A.month;
  if (spanAB <= 0) spanAB += 12;
  if (spanAB <= 1) return Math.min(2, maxSteepness); // no intermediate month to fit against — default is fine
  let bestK = Math.min(2, maxSteepness);
  let bestErr = Infinity;
  for (const k of STEEPNESS_CANDIDATES) {
    if (k > maxSteepness) break; // candidates are ascending — nothing further qualifies
    let err = 0;
    for (let step = 1; step < spanAB; step++) {
      const m = ((A.month - 1 + step) % 12) + 1;
      const t = step / spanAB;
      const predicted = A.value + (B.value - A.value) * ease(t, k);
      err += (predicted - monthly[m - 1]) ** 2;
    }
    if (err < bestErr) {
      bestErr = err;
      bestK = k;
    }
  }
  return bestK;
}

function fitAnchorsForMonths(months: number[], monthly: number[], maxSteepness: number): CandidateAnchor[] {
  const sortedMonths = [...months].sort((a, b) => a - b);
  const n = sortedMonths.length;
  const values = sortedMonths.map((m) => monthly[m - 1]);
  return sortedMonths.map((month, i) => {
    const prevIdx = (i - 1 + n) % n;
    const A = { month: sortedMonths[prevIdx], value: values[prevIdx] };
    const B = { month, value: values[i] };
    return { month, value: values[i], steepness: fitBestSteepnessForArc(A, B, monthly, maxSteepness) };
  });
}

export function fitMonthlyToCurve(monthly: number[], opts?: FitOptions): CurveFitResult {
  if (monthly.length !== 12) {
    throw new Error(`fitMonthlyToCurve: expected exactly 12 monthly values, got ${monthly.length}`);
  }
  const maxSteepness = opts?.maxSteepness ?? 10;
  const errorTolerance = opts?.errorTolerance ?? ERROR_TOLERANCE;

  if (monthly.every((v) => Math.abs(v - monthly[0]) < 1e-9)) {
    const curve = parseSliderCurve({ anchors: [{ month: 1, value: monthly[0] }] });
    return { curve, anchorCount: 1, maxError: 0, exact: true, usedDenseFallback: false };
  }

  let maxIdx = 0;
  let minIdx = 0;
  for (let i = 1; i < 12; i++) {
    if (monthly[i] > monthly[maxIdx]) maxIdx = i;
    if (monthly[i] < monthly[minIdx]) minIdx = i;
  }
  // Seed every DISTINCT month or run of months tied with the global max or
  // min, not just the first occurrence a strict `>`/`<` scan keeps. A
  // destination with two separate tied peak months (a spring and an autumn
  // shoulder season both at the true annual max — a genuinely common
  // shape) had its second occurrence anchored only as an accident of the
  // growth loop needing to hit tolerance, never guaranteed by construction.
  // Found via a real regression: Zion's scenicLandscapes was 9.0 in both
  // April and October; a smoothing pass with a slightly loosened tolerance
  // judged 8.3 "close enough" for October since only April was ever pinned
  // as an anchor, and losing 0.7 points at exactly its tied-best month
  // flipped which month won the default ranking.
  //
  // Anchoring is done per contiguous RUN, not per month: a long flat block
  // at the tied value (a genuine, common shape — six months of identical
  // "high season") only needs its two boundary months anchored, since
  // curveValue trivially stays flat between two equal-valued anchors
  // regardless of steepness. Anchoring every interior month of such a run
  // is pure waste — an earlier version of this fix did exactly that and
  // pushed a simple two-block seasonal curve from ~2-4 anchors to a full
  // 12, for zero accuracy gain.
  // Not seeded from [maxIdx+1, minIdx+1] directly — maxIdx/minIdx are found
  // by a strict scan that keeps the FIRST occurrence, which can land on an
  // INTERIOR month of a longer run tied at that value (e.g. a circular min
  // run wrapping December into January, found at whichever month the scan
  // reaches first). seedRunsAt below finds every run's actual boundaries
  // for both target values, which is a strict superset of the single month
  // this line would have added — including it too just risked adding a
  // redundant interior anchor.
  const anchorMonths = new Set<number>();
  const EPSILON = 1e-9;
  const seedRunsAt = (target: number) => {
    for (let i = 0; i < 12; i++) {
      if (Math.abs(monthly[i] - target) >= EPSILON) continue;
      const prev = (i - 1 + 12) % 12;
      const next = (i + 1) % 12;
      const prevTied = Math.abs(monthly[prev] - target) < EPSILON;
      const nextTied = Math.abs(monthly[next] - target) < EPSILON;
      // Only a run's start or end (or an isolated single month, both at
      // once) needs its own anchor.
      if (!prevTied || !nextTied) anchorMonths.add(i + 1);
    }
  };
  seedRunsAt(monthly[maxIdx]);
  seedRunsAt(monthly[minIdx]);

  let finalAnchors: CandidateAnchor[];

  for (;;) {
    const anchors = fitAnchorsForMonths([...anchorMonths], monthly, maxSteepness);
    const err = computeMaxError(anchors, monthly);
    // anchorMonths.size === 12 is a guaranteed exit: every month is then its
    // own anchor, so err is trivially 0. There is no separate "give up and
    // go dense" branch — growing all the way to one-anchor-per-month IS the
    // dense case, reached by the same mechanism as every sparser fit, not a
    // special-cased fallback with its own logic to keep in sync.
    if (err <= errorTolerance || anchorMonths.size === 12) {
      finalAnchors = anchors;
      break;
    }
    let worstMonth = -1;
    let worstErr = -1;
    for (let m = 1; m <= 12; m++) {
      if (anchorMonths.has(m)) continue;
      const e = Math.abs(evalCandidate(anchors, m) - monthly[m - 1]);
      if (e > worstErr) {
        worstErr = e;
        worstMonth = m;
      }
    }
    anchorMonths.add(worstMonth);
  }

  const curve = parseSliderCurve({ anchors: finalAnchors.map(({ month, value, steepness }) => ({ month, value, steepness })) });
  // Re-measure with the real, authoritative evaluator — never trust the
  // search's own local copy of the math for the reported result.
  let maxError = 0;
  for (let m = 1; m <= 12; m++) {
    maxError = Math.max(maxError, Math.abs(curveValue(m, curve) - monthly[m - 1]));
  }
  return {
    curve,
    anchorCount: finalAnchors.length,
    maxError,
    exact: maxError <= ERROR_TOLERANCE,
    usedDenseFallback: finalAnchors.length === 12,
  };
}

const FITTABLE_SLIDERS = SLIDERS.filter((s) => s.key !== 'deals' && s.key !== 'crowds');

/**
 * Fits every non-N/A slider's curve for one destination in one pass —
 * exactly the per-row logic scripts/backfill-slider-curves.ts uses, pulled
 * out here so the live write-time refit (lib/admin/write.ts) and the
 * standalone backfill script share one implementation instead of two
 * hand-kept-in-sync copies. Always fits against `{ skipHazards: true }`
 * monthly output — see the doc comment on deriveDestinationScores's
 * `opts.skipHazards` for why hazards must stay excluded from the fit.
 */
export function fitDestinationCurves(scoring: ScoringDestination): Record<string, SliderCurve> {
  const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
  const curves: Record<string, SliderCurve> = {};
  for (const s of FITTABLE_SLIDERS) {
    if (isSliderNA(scoring, s.key)) continue;
    const values = monthly[s.key];
    if (!values) continue;
    curves[s.key] = fitMonthlyToCurve(values).curve;
  }
  return curves;
}
