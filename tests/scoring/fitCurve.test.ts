import { describe, expect, it } from 'vitest';
import { curveValue } from '@/lib/scoring/curve';
import { fitMonthlyToCurve } from '@/lib/scoring/fitCurve';

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function reconstruct(monthly: number[]) {
  const result = fitMonthlyToCurve(monthly);
  const out: number[] = [];
  for (let m = 1; m <= 12; m++) out.push(curveValue(m, result.curve));
  return { result, reconstructed: out };
}

describe('fitMonthlyToCurve', () => {
  it('rejects an input that is not exactly 12 months', () => {
    expect(() => fitMonthlyToCurve([1, 2, 3])).toThrow(/exactly 12/);
  });

  it('fits a flat curve to a single anchor, exactly', () => {
    const result = fitMonthlyToCurve(new Array(12).fill(6));
    expect(result.anchorCount).toBe(1);
    expect(result.maxError).toBe(0);
    expect(result.exact).toBe(true);
    expect(result.usedDenseFallback).toBe(false);
    expect(result.curve.anchors).toEqual([{ month: 1, value: 6 }]);
  });

  it('refits a curve that is already an exact member of the anchor family with very few anchors', () => {
    // Built directly from a known 2-anchor curve — the family this fits
    // into by construction, so this should recover close to 2 anchors with
    // ~zero error, not need the dense fallback.
    const known = [9, 8.692307692307692, 7.4, 5, 2.6, 1.3076923076923077, 1, 1.3076923076923077, 2.6, 5, 7.4, 8.692307692307693];
    const { result, reconstructed } = reconstruct(known);
    expect(result.anchorCount).toBeLessThanOrEqual(3);
    expect(result.maxError).toBeLessThan(0.01);
    for (let i = 0; i < 12; i++) expect(reconstructed[i]).toBeCloseTo(known[i], 1);
  });

  it('every anchor the fit produces evaluates to exactly its own authored value', () => {
    const monthly = [2, 6, 6, 6, 9, 9, 6, 6, 9, 6, 6, 2]; // a real destination's curve
    const result = fitMonthlyToCurve(monthly);
    for (const a of result.curve.anchors) {
      expect(curveValue(a.month, result.curve)).toBe(a.value);
    }
  });

  it('never needs more than 12 anchors, and 12 anchors is always exact', () => {
    // A maximally adversarial curve for this family: alternates every month.
    const monthly = [0, 10, 0, 10, 0, 10, 0, 10, 0, 10, 0, 10];
    const { result, reconstructed } = reconstruct(monthly);
    expect(result.anchorCount).toBeLessThanOrEqual(12);
    expect(result.exact).toBe(true);
    expect(result.maxError).toBeLessThanOrEqual(0.5);
    for (let i = 0; i < 12; i++) expect(Math.abs(reconstructed[i] - monthly[i])).toBeLessThanOrEqual(0.5);
  });

  // Regression fixtures pulled directly from real destinations via
  // getAllScoredDestinations() during Phase 2 development — see the
  // migration section of docs/scoring-v2-proposal.html for the full
  // 9,497-curve sweep this is a sample of.
  describe('regression fixtures from real destination data', () => {
    const fixtures: Array<[string, number[]]> = [
      ['black-forest / hiking', [2, 6, 6, 6, 9, 9, 6, 6, 9, 6, 6, 2]],
      ['marlborough-abel-tasman / scenicLandscapes', [9, 9, 10, 10, 8, 8, 4, 8, 8, 10, 10, 8]],
      ['quebec-city / festivals', [7, 10, 7, 7, 7, 8, 9, 8, 8, 7, 7, 9]],
      ['budapest / scenicLandscapes (needs the dense fallback)', [0, 0, 4, 4, 7, 7, 4, 4, 7, 4, 4, 0]],
      ['rioja / scenicLandscapes (needs the dense fallback)', [2, 2, 6, 6, 9, 9, 2, 2, 9, 6, 6, 2]],
    ];
    for (const [label, monthly] of fixtures) {
      it(`fits ${label} within tolerance`, () => {
        const { result, reconstructed } = reconstruct(monthly);
        expect(result.exact).toBe(true);
        for (let i = 0; i < 12; i++) expect(Math.abs(reconstructed[i] - monthly[i])).toBeLessThanOrEqual(0.5);
      });
    }
  });
});

describe('fitMonthlyToCurve — tied extremes are always anchored', () => {
  // Regression for a real bug found smoothing hiking-family curves: Zion's
  // scenicLandscapes was 9.0 in both April and October, two isolated
  // single-month peaks. Only anchoring the first occurrence let a loosened
  // (but still within-tolerance) fit render October as 8.3 — the tie was
  // never guaranteed, only accidentally preserved by how tight the default
  // tolerance happened to be. That flipped which month won the default
  // ranking for the destination.
  it('preserves two separate isolated months tied at the global max, even under a loose tolerance', () => {
    // Zion-Bryce's real (pre-fix) scenicLandscapes curve, pulled from the
    // admin audit log's beforeValue for the smoothing write that broke
    // this — not a hand-guessed shape. April and October are both
    // genuinely 9.0; the dip through July/August is real too.
    const monthly = [2.7, 7.7, 8.35, 9, 8.35, 7.7, 2.310006604572396, 2.505, 8.99997798475868, 9, 7.7, 2.7];
    const result = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.75 });
    expect(curveValue(4, result.curve)).toBeCloseTo(9.0, 5);
    expect(curveValue(10, result.curve)).toBeCloseTo(9.0, 5);
  });

  it('does not blow up anchor count for a long flat run merely because it ties the extreme', () => {
    // A single contiguous high season — only the block's two boundary
    // months should need anchoring, not every month inside it.
    const monthly = [2, 2, 2, 9, 9, 9, 9, 9, 9, 2, 2, 2];
    const result = fitMonthlyToCurve(monthly);
    expect(result.anchorCount).toBeLessThanOrEqual(4);
    expect(result.exact).toBe(true);
  });

  it('anchors both sides of a max run that wraps across December-January', () => {
    const monthly = [9, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9]; // Dec (idx 11) and Jan (idx 0) tied, adjacent
    const result = fitMonthlyToCurve(monthly);
    expect(curveValue(12, result.curve)).toBeCloseTo(9, 5);
    expect(curveValue(1, result.curve)).toBeCloseTo(9, 5);
    // December and January are adjacent and tied, but they still need
    // independent anchors: each interfaces with a DIFFERENT low-side
    // neighbor (November vs. February) on its far side, so collapsing them
    // into one anchor would make one of the two arcs span 2 months instead
    // of 1 and lose the guarantee. Four is the true minimum here — the two
    // ends of the max run plus the two ends of the min run in between.
    expect(result.anchorCount).toBeLessThanOrEqual(4);
  });
});

describe('fitMonthlyToCurve — FitOptions (smoothing overrides)', () => {
  // These options exist for scripts/smooth-curves.ts, which re-fits stored
  // curves with a lower steepness ceiling so the old formula's boolean
  // month-flags stop producing near-vertical anchors. Every existing call
  // site omits `opts`, so the first thing to pin is that omitting it is
  // byte-identical to the pre-FitOptions behavior.
  const monthly = [2, 6, 6, 6, 9, 9, 6, 6, 9, 6, 6, 2]; // the same real fixture as above

  it('omitting opts reproduces the exact default-behavior curve', () => {
    const withDefaults = fitMonthlyToCurve(monthly);
    const withEmptyOpts = fitMonthlyToCurve(monthly, {});
    expect(withEmptyOpts.curve).toEqual(withDefaults.curve);
  });

  it('maxSteepness caps every anchor at or below the given value', () => {
    const result = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 1 });
    for (const a of result.curve.anchors) {
      expect(a.steepness ?? 2).toBeLessThanOrEqual(4);
    }
  });

  it('a tight maxSteepness with the default tolerance still respects the cap, adding anchors instead of exceeding it', () => {
    // A hard adversarial case for a low ceiling: alternates every month, so
    // the unconstrained fit reaches for maximum steepness on short arcs.
    const spiky = [0, 10, 0, 10, 0, 10, 0, 10, 0, 10, 0, 10];
    const result = fitMonthlyToCurve(spiky, { maxSteepness: 3 });
    for (const a of result.curve.anchors) {
      expect(a.steepness ?? 2).toBeLessThanOrEqual(3);
    }
    // Still has to land within the (unrelaxed) default tolerance somehow —
    // capping steepness must never silently produce a worse-than-promised
    // fit, only spend more anchors to make up for the lost steepness.
    expect(result.maxError).toBeLessThanOrEqual(0.5);
  });

  it('errorTolerance alone (no steepness cap) can shrink the anchor count for a near-step curve', () => {
    const nearStep = [2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2];
    const loose = fitMonthlyToCurve(nearStep, { errorTolerance: 2 });
    const strict = fitMonthlyToCurve(nearStep);
    expect(loose.anchorCount).toBeLessThanOrEqual(strict.anchorCount);
  });
});

describe('fitMonthlyToCurve — property fuzzing over random monthly arrays', () => {
  it('always produces a curve within tolerance, using at most 12 anchors, in reasonable time', () => {
    const rand = mulberry32(9001);
    for (let i = 0; i < 500; i++) {
      const monthly = Array.from({ length: 12 }, () => Math.round(rand() * 10));
      const { result, reconstructed } = reconstruct(monthly);
      expect(result.anchorCount).toBeGreaterThanOrEqual(1);
      expect(result.anchorCount).toBeLessThanOrEqual(12);
      expect(result.exact).toBe(true);
      for (let m = 0; m < 12; m++) expect(Math.abs(reconstructed[m] - monthly[m])).toBeLessThanOrEqual(0.5);
    }
  });

  it('a capped maxSteepness still terminates and respects both the cap and the default tolerance, over random data', () => {
    const rand = mulberry32(1234);
    for (let i = 0; i < 200; i++) {
      const monthly = Array.from({ length: 12 }, () => Math.round(rand() * 10));
      const result = fitMonthlyToCurve(monthly, { maxSteepness: 4 });
      expect(result.anchorCount).toBeLessThanOrEqual(12);
      for (const a of result.curve.anchors) expect(a.steepness ?? 2).toBeLessThanOrEqual(4);
      expect(result.maxError).toBeLessThanOrEqual(0.5);
    }
  });

  it('a curve with only two distinct values (a simple high/low season) fits sparsely', () => {
    const rand = mulberry32(4242);
    for (let i = 0; i < 200; i++) {
      const lo = Math.round(rand() * 5);
      const hi = lo + 1 + Math.round(rand() * (10 - lo - 1));
      const splitAt = 1 + Math.floor(rand() * 10);
      const monthly = Array.from({ length: 12 }, (_, m) => (m < splitAt ? hi : lo));
      const result = fitMonthlyToCurve(monthly);
      expect(result.anchorCount).toBeLessThanOrEqual(4);
      expect(result.exact).toBe(true);
    }
  });
});
