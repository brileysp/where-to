import { describe, expect, it } from 'vitest';
import { deriveDestinationScores, isSliderNA } from '@/lib/scoring/destinations';
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
    naSliders: [],
    searchAliases: [],
    activityStyleTiers: {},
    signatureTier: {},
    scoreOverrides: {},
    sliderCurves: {},
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
      base: { skiingSnowboarding: 10 },
      cold: [11, 12, 1, 2, 3],
      // Deliberately no `hot`/`dry` set for the summer months — this is
      // the exact real-world gap that let the bug through.
      noSnow: [6, 7, 8, 9],
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.skiingSnowboarding[6]).toBe(0); // July
    expect(monthly.skiingSnowboarding[7]).toBe(0); // August
    expect(monthly.skiingSnowboarding[0]).toBe(10); // January, cold-season peak, unaffected
  });

  it('still applies the normal cold bonus in non-noSnow months', () => {
    const dest = makeDestination({
      base: { skiingSnowboarding: 5 },
      cold: [1],
      noSnow: [7],
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.skiingSnowboarding[0]).toBe(8); // January: 5 + 3 (cold)
    expect(monthly.skiingSnowboarding[6]).toBe(0); // July: forced to 0
  });

  it('leaves the existing hot/dry penalty behavior unchanged when noSnow is not set', () => {
    const dest = makeDestination({
      base: { skiingSnowboarding: 6 },
      hot: [7],
      noSnow: [],
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.skiingSnowboarding[6]).toBe(4); // July: 6 - 2 (hot), not forced to 0
  });

  // Reproduces the real Rome/Sydney/Istanbul/Buenos Aires bug: `cold`
  // means "this month is cold," not "this place has skiable snow" — a
  // destination with zero authored snowsports relevance (base 0) still
  // got a phantom +3 in its one cold month, purely from the flag.
  it('does not award the cold bonus to a destination with no snowsports base', () => {
    const dest = makeDestination({
      base: { skiingSnowboarding: 0 },
      cold: [1],
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.skiingSnowboarding[0]).toBe(0); // January: no phantom cold bonus
  });

  it('surfaces a "No snow on the ground" badge in noSnow months', () => {
    const dest = makeDestination({
      base: { skiingSnowboarding: 10 },
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
      base: { wildlifeViewing: 10 },
      wildlifePeak: [7],
      sliderCaps: { birding: 5 }, // cap on a different slider entirely
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlifeViewing[6]).toBe(10); // July: uncapped, formula's own ceiling applies
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
      base: { wildlifeViewing: 1 },
      sliderEvents: {
        wildlifeViewing: [
          { label: 'Polar bears', weight: 7, months: { 10: 1, 11: 1, 9: 0.3 } },
          { label: 'Beluga whales', weight: 3.5, months: { 7: 1, 8: 1 } },
        ],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlifeViewing[9]).toBe(8); // October: 1 + 7*1 = 8, full bear peak
    expect(monthly.wildlifeViewing[10]).toBe(8); // November: same, full bear peak
    expect(monthly.wildlifeViewing[8]).toBe(3); // September: 1 + 7*0.3 = 3.1 -> rounds to 3, a real shoulder
    expect(monthly.wildlifeViewing[6]).toBe(5); // July: 1 + 3.5*1 = 4.5 -> rounds to 5, half-weight beluga peak
    expect(monthly.wildlifeViewing[0]).toBe(1); // January: no event active, pure base — the "dead" off-season
  });

  it('stacks multiple events active in the same month additively', () => {
    const dest = makeDestination({
      base: { wildlifeViewing: 2 },
      sliderEvents: {
        wildlifeViewing: [
          { label: 'Event A', weight: 3, months: { 6: 1 } },
          { label: 'Event B', weight: 2, months: { 6: 1 } },
        ],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlifeViewing[5]).toBe(7); // June: 2 + 3 + 2 = 7, both events contribute
  });

  it('falls back to the legacy single-peak-flag formula when no events are authored', () => {
    const dest = makeDestination({
      base: { wildlifeViewing: 3 },
      wildlifePeak: [6],
      sliderEvents: {},
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlifeViewing[5]).toBe(10); // June: 3 + 7 = 10, unchanged legacy behavior
    expect(monthly.wildlifeViewing[0]).toBe(3); // January: unchanged legacy behavior
  });

  it('still forces wildlifeClosed months to the same 0-1 floor even when using events', () => {
    const dest = makeDestination({
      base: { wildlifeViewing: 5 },
      wildlifeClosed: [8],
      sliderEvents: {
        wildlifeViewing: [{ label: 'Tigers', weight: 4, months: { 8: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlifeViewing[7]).toBe(1); // August: closed overrides the events bonus entirely
  });

  // Reproduces the real Kruger bug: wet_months was set, wildlife had a
  // dry-season-only event (May-Sep), and every OTHER month — including
  // the wet season — scored a flat, undiscounted base, since the events
  // branch never checked `wet` at all. Real animals genuinely are harder
  // to spot once they disperse from dry-season waterholes; a month with
  // no active event should still take the same wet penalty a plain
  // (no-events) destination already gets.
  it('applies the same wet-month penalty a plain destination gets, in months where no event is active', () => {
    const dest = makeDestination({
      base: { wildlifeViewing: 8 },
      wet: [1, 2, 3],
      sliderEvents: {
        wildlifeViewing: [{ label: 'Dry-season concentration', weight: 3, months: { 6: 1, 7: 1, 8: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wildlifeViewing[0]).toBe(7); // January: wet, no active event → 8 - 1
    expect(monthly.wildlifeViewing[6]).toBe(10); // July: active event, no penalty → 8 + 3, clamped to 10 (unaffected by the fix)
    expect(monthly.wildlifeViewing[3]).toBe(8); // April: neither wet nor an active event → plain base, unaffected
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
      base: { birding: 5, wildlifeViewing: 5 },
      wildlifePeak: [6],
      sliderEvents: {
        birding: [{ label: 'Migrants', weight: 4, months: { 6: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.birding[5]).toBe(9); // June: 5 + 4*1 = 9, events path
    expect(monthly.wildlifeViewing[5]).toBe(10); // June: 5 + 7 -> clamped, legacy path, unaffected by birding's events
  });

  // Same fix as wildlife's — an authored event covering some months
  // shouldn't exempt every other month from the ordinary wet penalty.
  it('applies the same wet-month penalty a plain destination gets, in months where no birding event is active', () => {
    const dest = makeDestination({
      base: { birding: 6 },
      wet: [7, 8],
      sliderEvents: {
        birding: [{ label: 'Migrant arrivals', weight: 3, months: { 1: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.birding[6]).toBe(5); // July: wet, no active event → 6 - 1
    expect(monthly.birding[0]).toBe(9); // January: active event, no penalty → 6 + 3
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
      base: { hiking: 8, scenicLandscapes: 8 },
      hikingBest: [6],
      sliderEvents: {
        scenicLandscapes: [{ label: 'Wildflower bloom', weight: 1.5, months: { 6: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.scenicLandscapes[5]).toBe(10); // June: 8 + 1.5 = 9.5 -> rounds to 10, events path
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
      base: { hiking: 8, scenicLandscapes: 8, golf: 6 },
      hikingBest: [6],
      sliderEvents: {
        hiking: [{ label: 'Dry-season trail conditions', weight: 2, months: { 6: 1 } }],
        scenicLandscapes: [{ label: 'Wildflower bloom', weight: 1.5, months: { 6: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.hiking[5]).toBe(10); // June: 8 + 2 = 10, events path
    expect(monthly.scenicLandscapes[5]).toBe(10); // June: 8 + 1.5 = 9.5 -> rounds to 10, events path
    expect(monthly.golf[5]).toBe(9); // June: 6 + 3 = 9, legacy path, untouched by hiking/scenic's events
  });

  // Reproduces the real Churchill bug: authoring a scenic event for its
  // real tourist-season months (beluga/polar-bear season) silently
  // exempted every OTHER month — including the genuinely harsh cold
  // months — from ever being flagged bad at all, since the events branch
  // never checked hikingBest/hikingWorst. Same fix as wildlife/birding's
  // wet-fallback, applied to this shared formula.
  it('applies the plain hikingBest/hikingWorst read in months where no event is active', () => {
    const dest = makeDestination({
      base: { scenicLandscapes: 6 },
      cold: [1, 2, 3],
      sliderEvents: {
        scenicLandscapes: [{ label: 'Peak season', weight: 4, months: { 10: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.scenicLandscapes[0]).toBe(2); // January: cold, no active event → 6 - 4
    expect(monthly.scenicLandscapes[9]).toBe(10); // October: active event → 6 + 4, clamped to 10
    expect(monthly.scenicLandscapes[5]).toBe(6); // June: neither cold nor an active event → plain base
  });
});

describe('deriveDestinationScores — hiking-formula fallback penalty severity', () => {
  // Reproduces the real Sydney bug: a single mild "cold" flag (its actual
  // winter, ~8-17°C, nowhere near harsh) applied the exact same flat -4
  // hit to scenic/hiking-family sliders that a genuinely severe winter
  // would, turning one ordinary month into an isolated cliff in an
  // otherwise flat chart. Unclassified severity must still produce the
  // old flat -4 (zero regression for every destination not yet reviewed).
  it('keeps the flat -4 penalty when severity is unclassified', () => {
    const dest = makeDestination({ base: { scenicLandscapes: 7 }, cold: [7] });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.scenicLandscapes[6]).toBe(3); // July: 7 - 4, unchanged legacy magnitude
  });

  it('shrinks the penalty for a mild flag and grows it for a severe one', () => {
    const mild = makeDestination({ base: { scenicLandscapes: 7 }, cold: [7], coldSeverity: 'mild' });
    const moderate = makeDestination({ base: { scenicLandscapes: 7 }, cold: [7] });
    const severe = makeDestination({ base: { scenicLandscapes: 7 }, cold: [7], coldSeverity: 'severe' });
    const mildScore = deriveDestinationScores(mild).monthly.scenicLandscapes[6];
    const moderateScore = deriveDestinationScores(moderate).monthly.scenicLandscapes[6];
    const severeScore = deriveDestinationScores(severe).monthly.scenicLandscapes[6];
    expect(mildScore).toBeGreaterThan(moderateScore);
    expect(moderateScore).toBeGreaterThan(severeScore);
  });

  // A month flagged for more than one reason takes the single worst
  // applicable penalty, not the sum — matching the old flat rule, which
  // never stacked wet+hot+cold into a bigger hit just because more than
  // one happened to coincide.
  it('does not stack penalties when a month is flagged for multiple reasons', () => {
    const dest = makeDestination({
      base: { scenicLandscapes: 7 },
      wet: [7],
      cold: [7],
      wetSeverity: 'mild', // -1.5
      coldSeverity: 'severe', // -6.5, the worse of the two
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.scenicLandscapes[6]).toBe(0.5); // 7 - 6.5, the worse single penalty — not 7 - 1.5 - 6.5
  });

  // A destination-specific hikingWorst is a deliberate, hand-curated call
  // and stays a flat -4 regardless of severity fields — severity only
  // adjusts the generic fallback for destinations without bespoke curation.
  it('leaves a bespoke hikingWorst list at the flat penalty, ignoring severity', () => {
    const dest = makeDestination({ base: { hiking: 7 }, hikingWorst: [7], cold: [7], coldSeverity: 'mild' });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.hiking[6]).toBe(3); // 7 - 4, bespoke list unaffected by coldSeverity
  });
});

describe('deriveDestinationScores — culture-formula sliderEvents (shared by 4 sliders)', () => {
  // The 'culture' formula backs stargazing, museums, architecture, and
  // festivals. Most destinations should stay on the legacy dry/wet/
  // shopClosures formula (a museum doesn't have a season) -- events are
  // the exception, authored per-slider like hiking/scenic.
  it('keys events off the specific slider, leaving sibling culture-formula sliders on the legacy formula', () => {
    const dest = makeDestination({
      base: { festivals: 4, museumsArt: 9 },
      dry: [6],
      sliderEvents: {
        festivals: [{ label: 'Carnival', weight: 6, months: { 2: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.festivals[1]).toBe(10); // February: 4 + 6*1 = 10, events path, a spiky single-month peak
    expect(monthly.festivals[0]).toBe(4); // January: no event active, pure base
    expect(monthly.museumsArt[5]).toBe(10); // June: 9 + 1 (dry) -> clamped to 10, legacy path, untouched by festivals' events
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

  // Real, currently-live bug found while designing a data-quality audit:
  // 27 destination/slider combos (e.g. Paris/Edinburgh/Rio festivals,
  // Iceland/Denali stargazing) had BOTH a sliderEvents entry AND real
  // dry/wet flags — and every month without an active event was silently
  // exempted from the dry/wet read entirely, the same swallowed-fallback
  // bug already fixed for wildlife/birding/hiking.
  it('applies the plain dry/wet/shopClosures read in months where no event is active', () => {
    const dest = makeDestination({
      base: { festivals: 6 },
      wet: [1, 2, 3],
      sliderEvents: {
        festivals: [{ label: 'Carnival', weight: 6, months: { 8: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.festivals[0]).toBe(4); // January: wet, no active event → 6 - 2
    expect(monthly.festivals[7]).toBe(10); // August: active event → 6 + 6, clamped
    expect(monthly.festivals[5]).toBe(6); // June: neither wet nor an active event → plain base
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
      base: { wineSpirits: 8, spaWellness: 6 },
      peak: [1],
      sliderEvents: {
        wineSpirits: [{ label: 'Harvest season', weight: 1, months: { 3: 0.7 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wineSpirits[2]).toBe(9); // March: 8 + 1*0.7 = 8.7 -> rounds to 9, events path
    expect(monthly.wineSpirits[0]).toBe(9); // January: no active event, so it still gets the plain peak fallback -- 8 + 1
    expect(monthly.spaWellness[0]).toBe(7); // January: 6 + 1 (peak), legacy path, untouched by winetasting's events
  });

  it('falls back to the legacy peak/shopClosures formula when no events are authored for that slider', () => {
    const dest = makeDestination({
      base: { fineDining: 5 },
      peak: [6],
      shopClosures: true,
      low: [1],
      sliderEvents: {},
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.fineDining[5]).toBe(6); // June: 5 + 1 (peak), unchanged legacy behavior
    expect(monthly.fineDining[0]).toBe(2); // January: 5 - 3 (shopClosures && low), unchanged legacy behavior
  });

  // Same real bug as culture's — winetasting/streetfood at 3 live
  // destinations (Marlborough, Cape Town, Piedmont) had events AND a real
  // peak/shopClosures flag with no active event for those months, which
  // was silently ignored instead of applying the plain fallback.
  it('applies the plain peak/shopClosures read in months where no event is active', () => {
    const dest = makeDestination({
      base: { wineSpirits: 6 },
      peak: [1],
      shopClosures: true,
      low: [7],
      sliderEvents: {
        wineSpirits: [{ label: 'Harvest season', weight: 2, months: { 3: 1 } }],
      },
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.wineSpirits[0]).toBe(7); // January: peak, no active event → 6 + 1
    expect(monthly.wineSpirits[6]).toBe(3); // July: shopClosures+low, no active event → 6 - 3
    expect(monthly.wineSpirits[2]).toBe(8); // March: active event → 6 + 2
  });
});

describe('deriveDestinationScores — explanations (the admin "why this number" breakdown)', () => {
  // Purely descriptive text alongside the real numbers above — every case
  // here re-checks the paired `monthly` value too, so a future change that
  // breaks the narration in a way that also changes the score would still
  // be caught by the existing suite, not just this one.

  it('narrates a flat, unadjusted formula as "no seasonal adjustment"', () => {
    const dest = makeDestination({ base: { luxuryHotels: 6 } });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.luxuryHotels[0]).toBe(6);
    expect(explanations.luxuryHotels[0]).toBe('base 6 (flat, no seasonal adjustment)');
  });

  it('lists each nonzero term for a base+terms formula, dropping zero terms', () => {
    const dest = makeDestination({ base: { sunbathing: 4 }, dry: [3] });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.sunbathing[2]).toBe(6); // March: 4 + 2 (dry)
    expect(explanations.sunbathing[2]).toBe('base 4 +2 dry = 6');
  });

  it('names each sliderEvents entry individually, not just the summed bonus', () => {
    // Same Churchill fixture as the sliderEvents value tests above — the
    // explanation must name "Polar bears" specifically, not a generic
    // "sliderEvents" label, since that's the whole point of showing it.
    const dest = makeDestination({
      base: { wildlifeViewing: 1 },
      sliderEvents: {
        wildlifeViewing: [
          { label: 'Polar bears', weight: 7, months: { 10: 1, 11: 1, 9: 0.3 } },
          { label: 'Beluga whales', weight: 3.5, months: { 7: 1, 8: 1 } },
        ],
      },
    });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.wildlifeViewing[9]).toBe(8); // October: full bear peak
    expect(explanations.wildlifeViewing[9]).toBe('base 1 +7 Polar bears = 8');
    expect(monthly.wildlifeViewing[8]).toBe(3); // September: partial shoulder
    expect(explanations.wildlifeViewing[8]).toBe('base 1 +2.1 Polar bears = 3');
  });

  it('shows a cap bringing the score down, distinct from the 0-10 clamp', () => {
    const dest = makeDestination({
      base: { birding: 4 },
      birdingPeak: [4, 5, 6, 7, 8, 9, 10],
      sliderCaps: { birding: 5 },
    });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.birding[3]).toBe(5); // April
    expect(explanations.birding[3]).toBe('base 4 +7 birdingPeak = 11 → capped to 5');
  });

  it('represents the noSnow hard floor as a term, not a silent override', () => {
    const dest = makeDestination({ base: { skiingSnowboarding: 5 }, cold: [1], noSnow: [7] });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.skiingSnowboarding[6]).toBe(0); // July
    expect(explanations.skiingSnowboarding[6]).toBe('base 5 −5 noSnow (hard floor) = 0');
  });

  it('represents the inline wildlifeClosed floor (on wildlife itself) as a term', () => {
    const dest = makeDestination({
      base: { wildlifeViewing: 5 },
      wildlifeClosed: [8],
      sliderEvents: { wildlifeViewing: [{ label: 'Tigers', weight: 4, months: { 8: 1 } }] },
    });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.wildlifeViewing[7]).toBe(1); // August
    expect(explanations.wildlifeViewing[7]).toBe('base 5 +4 Tigers −8 wildlifeClosed floor = 1');
  });

  it('appends a note when the separate post-loop wildlifeClosed floor lowers birding', () => {
    // birding has its own independent wildlifeClosed floor applied after
    // every slider is computed (see the deriveDestinationScores loop) —
    // distinct from wildlife's inline one covered above.
    const dest = makeDestination({ base: { birding: 9 }, wildlifeClosed: [5] });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.birding[4]).toBe(3); // May
    expect(explanations.birding[4]).toBe('base 9 (flat, no seasonal adjustment) → wildlifeClosed floor, now 3');
  });

  it('explains an inaccessible month as a hard zero for every slider', () => {
    const dest = makeDestination({ base: { sunbathing: 8 }, inaccessible: [2] });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.sunbathing[1]).toBe(0); // February
    expect(explanations.sunbathing[1]).toBe('inaccessible this month → 0');
  });

  it('names the crowdBaseline override for deals/crowds, which have no base value at all', () => {
    const dest = makeDestination({ peak: [1], crowdBaseline: 'low' });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.deals[0]).toBe(8); // January: crowdBaseline floor overrides the peak-intensity value
    expect(explanations.deals[0]).toBe('peak month, moderate intensity → 3 → crowdBaseline (low) floor/ceiling, now 8');
  });

  it('explains the no-base-authored bail-out', () => {
    const dest = makeDestination({ base: {} });
    const { monthly, explanations } = deriveDestinationScores(dest);
    expect(monthly.sunbathing[0]).toBe(0);
    expect(explanations.sunbathing[0]).toBe('no base score authored → 0');
  });
});

describe('deriveDestinationScores — wet/hot/cold badge severity', () => {
  // Reproduces the real Galápagos/Kruger complaint: a flat 'wet' flag
  // always earned a red "Rainy season" badge even when the rain barely
  // registers (or is actively good, as in Kruger's birding season) —
  // 'mild' should read as a soft, non-alarming yellow pill, not the same
  // red/bad tone as a real rainy season. (An earlier version hid the
  // badge outright; real feedback was that a mild rainy season is still
  // worth mentioning, just not as a warning.)
  it('shows a soft warn-toned badge (not hidden, not bad) for a mild wet/hot/cold month', () => {
    const dest = makeDestination({ wet: [11], wetSeverity: 'mild', hot: [7], hotSeverity: 'mild' });
    const { badges } = deriveDestinationScores(dest);
    expect(badges[10]).toContainEqual({ label: 'Rainy season', tone: 'warn' });
    expect(badges[6]).toContainEqual({ label: 'Very hot', tone: 'warn' });
  });

  it('keeps the existing tone for an unclassified (moderate-default) month', () => {
    const dest = makeDestination({ wet: [11], hot: [7], cold: [1] });
    const { badges } = deriveDestinationScores(dest);
    expect(badges[10]).toContainEqual({ label: 'Rainy season', tone: 'bad' });
    expect(badges[6]).toContainEqual({ label: 'Very hot', tone: 'warn' });
    expect(badges[0]).toContainEqual({ label: 'Very cold', tone: 'warn' });
  });

  // Reproduces the real Andalucía complaint: genuinely extreme heat
  // (40°C+) read with the exact same soft 'warn' tone as any other hot
  // month — 'severe' should escalate to 'bad', same as an actual hazard.
  it('escalates hot/cold to a bad-toned badge when severe', () => {
    const dest = makeDestination({ hot: [8], hotSeverity: 'severe', cold: [1], coldSeverity: 'severe' });
    const { badges } = deriveDestinationScores(dest);
    expect(badges[7]).toContainEqual({ label: 'Very hot', tone: 'bad' });
    expect(badges[0]).toContainEqual({ label: 'Very cold', tone: 'bad' });
  });
});

describe('deriveDestinationScores — seasonalHazards', () => {
  // Reproduces the Caribbean-hurricane-season gap: a targeted hazard
  // should only drag down the sliders it actually names, not the whole
  // destination — unlike the blanket wet/hot/cold flags.
  it('multiplies down only the affected sliders in an active hazard month', () => {
    const dest = makeDestination({
      base: { beachesSwimming: 9, museumsArt: 9 },
      seasonalHazards: [
        { category: 'storm', label: 'Hurricane season', months: [9], severity: 'severe', affectedSliders: ['beachesSwimming'] },
      ],
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.beachesSwimming[8]).toBeCloseTo(9 * 0.3, 5); // September, severe → ×0.3
    expect(monthly.museumsArt[8]).toBe(9); // untouched — not in affectedSliders
    expect(monthly.beachesSwimming[7]).toBe(9); // August — outside the hazard's months
  });

  it('applies a lighter multiplier for a mild hazard and a heavier one for severe', () => {
    const mildDest = makeDestination({
      base: { beachesSwimming: 10 },
      seasonalHazards: [{ category: 'seaweed', label: 'Sargassum', months: [6], severity: 'mild', affectedSliders: ['beachesSwimming'] }],
    });
    const severeDest = makeDestination({
      base: { beachesSwimming: 10 },
      seasonalHazards: [{ category: 'seaweed', label: 'Sargassum', months: [6], severity: 'severe', affectedSliders: ['beachesSwimming'] }],
    });
    const mild = deriveDestinationScores(mildDest).monthly.beachesSwimming[5];
    const severe = deriveDestinationScores(severeDest).monthly.beachesSwimming[5];
    expect(mild).toBeGreaterThan(severe);
  });

  it('surfaces the hazard as a badge, soft-toned when mild', () => {
    const severeDest = makeDestination({
      seasonalHazards: [{ category: 'airQuality', label: 'Peak smog season', months: [12], severity: 'severe', affectedSliders: ['museumsArt'] }],
    });
    const mildDest = makeDestination({
      seasonalHazards: [{ category: 'seaweed', label: 'Light sargassum', months: [6], severity: 'mild', affectedSliders: ['beachesSwimming'] }],
    });
    expect(deriveDestinationScores(severeDest).badges[11]).toContainEqual({ label: 'Peak smog season', tone: 'bad' });
    expect(deriveDestinationScores(mildDest).badges[5]).toContainEqual({ label: 'Light sargassum', tone: 'warn' });
  });
});

describe('deriveDestinationScores — scoreOverrides (admin per-month exact value)', () => {
  it('wins over the formula-computed value for the overridden month only', () => {
    const dest = makeDestination({
      base: { beachesSwimming: 5 },
      scoreOverrides: { beachesSwimming: { 5: 10 } }, // June (index 5)
    });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.beachesSwimming[5]).toBe(10);
    expect(monthly.beachesSwimming[4]).toBe(5); // May — untouched
  });

  it('wins over sliderCaps, the inaccessible hard-zero, and seasonalHazards alike', () => {
    const cappedDest = makeDestination({
      base: { wildlifeViewing: 9 },
      sliderCaps: { wildlifeViewing: 4 },
      scoreOverrides: { wildlifeViewing: { 0: 8 } },
    });
    expect(deriveDestinationScores(cappedDest).monthly.wildlifeViewing[0]).toBe(8);

    const inaccessibleDest = makeDestination({
      base: { hiking: 8 },
      inaccessible: [1],
      scoreOverrides: { hiking: { 0: 7 } },
    });
    expect(deriveDestinationScores(inaccessibleDest).monthly.hiking[0]).toBe(7);

    const hazardDest = makeDestination({
      base: { beachesSwimming: 9 },
      seasonalHazards: [{ category: 'storm', label: 'Hurricane season', months: [9], severity: 'severe', affectedSliders: ['beachesSwimming'] }],
      scoreOverrides: { beachesSwimming: { 8: 6 } },
    });
    expect(deriveDestinationScores(hazardDest).monthly.beachesSwimming[8]).toBe(6);
  });

  it('clamps an out-of-range override into 0-10, same as any other computed value', () => {
    const dest = makeDestination({ base: { golf: 5 }, scoreOverrides: { golf: { 0: 15 } } });
    expect(deriveDestinationScores(dest).monthly.golf[0]).toBe(10);
  });
});

describe('isSliderNA — the NEVER_NA guard', () => {
  // `sunbathing` is never structurally absent: people sunbathe by hotel
  // pools, on terraces, by lakes and in deserts. The guard exists so no
  // destination can claim otherwise.
  //
  // It was briefly removed, because it appeared to be manufacturing
  // all-zero sunbathing rows in breach of the "nothing scores zero in every
  // month" invariant. That read the evidence backwards — the zeros were an
  // authoring gap, and removing the guard silently marked 37 destinations
  // N/A for sunbathing, Napa and the Atacama among them. The right fix was
  // to author the missing scores. This test pins the guard so the same
  // reasoning cannot undo it twice.
  it('refuses an N/A claim for an interest that is never structurally absent', () => {
    const dest = makeDestination({ naSliders: ['sunbathing'] });
    expect(isSliderNA(dest, 'sunbathing')).toBe(false);
  });

  it('honours N/A for interests that genuinely can be absent', () => {
    const dest = makeDestination({ naSliders: ['diving'] });
    expect(isSliderNA(dest, 'diving')).toBe(true);
  });

  it('leaves sliders off the N/A list alone', () => {
    const dest = makeDestination({ naSliders: ['diving'] });
    expect(isSliderNA(dest, 'beachesSwimming')).toBe(false);
  });
});

describe('deriveDestinationScores — deals/crowds in inaccessible months', () => {
  // Both scores derive from the peak/low flags alone, so a month nobody can
  // visit read as deep low season and scored 9 for each: Antarctica
  // advertised its best deals and emptiest months for April through
  // October, when no ship sails, and Ladakh did the same for January.
  // Emptiness you cannot enter is not a feature.
  it('zeroes deals and crowds in an inaccessible month', () => {
    const dest = makeDestination({ low: [7], inaccessible: [7] });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.deals[6]).toBe(0);
    expect(monthly.crowds[6]).toBe(0);
  });

  it('still scores an accessible low-season month as a bargain', () => {
    const dest = makeDestination({ low: [7], inaccessible: [] });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.deals[6]).toBeGreaterThan(8);
  });

  it('overrides the crowdBaseline floor, which runs before it', () => {
    // crowdBaseline 'low' floors an off-peak month at 10; inaccessibility
    // has to win or the floor silently reinstates the bug.
    const dest = makeDestination({ crowdBaseline: 'low', inaccessible: [1] });
    const { monthly } = deriveDestinationScores(dest);
    expect(monthly.crowds[0]).toBe(0);
  });
});

describe('deriveDestinationScores — sun formula and heat', () => {
  // The sun formula applied a flat -2 for a `hot` month, copied from the
  // formulas where heat is a hazard. On sunbathing that is backwards: Rome
  // scored 0 in July and August and better in November, and Punta Cana
  // dropped to 3 in high summer. 45 destinations sagged in exactly the
  // months people go there to lie in the sun.
  it('treats a hot month as a bonus for sunbathing, not a penalty', () => {
    const warm = makeDestination({ base: { sunbathing: 6 }, hot: [7] });
    const plain = makeDestination({ base: { sunbathing: 6 } });
    expect(deriveDestinationScores(warm).monthly.sunbathing[6])
      .toBeGreaterThan(deriveDestinationScores(plain).monthly.sunbathing[6]);
  });

  it('still penalises genuinely severe heat', () => {
    const scorching = makeDestination({ base: { sunbathing: 6 }, hot: [7], hotSeverity: 'severe' });
    const plain = makeDestination({ base: { sunbathing: 6 } });
    expect(deriveDestinationScores(scorching).monthly.sunbathing[6])
      .toBeLessThan(deriveDestinationScores(plain).monthly.sunbathing[6]);
  });

  it('leaves heat a penalty for hiking-family sliders', () => {
    const warm = makeDestination({ base: { hiking: 6 }, hot: [7] });
    const plain = makeDestination({ base: { hiking: 6 } });
    expect(deriveDestinationScores(warm).monthly.hiking[6])
      .toBeLessThan(deriveDestinationScores(plain).monthly.hiking[6]);
  });
});

describe('deriveDestinationScores — sliders whose defining condition is another slider\'s hazard', () => {
  // The same bug class as the sun formula's flat -2 for heat, found by
  // scripts/audit-seasonal-signs.ts. Six sliders share the `swim` formula
  // and two of them want exactly what it penalises.
  it('rewards a cold month for hot springs', () => {
    const cold = makeDestination({ base: { hotSprings: 6 }, cold: [1] });
    const plain = makeDestination({ base: { hotSprings: 6 } });
    expect(deriveDestinationScores(cold).monthly.hotSprings[0])
      .toBeGreaterThan(deriveDestinationScores(plain).monthly.hotSprings[0]);
  });

  it('rewards a swimHazard month for surfing — hazard season is swell season', () => {
    const stormy = makeDestination({ base: { surfing: 6 }, swimHazard: [1] });
    const plain = makeDestination({ base: { surfing: 6 } });
    expect(deriveDestinationScores(stormy).monthly.surfing[0])
      .toBeGreaterThan(deriveDestinationScores(plain).monthly.surfing[0]);
  });

  it('still penalises both conditions for actual swimmers', () => {
    const plain = makeDestination({ base: { beachesSwimming: 8 } });
    const cold = makeDestination({ base: { beachesSwimming: 8 }, cold: [1] });
    const stormy = makeDestination({ base: { beachesSwimming: 8 }, swimHazard: [1] });
    expect(deriveDestinationScores(cold).monthly.beachesSwimming[0])
      .toBeLessThan(deriveDestinationScores(plain).monthly.beachesSwimming[0]);
    expect(deriveDestinationScores(stormy).monthly.beachesSwimming[0])
      .toBeLessThan(deriveDestinationScores(plain).monthly.beachesSwimming[0]);
  });

  it('does not dock wildflower blooms for a wet month — blooms follow the rain', () => {
    const wet = makeDestination({ base: { wildflowerBlooms: 6 }, wet: [4] });
    const plain = makeDestination({ base: { wildflowerBlooms: 6 } });
    expect(deriveDestinationScores(wet).monthly.wildflowerBlooms[3])
      .toBe(deriveDestinationScores(plain).monthly.wildflowerBlooms[3]);
  });

  it('still docks wildlife viewing for a wet month outside its peak', () => {
    const wet = makeDestination({ base: { wildlifeViewing: 6 }, wet: [4] });
    const plain = makeDestination({ base: { wildlifeViewing: 6 } });
    expect(deriveDestinationScores(wet).monthly.wildlifeViewing[3])
      .toBeLessThan(deriveDestinationScores(plain).monthly.wildlifeViewing[3]);
  });
});

describe('deriveDestinationScores — the luxury formula', () => {
  // luxuryHotels, allInclusive and themeParks had no case at all and fell
  // through to `v = base`, coming out perfectly flat: 0.0 mean amplitude
  // across 245 destination-rows. luxuryHotels is a popular-tier interest
  // scored for all 200 destinations and is often a destination's third
  // largest contributor, so a seasonless slider propped up rankings in
  // every month of the year.
  it('docks a wet month for luxury hotels', () => {
    const wet = makeDestination({ base: { luxuryHotels: 8 }, wet: [9] });
    const plain = makeDestination({ base: { luxuryHotels: 8 } });
    expect(deriveDestinationScores(wet).monthly.luxuryHotels[8])
      .toBeLessThan(deriveDestinationScores(plain).monthly.luxuryHotels[8]);
  });

  it('zeroes an inaccessible month — you cannot stay somewhere you cannot reach', () => {
    const dest = makeDestination({ base: { luxuryHotels: 9 }, inaccessible: [2] });
    expect(deriveDestinationScores(dest).monthly.luxuryHotels[1]).toBe(0);
  });

  it('docks a storm-hazard month for all-inclusives but not for luxury hotels generally', () => {
    const stormy = makeDestination({ base: { allInclusive: 8, luxuryHotels: 8 }, swimHazard: [9] });
    const plain = makeDestination({ base: { allInclusive: 8, luxuryHotels: 8 } });
    const s = deriveDestinationScores(stormy).monthly;
    const p = deriveDestinationScores(plain).monthly;
    expect(s.allInclusive[8]).toBeLessThan(p.allInclusive[8]);
    expect(s.luxuryHotels[8]).toBe(p.luxuryHotels[8]);
  });

  it('docks a cold month for theme parks only', () => {
    const cold = makeDestination({ base: { themeParks: 7, luxuryHotels: 7 }, cold: [1] });
    const plain = makeDestination({ base: { themeParks: 7, luxuryHotels: 7 } });
    expect(deriveDestinationScores(cold).monthly.themeParks[0])
      .toBeLessThan(deriveDestinationScores(plain).monthly.themeParks[0]);
    expect(deriveDestinationScores(cold).monthly.luxuryHotels[0])
      .toBe(deriveDestinationScores(plain).monthly.luxuryHotels[0]);
  });
});
