import { describe, expect, it } from 'vitest';
import { parseSliderCurve, rescaleCurve, curveValue } from '@/lib/scoring/curve';

const curve = (anchors: Array<{ month: number; value: number; steepness?: number }>) =>
  parseSliderCurve({ anchors });

describe('rescaleCurve', () => {
  it('moves both ends to the requested range', () => {
    const c = rescaleCurve(curve([{ month: 1, value: 4 }, { month: 7, value: 10 }]), 4, 7);
    expect(c.anchors.map((a) => a.value)).toEqual([4, 7]);
  });

  it('preserves the shape between the ends', () => {
    // A midpoint anchor must stay at the same relative height: 6 sits
    // halfway between 4 and 8, so it stays halfway between the new bounds.
    const c = rescaleCurve(
      curve([{ month: 1, value: 4 }, { month: 4, value: 6 }, { month: 7, value: 8 }]),
      0,
      10,
    );
    expect(c.anchors.map((a) => a.value)).toEqual([0, 5, 10]);
  });

  it('keeps peak months where they are — the Nova Scotia case', () => {
    // base 4 with a whale-season bonus to 10 in Jul-Sep. Lowering the
    // ceiling to 7 must not move the season, only flatten the spike.
    const before = curve([
      { month: 1, value: 4 }, { month: 7, value: 10 }, { month: 9, value: 10 }, { month: 11, value: 4 },
    ]);
    const after = rescaleCurve(before, 4, 7);
    expect(after.anchors.map((a) => a.month)).toEqual([1, 7, 9, 11]);
    expect(after.anchors.map((a) => a.value)).toEqual([4, 7, 7, 4]);
    expect(curveValue(8, after)).toBeLessThan(curveValue(8, before));
    expect(curveValue(1, after)).toBeCloseTo(curveValue(1, before), 5);
  });

  it('preserves steepness, which carries the shape between anchors', () => {
    const c = rescaleCurve(curve([{ month: 1, value: 2, steepness: 6 }, { month: 6, value: 9 }]), 1, 5);
    expect(c.anchors[0].steepness).toBe(6);
  });

  it('leaves a flat curve flat rather than inventing a season', () => {
    // No internal shape to spread across a range. Choosing which months
    // should peak is the anchor editor's job, not a rescale's.
    const c = rescaleCurve(curve([{ month: 1, value: 10 }, { month: 6, value: 10 }]), 10, 7);
    expect(c.anchors.map((a) => a.value)).toEqual([7, 7]);
  });

  it('clamps to the 0-10 scale and tolerates reversed bounds', () => {
    const c = rescaleCurve(curve([{ month: 1, value: 2 }, { month: 7, value: 8 }]), 12, -3);
    expect(c.anchors.map((a) => a.value)).toEqual([0, 10]);
  });

  it('returns a validated curve, so a bad rescale fails loudly here', () => {
    // parseSliderCurve is the only sanctioned way to obtain a SliderCurve;
    // rescale going through it means an out-of-range result throws at the
    // point of the mistake rather than corrupting jsonb silently.
    expect(() => rescaleCurve(curve([{ month: 1, value: 5 }]), Number.NaN, 8)).toThrow();
  });

  it('is idempotent when the range is unchanged', () => {
    const before = curve([{ month: 2, value: 3 }, { month: 8, value: 9 }]);
    expect(rescaleCurve(before, 3, 9).anchors).toEqual(before.anchors);
  });
});
