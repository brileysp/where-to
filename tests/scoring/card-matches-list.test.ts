import { describe, it, expect } from 'vitest';
import { adjustedScoreForMonth, computeRankedDestinations } from '@/lib/scoring/rank';
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

/**
 * Owner, 22 Nov 2026 (found while checking the Basics): the place card showed the month's raw score while the list showed it moved for Crowds & prices and
 * multiplied by the trip-length and What-else-matters factor, so the same place read 5.7 in the list and 6.7 on its card. The card now uses the list's own number.
 */
describe('the place card shows the list\'s score', () => {
  const dest = makeDestination({ id: 'busy', peak: [6, 7], low: [0, 1], peakIntensity: 'high', priceSwing: 'high' });
  const weights = Object.fromEntries(SLIDERS.map((s) => [s.key, 5]));
  const bands = allBandsSelected();

  it('matches the list for the search month with a season leaning and a whole-place factor', () => {
    const ranked = computeRankedDestinations([dest], weights, 7, bands, undefined, undefined, { busy: 0.8 }, 0.25);
    const card = adjustedScoreForMonth(dest, weights, 6, bands, undefined, undefined, { peakGain: 0.25, placeFactor: 0.8 }, 6);
    expect(card).toBeCloseTo(ranked[0].s, 10);
    const plain = adjustedScoreForMonth(dest, weights, 6, bands, undefined, undefined, { peakGain: 0, placeFactor: 1 }, 6);
    expect(card).toBeLessThan(plain); // the leaning and the factor both lowered it
  });
  it('matches the list for a trip over two months, only for the search month', () => {
    const shares = [{ month: 6, days: 4 }, { month: 7, days: 3 }];
    const ranked = computeRankedDestinations([dest], weights, 7, bands, undefined, undefined, { busy: 0.9 }, -0.25, shares);
    const adjust = { peakGain: -0.25, placeFactor: 0.9, shares };
    expect(adjustedScoreForMonth(dest, weights, 6, bands, undefined, undefined, adjust, 6)).toBeCloseTo(ranked[0].s, 10);
    // another month previewed on the card is that month alone
    const other = adjustedScoreForMonth(dest, weights, 1, bands, undefined, undefined, adjust, 6);
    const alone = computeRankedDestinations([dest], weights, 2, bands, undefined, undefined, { busy: 0.9 }, -0.25);
    expect(other).toBeCloseTo(alone[0].s, 10);
  });
  it('without adjustments it is the plain month score, as before', () => {
    const plain = computeRankedDestinations([dest], weights, 7, bands);
    expect(adjustedScoreForMonth(dest, weights, 6, bands, undefined, undefined)).toBeCloseTo(plain[0].s, 10);
  });
});

describe('how much a missed Budget / Climate / Vibe / Physical level keeps (owner, 22 Nov 2026: was a fixed half, now on the Matching tab)', () => {
  const weights = Object.fromEntries(SLIDERS.map((s) => [s.key, 5]));
  const luxuryOnly = makeDestination({ id: 'lux', budgetBands: ['luxury'], vibeBands: ['lively'] });
  const basicTraveler = { ...allBandsSelected(), budget: ['basic'] };
  const allOn = allBandsSelected();

  it('defaults to half, the number it always was', () => {
    const open = computeRankedDestinations([luxuryOnly], weights, 7, allOn)[0].s;
    const missed = computeRankedDestinations([luxuryOnly], weights, 7, basicTraveler)[0].s;
    expect(missed / open).toBeCloseTo(0.5, 10);
  });
  it('follows the setting, once for each group missed', () => {
    const open = computeRankedDestinations([luxuryOnly], weights, 7, allOn)[0].s;
    const one = computeRankedDestinations([luxuryOnly], weights, 7, basicTraveler, undefined, undefined, undefined, 0, undefined, 0.8)[0].s;
    expect(one / open).toBeCloseTo(0.8, 10);
    const two = computeRankedDestinations([luxuryOnly], weights, 7, { ...basicTraveler, vibe: ['secluded'] }, undefined, undefined, undefined, 0, undefined, 0.8)[0].s;
    expect(two / open).toBeCloseTo(0.64, 10);
    expect(computeRankedDestinations([luxuryOnly], weights, 7, basicTraveler, undefined, undefined, undefined, 0, undefined, 1)[0].s).toBeCloseTo(open, 10);
  });
  it('the place card uses the same number', () => {
    const ranked = computeRankedDestinations([luxuryOnly], weights, 7, basicTraveler, undefined, undefined, undefined, 0, undefined, 0.8)[0].s;
    expect(adjustedScoreForMonth(luxuryOnly, weights, 6, basicTraveler, undefined, undefined, { peakGain: 0, placeFactor: 1, bandKeep: 0.8 }, 6)).toBeCloseTo(ranked, 10);
  });
  it('is a setting with a default of 50% that the Matching tab can change', async () => {
    const { DEFAULT_MATCH_SETTINGS, MATCH_SETTING_FIELDS, mergeMatchSettings } = await import('@/lib/scoring/matchSettings');
    expect(DEFAULT_MATCH_SETTINGS.keepIfBandMissed).toBe(0.5);
    expect(MATCH_SETTING_FIELDS.some((f) => f.key === 'keepIfBandMissed')).toBe(true);
    expect(mergeMatchSettings({ keepIfBandMissed: 0.7 }).keepIfBandMissed).toBe(0.7);
    expect(mergeMatchSettings({ keepIfBandMissed: 5 }).keepIfBandMissed).toBe(0.5);
  });
});
