import { describe, expect, it } from 'vitest';
import { deriveDestinationScoresFromCurves } from '@/lib/scoring/curveScoring';
import { parseSliderCurve } from '@/lib/scoring/curve';
import { SLIDERS } from '@/lib/scoring/constants';
import type { ScoringDestination } from '@/lib/scoring/types';

function makeDestination(overrides: Partial<ScoringDestination> = {}): ScoringDestination {
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
    ...overrides,
  };
}

describe('deriveDestinationScoresFromCurves', () => {
  it('evaluates a stored curve into the expected 12-month array', () => {
    const d = makeDestination({
      sliderCurves: {
        hiking: { anchors: [{ month: 1, value: 2, steepness: 2 }, { month: 7, value: 9, steepness: 2 }] },
      },
    });
    const result = deriveDestinationScoresFromCurves(d);
    expect(result.monthly.hiking[0]).toBe(2); // January, exact anchor
    expect(result.monthly.hiking[6]).toBe(9); // July, exact anchor
    expect(result.monthly.hiking[3]).toBeGreaterThan(2);
    expect(result.monthly.hiking[3]).toBeLessThan(9);
  });

  it('leaves a slider with no stored curve at zero (N/A at fit time)', () => {
    const d = makeDestination({ sliderCurves: {} });
    const result = deriveDestinationScoresFromCurves(d);
    expect(result.monthly.hiking).toEqual(new Array(12).fill(0));
  });

  it('reapplies seasonalHazards on top of curve-derived monthly, same multiplier as the old formula', () => {
    const d = makeDestination({
      sliderCurves: { diving: { anchors: [{ month: 1, value: 8 }] } },
      seasonalHazards: [
        { label: 'Storm season', category: 'storm', months: [7], severity: 'severe', affectedSliders: ['diving'] },
      ],
    });
    const result = deriveDestinationScoresFromCurves(d);
    expect(result.monthly.diving[0]).toBe(8); // January, unaffected
    expect(result.monthly.diving[6]).toBeCloseTo(8 * 0.3, 5); // July, severe multiplier applied
  });

  it('scoreOverrides win over both the curve and any hazard', () => {
    const d = makeDestination({
      sliderCurves: { diving: { anchors: [{ month: 1, value: 8 }] } },
      seasonalHazards: [
        { label: 'Storm season', category: 'storm', months: [7], severity: 'severe', affectedSliders: ['diving'] },
      ],
      scoreOverrides: { diving: { 6: 10 } }, // July, 0-indexed
    });
    const result = deriveDestinationScoresFromCurves(d);
    expect(result.monthly.diving[6]).toBe(10);
  });

  it('computes crowds/deals as the same value for a given month, derived from every other curve', () => {
    const d = makeDestination({
      sliderCurves: {
        auroraChasing: { anchors: [{ month: 7, value: 1, steepness: 2 }, { month: 1, value: 9, steepness: 2 }] },
        museumsArt: { anchors: [{ month: 1, value: 8 }] },
      },
    });
    const result = deriveDestinationScoresFromCurves(d);
    expect(result.monthly.crowds[0]).toBe(result.monthly.deals[0]); // same underlying signal
    // January is auroraChasing's own peak — busier than typical, worse for avoiding crowds.
    expect(result.monthly.crowds[0]).toBeLessThan(result.monthly.crowds[6]);
  });

  it('an unparseable stored curve is skipped for that slider, not fatal to the whole destination', () => {
    const d = makeDestination({
      sliderCurves: {
        // month 999 is invalid — anchorSchema will reject it.
        hiking: { anchors: [{ month: 999, value: 5 }] },
        diving: { anchors: [{ month: 1, value: 7 }] },
      },
    });
    const result = deriveDestinationScoresFromCurves(d);
    expect(result.monthly.hiking).toEqual(new Array(12).fill(0));
    expect(result.monthly.diving[0]).toBe(7); // unaffected sibling slider still works
  });

  it('badges and weatherBand are populated for all 12 months regardless of curve data', () => {
    const d = makeDestination({ hot: [7], dry: [7] });
    const result = deriveDestinationScoresFromCurves(d);
    expect(result.weatherBand).toHaveLength(12);
    expect(result.badges).toHaveLength(12);
    expect(result.badges.every((b) => Array.isArray(b))).toBe(true);
  });

  it('produces a monthly entry for every slider in SLIDERS, not just the ones with curves', () => {
    const d = makeDestination({ sliderCurves: { hiking: { anchors: [{ month: 1, value: 5 }] } } });
    const result = deriveDestinationScoresFromCurves(d);
    for (const s of SLIDERS) {
      expect(result.monthly[s.key]).toHaveLength(12);
    }
  });

  it('matches parseSliderCurve directly for a hand-constructed curve (sanity check on the wiring)', () => {
    const raw = { anchors: [{ month: 3, value: 6, steepness: 4 }, { month: 9, value: 2, steepness: 1 }] };
    const d = makeDestination({ sliderCurves: { fishing: raw } });
    const result = deriveDestinationScoresFromCurves(d);
    const curve = parseSliderCurve(raw);
    expect(result.monthly.fishing[2]).toBe(curve.anchors[0].value); // month 3, 0-indexed
  });
});
