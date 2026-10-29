import { describe, expect, it } from 'vitest';
import { PLANNING_KEYS, effortBand, isPlanningScore, placeSwingFlags, reviewCadence, reviewWorkload, seasonalBand, stakesBand, swingOf } from '@/lib/scoring/planning';

describe('planning scores', () => {
  it('maps seasonal variance to the four bands', () => {
    expect([1, 3, 4, 5, 6, 7, 8, 10].map(seasonalBand)).toEqual(['Low', 'Low', 'Medium', 'Medium', 'High', 'High', 'Very high', 'Very high']);
  });
  it('maps evergreen to a review cadence', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 10].map(reviewCadence)).toEqual(['weekly', 'weekly', 'monthly', 'monthly', 'quarterly', 'quarterly', 'annually', 'annually']);
  });
  it('bands stakes and refresh effort', () => {
    expect([2, 4, 6, 9].map(stakesBand)).toEqual(['Low', 'Moderate', 'High', 'Critical']);
    expect([3, 5, 8].map(effortBand)).toEqual(['Mostly scripted', 'Mixed', 'Mostly hand research']);
  });
  it('accepts only whole numbers from 1 to 10', () => {
    expect([0, 1, 10, 11, 2.5, NaN].map(isPlanningScore)).toEqual([false, true, true, false, false, false]);
    expect(isPlanningScore('5')).toBe(false);
    expect(PLANNING_KEYS).toHaveLength(4);
  });
  it('counts reviews a year when every cadence is kept', () => {
    expect(reviewWorkload([3, 3, 5, 9]).perYear).toBe(12 + 12 + 4 + 1);
    expect(reviewWorkload([9, 9, 9]).perMonth).toBeCloseTo(0.25);
  });
  it('measures swing as best month minus worst month', () => {
    expect(swingOf([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 8])).toBe(6);
    expect(swingOf([1, 2])).toBeNull();
  });
  it('flags places that swing 4 or more points from the interest norm', () => {
    const flat = (n: number, id: string, hi = 0) => ({ id, status: 'live', monthly: Array.from({ length: 12 }, (_, i) => (i === 0 ? n + hi : n)) });
    const places = [flat(5, 'a', 1), flat(5, 'b', 1), flat(5, 'c', 1), flat(5, 'd', 1), flat(5, 'e', 1), flat(2, 'f', 6), { id: 'g', status: 'na', monthly: [] }];
    const flags = placeSwingFlags(places);
    expect(flags.get('a')?.exception).toBe(false);
    expect(flags.get('f')?.exception).toBe(true);
    expect(flags.get('f')?.diff).toBe(5);
    expect(flags.has('g')).toBe(false);
  });
  it('says nothing when too few places have monthly scores', () => {
    expect(placeSwingFlags([{ id: 'a', status: 'live', monthly: Array(12).fill(5) }]).size).toBe(0);
  });
});
