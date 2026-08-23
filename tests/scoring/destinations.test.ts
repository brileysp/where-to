import { describe, expect, it } from 'vitest';
import { deriveDestinationScores } from '@/lib/scoring/destinations';
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
    ...overrides,
  };
}

describe('deriveDestinationScores — snowsports noSnow override', () => {
  // Reproduces the real Aspen/Whistler/Zermatt/Banff bug: a ski
  // destination's summer months never got a `hot`/`dry` flag (its summer
  // is mild by the destination's own climate norms, not objectively hot
  // or dry), so the formula's only downward lever never fired and the
  // destination scored a flat 10/10 for snowsports in July.
  it('forces snowsports to 0 in noSnow months, regardless of base or missing hot/dry flags', () => {
    const dest = makeDestination({
      base: { snowsports: 10 },
      cold: [11, 12, 1, 2, 3],
      // Deliberately no `hot`/`dry` set for the summer months — this is
      // the exact real-world gap that let the bug through.
      noSnow: [6, 7, 8, 9],
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.snowsports[6]).toBe(0); // July
    expect(monthly.snowsports[7]).toBe(0); // August
    expect(monthly.snowsports[0]).toBe(10); // January, cold-season peak, unaffected
  });

  it('still applies the normal cold bonus in non-noSnow months', () => {
    const dest = makeDestination({
      base: { snowsports: 5 },
      cold: [1],
      noSnow: [7],
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.snowsports[0]).toBe(8); // January: 5 + 3 (cold)
    expect(monthly.snowsports[6]).toBe(0); // July: forced to 0
  });

  it('leaves the existing hot/dry penalty behavior unchanged when noSnow is not set', () => {
    const dest = makeDestination({
      base: { snowsports: 6 },
      hot: [7],
      noSnow: [],
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.snowsports[6]).toBe(4); // July: 6 - 2 (hot), not forced to 0
  });

  it('surfaces a "No snow on the ground" badge in noSnow months', () => {
    const dest = makeDestination({
      base: { snowsports: 10 },
      noSnow: [7],
    });
    const { badges } = deriveDestinationScores(dest);
    expect(badges[6].some((b) => b.label === 'No snow on the ground')).toBe(true);
    expect(badges[0].some((b) => b.label === 'No snow on the ground')).toBe(false);
  });
});

describe('deriveDestinationScores — sliderCaps ceiling', () => {
  // Reproduces the real Bali/Lofoten bug: birding's peak-month bonus is a
  // flat +7 regardless of whether the destination is actually a
  // world-class birding destination. Without a cap, a beach island with
  // a few visiting birds (base 4) reads as a literal 10/10 for over half
  // the year, indistinguishable from an actual birding mecca.
  it('caps a slider at the authored ceiling even when the formula would score higher', () => {
    const dest = makeDestination({
      base: { birding: 4 },
      birdingPeak: [4, 5, 6, 7, 8, 9, 10],
      sliderCaps: { birding: 5 },
    });
    const { monthly } = deriveDestinationScores(dest);
    // Uncapped this would be 4 + 7 = 11, clamped to 10.
    expect(monthly.birding[3]).toBe(5); // April, a birdingPeak month
    expect(monthly.birding[0]).toBe(4); // January, off-peak, unaffected by the cap
  });

  it('leaves the score untouched for sliders with no cap authored', () => {
    const dest = makeDestination({
      base: { wildlife: 10 },
      wildlifePeak: [7],
      sliderCaps: { birding: 5 }, // cap on a different slider entirely
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlife[6]).toBe(10); // July: uncapped, formula's own ceiling applies
  });

  it('a cap can never raise a score, only lower it', () => {
    const dest = makeDestination({
      base: { birding: 2 },
      sliderCaps: { birding: 8 },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.birding[0]).toBe(2); // cap of 8 doesn't pull a real 2 up to 8
  });
});

describe('deriveDestinationScores — sliderEvents multi-tier seasonality', () => {
  // Reproduces the real Churchill case: polar bears (full weight) and
  // beluga whales (half weight) are two independent seasonal draws, each
  // with their own month-by-month intensity, that a single flat
  // peak-month bonus can't express.
  it('scales the bonus by both the event weight and that month\'s intensity', () => {
    const dest = makeDestination({
      base: { wildlife: 1 },
      sliderEvents: {
        wildlife: [
          { label: 'Polar bears', weight: 7, months: { 10: 1, 11: 1, 9: 0.3 } },
          { label: 'Beluga whales', weight: 3.5, months: { 7: 1, 8: 1 } },
        ],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlife[9]).toBe(8); // October: 1 + 7*1 = 8, full bear peak
    expect(monthly.wildlife[10]).toBe(8); // November: same, full bear peak
    expect(monthly.wildlife[8]).toBe(3); // September: 1 + 7*0.3 = 3.1 -> rounds to 3, a real shoulder
    expect(monthly.wildlife[6]).toBe(5); // July: 1 + 3.5*1 = 4.5 -> rounds to 5, half-weight beluga peak
    expect(monthly.wildlife[0]).toBe(1); // January: no event active, pure base — the "dead" off-season
  });

  it('stacks multiple events active in the same month additively', () => {
    const dest = makeDestination({
      base: { wildlife: 2 },
      sliderEvents: {
        wildlife: [
          { label: 'Event A', weight: 3, months: { 6: 1 } },
          { label: 'Event B', weight: 2, months: { 6: 1 } },
        ],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlife[5]).toBe(7); // June: 2 + 3 + 2 = 7, both events contribute
  });

  it('falls back to the legacy single-peak-flag formula when no events are authored', () => {
    const dest = makeDestination({
      base: { wildlife: 3 },
      wildlifePeak: [6],
      sliderEvents: {},
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlife[5]).toBe(10); // June: 3 + 7 = 10, unchanged legacy behavior
    expect(monthly.wildlife[0]).toBe(3); // January: unchanged legacy behavior
  });

  it('still forces wildlifeClosed months to the same 0-1 floor even when using events', () => {
    const dest = makeDestination({
      base: { wildlife: 5 },
      wildlifeClosed: [8],
      sliderEvents: {
        wildlife: [{ label: 'Tigers', weight: 4, months: { 8: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlife[7]).toBe(1); // August: closed overrides the events bonus entirely
  });
});

describe('deriveDestinationScores — birding sliderEvents', () => {
  // Birding uses the identical sliderEvents mechanism as wildlife, wired
  // into its own case block — verify it independently rather than just
  // trusting the shared helper is reached correctly from both cases.
  it('scales the birding bonus by event weight and month intensity', () => {
    const dest = makeDestination({
      base: { birding: 9 },
      sliderEvents: {
        birding: [{ label: 'Palearctic migrants', weight: 3, months: { 12: 0.5, 1: 1, 2: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.birding[0]).toBe(10); // January: 9 + 3*1 = 12 -> clamped to 10
    expect(monthly.birding[11]).toBe(10); // December: 9 + 3*0.5 = 10.5 -> rounds to 10, then unaffected by clamp
    expect(monthly.birding[5]).toBe(9); // June: no event active, pure base
  });

  it('falls back to the legacy single-peak-flag formula when no birding events are authored', () => {
    const dest = makeDestination({
      base: { birding: 4 },
      birdingPeak: [6],
      sliderEvents: {},
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.birding[5]).toBe(10); // June: 4 + 7 -> clamped to 10, unchanged legacy behavior
    expect(monthly.birding[0]).toBe(4); // January: unchanged legacy behavior
  });

  it('a destination can use events for birding and the legacy formula for wildlife independently', () => {
    const dest = makeDestination({
      base: { birding: 5, wildlife: 5 },
      wildlifePeak: [6],
      sliderEvents: {
        birding: [{ label: 'Migrants', weight: 4, months: { 6: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.birding[5]).toBe(9); // June: 5 + 4*1 = 9, events path
    expect(monthly.wildlife[5]).toBe(10); // June: 5 + 7 -> clamped, legacy path, unaffected by birding's events
  });
});

describe('deriveDestinationScores — hiking-formula sliderEvents (shared by 7 sliders)', () => {
  // The 'hiking' formula backs seven different sliders (hiking, scenic,
  // fishing, cycling, adventure, roadtrip, golf) that all read the same
  // hikingBest/hikingWorst flags by default. Unlike birding/wildlife,
  // events here must be looked up by the specific slider key, not
  // hardcoded, or one slider's authored nuance would bleed into another's.
  it('keys events off the specific slider, not the shared formula', () => {
    const dest = makeDestination({
      base: { hiking: 8, scenic: 8 },
      hikingBest: [6],
      sliderEvents: {
        scenic: [{ label: 'Wildflower bloom', weight: 1.5, months: { 6: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.scenic[5]).toBe(10); // June: 8 + 1.5 = 9.5 -> rounds to 10, events path
    expect(monthly.hiking[5]).toBe(10); // June: 8 + 3 -> clamped to 10, legacy path (no hiking-specific events authored)
  });

  it('falls back to the legacy hikingBest/hikingWorst formula when no events are authored for that slider', () => {
    const dest = makeDestination({
      base: { hiking: 5 },
      hikingBest: [6],
      hikingWorst: [1],
      sliderEvents: {},
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.hiking[5]).toBe(8); // June: 5 + 3, unchanged legacy behavior
    expect(monthly.hiking[0]).toBe(1); // January: 5 - 4, unchanged legacy behavior
  });

  it('other hiking-formula sliders (e.g. golf) stay on the legacy formula even when hiking/scenic have events', () => {
    const dest = makeDestination({
      base: { hiking: 8, scenic: 8, golf: 6 },
      hikingBest: [6],
      sliderEvents: {
        hiking: [{ label: 'Dry-season trail conditions', weight: 2, months: { 6: 1 } }],
        scenic: [{ label: 'Wildflower bloom', weight: 1.5, months: { 6: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.hiking[5]).toBe(10); // June: 8 + 2 = 10, events path
    expect(monthly.scenic[5]).toBe(10); // June: 8 + 1.5 = 9.5 -> rounds to 10, events path
    expect(monthly.golf[5]).toBe(9); // June: 6 + 3 = 9, legacy path, untouched by hiking/scenic's events
  });
});

describe('deriveDestinationScores — culture-formula sliderEvents (shared by 4 sliders)', () => {
  // The 'culture' formula backs stargazing, museums, architecture, and
  // festivals. Most destinations should stay on the legacy dry/wet/
  // shopClosures formula (a museum doesn't have a season) -- events are
  // the exception, authored per-slider like hiking/scenic.
  it('keys events off the specific slider, leaving sibling culture-formula sliders on the legacy formula', () => {
    const dest = makeDestination({
      base: { festivals: 4, museums: 9 },
      dry: [6],
      sliderEvents: {
        festivals: [{ label: 'Carnival', weight: 6, months: { 2: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.festivals[1]).toBe(10); // February: 4 + 6*1 = 10, events path, a spiky single-month peak
    expect(monthly.festivals[0]).toBe(4); // January: no event active, pure base
    expect(monthly.museums[5]).toBe(10); // June: 9 + 1 (dry) -> clamped to 10, legacy path, untouched by festivals' events
  });

  it('falls back to the legacy dry/wet/shopClosures formula when no events are authored for that slider', () => {
    const dest = makeDestination({
      base: { architecture: 6 },
      dry: [6],
      wet: [1],
      shopClosures: true,
      low: [1],
      sliderEvents: {},
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.architecture[5]).toBe(7); // June: 6 + 1 (dry), unchanged legacy behavior
    expect(monthly.architecture[0]).toBe(1); // January: 6 - 2 (wet) - 3 (shopClosures && low), unchanged legacy behavior
  });
});

describe('deriveDestinationScores — food-formula sliderEvents (shared by 5 sliders)', () => {
  // The 'food' formula backs spa, finedining, streetfood, nightlife, and
  // winetasting. Regression coverage for a real bug caught during manual
  // verification: winetasting events were authored in content but the
  // 'food' case never checked sliderEvents at all, so they were silently
  // ignored and the destination kept computing off the legacy formula.
  it('keys events off the specific slider, leaving sibling food-formula sliders on the legacy formula', () => {
    const dest = makeDestination({
      base: { winetasting: 8, spa: 6 },
      peak: [1],
      sliderEvents: {
        winetasting: [{ label: 'Harvest season', weight: 1, months: { 3: 0.7 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.winetasting[2]).toBe(9); // March: 8 + 1*0.7 = 8.7 -> rounds to 9, events path
    expect(monthly.winetasting[0]).toBe(8); // January: no event active, pure base -- unaffected by the unrelated 'peak' flag
    expect(monthly.spa[0]).toBe(7); // January: 6 + 1 (peak), legacy path, untouched by winetasting's events
  });

  it('falls back to the legacy peak/shopClosures formula when no events are authored for that slider', () => {
    const dest = makeDestination({
      base: { finedining: 5 },
      peak: [6],
      shopClosures: true,
      low: [1],
      sliderEvents: {},
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.finedining[5]).toBe(6); // June: 5 + 1 (peak), unchanged legacy behavior
    expect(monthly.finedining[0]).toBe(2); // January: 5 - 3 (shopClosures && low), unchanged legacy behavior
  });
});
