import { describe, expect, it } from 'vitest';
import { styleAdjustedScore, scoreForMonth } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';
import { SLIDERS } from '@/lib/scoring/constants';

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
    naSliders: [],
    searchAliases: [],
    activityStyleTiers: {},
    monthly,
    badges: new Array(12).fill([]),
    weatherBand: new Array(12).fill('warm'),
    ...overrides,
  };
}

describe('styleAdjustedScore', () => {
  it('returns the raw score unchanged when nothing is selected', () => {
    const dest = makeDestination({ monthly: { ...{}, cycling: new Array(12).fill(9) } });
    expect(styleAdjustedScore(dest, 'cycling', 0, undefined)).toBe(9);
    expect(styleAdjustedScore(dest, 'cycling', 0, {})).toBe(9);
  });

  // Reproduces the real "Moab/Whistler" scenario: a destination famous
  // for mountain biking, with real-but-modest road cycling — selecting
  // the style you actually care about should reflect that difference,
  // without a real-but-secondary style collapsing to zero/N/A.
  it('scores near-full for a signature style and mid-pack (not zero) for a casual one', () => {
    const dest = makeDestination({
      monthly: { cycling: new Array(12).fill(9) } as Record<string, number[]>,
      activityStyleTiers: { cycling: { mountainBiking: 'signature', scenicRoadCycling: 'casual' } },
    });
    const mountainScore = styleAdjustedScore(dest, 'cycling', 0, { cycling: ['mountainBiking'] });
    const roadScore = styleAdjustedScore(dest, 'cycling', 0, { cycling: ['scenicRoadCycling'] });

    expect(mountainScore).toBe(9);
    expect(roadScore).toBeCloseTo(4.5, 5);
    expect(roadScore).toBeGreaterThan(0);
    expect(roadScore).toBeLessThan(mountainScore);
  });

  // Regression test for a real production bug: Patagonia and the Canary
  // Islands (obviously mountainous/coastal destinations) scored 1.5/10 on
  // scenic once a user selected "mountains", purely because nobody had
  // authored activityStyleTiers.scenic for them yet — "never researched"
  // and "researched and it's a poor fit" were colliding on the same 0.15x
  // penalty. A destination with NO activityStyleTiers entry at all for
  // this slider must now read as neutral (raw, unchanged), not punished.
  it('treats a destination never authored for this slider as neutral, not a penalty', () => {
    const dest = makeDestination({ monthly: { scenic: new Array(12).fill(9) } as Record<string, number[]> });
    const score = styleAdjustedScore(dest, 'scenic', 0, { scenic: ['mountains'] });
    expect(score).toBe(9);
  });

  // A destination that HAS been authored for this slider, where the
  // selected style specifically comes back 'none' (a real claim: we
  // looked, and it's a poor fit), still gets a real but soft penalty —
  // 0.3x per the user's explicit ask ("even then, probably a 3 vs a
  // 1.5"), not the old 0.15x.
  it('treats an authored-but-none-tier style as a soft penalty, not a near-zero', () => {
    const dest = makeDestination({
      monthly: { cycling: new Array(12).fill(9) } as Record<string, number[]>,
      activityStyleTiers: { cycling: { mountainBiking: 'signature', gravelRiding: 'none' } },
    });
    const score = styleAdjustedScore(dest, 'cycling', 0, { cycling: ['gravelRiding'] });
    expect(score).toBeCloseTo(9 * 0.3, 5);
    expect(score).toBeGreaterThan(0);
  });

  it('uses the best-matching selected style, not an average, when multiple are selected', () => {
    const dest = makeDestination({
      monthly: { cycling: new Array(12).fill(10) } as Record<string, number[]>,
      activityStyleTiers: { cycling: { mountainBiking: 'signature', scenicRoadCycling: 'casual' } },
    });
    const score = styleAdjustedScore(dest, 'cycling', 0, { cycling: ['mountainBiking', 'scenicRoadCycling'] });
    expect(score).toBe(10); // signature (1.0x), not dragged down by the casual (0.5x) side
  });
});

describe('scoreForMonth with selectedStyles', () => {
  it('produces a lower overall score for a road-only selection than a mountain-only one, at the same weight', () => {
    const dest = makeDestination({
      monthly: { ...Object.fromEntries(SLIDERS.map((s) => [s.key, new Array(12).fill(0)])), cycling: new Array(12).fill(9) },
      activityStyleTiers: { cycling: { mountainBiking: 'signature', scenicRoadCycling: 'casual' } },
    });
    const weights = { cycling: 10 };
    const mountainOnly = scoreForMonth(dest, weights, 0, {}, { cycling: ['mountainBiking'] });
    const roadOnly = scoreForMonth(dest, weights, 0, {}, { cycling: ['scenicRoadCycling'] });

    expect(mountainOnly).toBeGreaterThan(roadOnly);
    expect(roadOnly).toBeGreaterThan(0);
  });
});
