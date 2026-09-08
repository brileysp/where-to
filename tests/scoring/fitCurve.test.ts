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
