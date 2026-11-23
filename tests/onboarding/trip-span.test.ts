import { describe, it, expect } from 'vitest';
import { spanNote, tripMonthShares } from '@/lib/onboarding/trip-span';
import { computeRankedDestinations } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';
import { SLIDERS, allBandsSelected } from '@/lib/scoring/constants';

function makeDestination(overrides: Partial<ScoredDestination> = {}): ScoredDestination {
  const monthly: Record<string, number[]> = {};
  SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(5)));
  return {
    id: 'test-dest',
    name: 'Test Destination',
    region: 'Testland',
    emoji: '🧪',
    climate: 'temperate',
    about: 'A test destination.',
    overview: null,
    costRange: null,
    costOverview: null,
    costItems: [],
    base: {},
    budgetBands: [],
    vibeBands: [],
    physicalBands: [],
    dry: [],
    wet: [],
    hot: [],
    cold: [],
    peak: [],
    low: [],
    peakIntensity: null,
    priceSwing: null,
    crowdBaseline: null,
    hotSeverity: null,
    coldSeverity: null,
    wetSeverity: null,
    seasonalHazards: [],
    wildlifePeak: [],
    wildlifeClosed: [],
    birdingPeak: [],
    hikingBest: [],
    hikingWorst: [],
    inaccessible: [],
    swimHazard: [],
    noSnow: [],
    sliderCaps: {},
    sliderEvents: {},
    shopClosures: false,
    specialSeasons: [],
    monthlyWeather: null,
    sliderOverview: {},
    sliderMonthlyWeather: {},
    naSliders: [],
    searchAliases: [],
    activityStyleTiers: {},
    signatureTier: {},
    scoreOverrides: {},
    sliderCurves: {},
    monthly,
    badges: new Array(12).fill([]),
    weatherBand: new Array(12).fill('warm'),
    explanations: Object.fromEntries(SLIDERS.map((s) => [s.key, new Array(12).fill('')])),
    ...overrides,
  };
}


// Owner, 21 Nov 2026: the next month counts only when a full week of the trip is in it, not when the trip merely touches it.
describe('which months a trip covers', () => {
  it('uses the start month alone when the week or the length is not given', () => {
    expect(tripMonthShares(null, 3, '2w')).toEqual([]);
    expect(tripMonthShares(2, 0, '2w')).toEqual([{ month: 2, days: 14 }]);
    expect(tripMonthShares(2, 3, null)).toEqual([{ month: 2, days: 0 }]);
  });
  it('keeps a trip that stays inside its month as one month', () => {
    expect(tripMonthShares(2, 1, '2w')).toEqual([{ month: 2, days: 14 }]);
    expect(tripMonthShares(2, 3, '2w')).toEqual([{ month: 2, days: 14 }]);
  });
  it('does not count a month that is only touched (under a full week)', () => {
    // 31-day March, week 4 starts on the 22nd: 10 days in March, 4 spill into April.
    expect(tripMonthShares(2, 4, '2w')).toEqual([{ month: 2, days: 14 }]);
    // 30-day April, week 4 two weeks: 9 days in April, 5 into May.
    expect(tripMonthShares(3, 4, '2w')).toEqual([{ month: 3, days: 14 }]);
  });
  it('counts the next month when a full week or more falls in it', () => {
    // February (28 days), week 4 starts on the 22nd: 7 days in February, 7 in March.
    expect(tripMonthShares(1, 4, '2w')).toEqual([{ month: 1, days: 7 }, { month: 2, days: 7 }]);
    // Three weeks from week 4 of December: 10 days in December and 11 in January.
    expect(tripMonthShares(11, 4, '3w')).toEqual([{ month: 11, days: 10 }, { month: 0, days: 11 }]);
  });
  it('never counts a long weekend or one week as two months', () => {
    for (let m = 0; m < 12; m++) for (let w = 1; w <= 4; w++) {
      expect(tripMonthShares(m, w, 'wk').length).toBe(1);
      expect(tripMonthShares(m, w, '1w').length).toBe(1);
    }
  });
  it('says so in one sentence only when two months count', () => {
    expect(spanNote(tripMonthShares(2, 1, '2w'))).toBeNull();
    expect(spanNote(tripMonthShares(1, 4, '2w'))).toBe('About 7 days fall in February and 7 in March, so both months count toward your matches.');
  });
});

describe('ranking a trip that covers two months', () => {
  it('scores it as the average of the months, weighted by their days', () => {
    const curve = new Array(12).fill(2);
    curve[0] = 10; // great in January only
    const d = makeDestination({ monthly: { ...makeDestination().monthly, hiking: curve } });
    const bands = allBandsSelected();
    const w = { hiking: 9 };
    const dec = computeRankedDestinations([d], w, 12, bands)[0].s;
    const jan = computeRankedDestinations([d], w, 1, bands)[0].s;
    const span = computeRankedDestinations([d], w, 12, bands, undefined, undefined, undefined, 0, [{ month: 11, days: 10 }, { month: 0, days: 11 }])[0].s;
    expect(span).toBeCloseTo((dec * 10 + jan * 11) / 21, 6);
    expect(span).toBeGreaterThan(dec);
    expect(span).toBeLessThan(jan);
  });
  it('does nothing for a single month', () => {
    const d = makeDestination();
    const bands = allBandsSelected();
    const a = computeRankedDestinations([d], { hiking: 9 }, 5, bands)[0].s;
    const b = computeRankedDestinations([d], { hiking: 9 }, 5, bands, undefined, undefined, undefined, 0, [{ month: 4, days: 14 }])[0].s;
    expect(b).toBe(a);
  });
});
