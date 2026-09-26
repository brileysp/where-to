import { describe, expect, it } from 'vitest';
import { styleAdjustedScore, scoreForMonth, timingScoreForMonth, scoreLabel, smoothedMonthlyDisplay, effectiveWeights } from '@/lib/scoring/rank';
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

describe('styleAdjustedScore', () => {
  it('returns the raw score unchanged when nothing is selected', () => {
    const dest = makeDestination({ monthly: { ...{}, cyclingRoad: new Array(12).fill(9) } });
    expect(styleAdjustedScore(dest, 'cyclingRoad', 0, undefined)).toBe(9);
    expect(styleAdjustedScore(dest, 'cyclingRoad', 0, {})).toBe(9);
  });

  // Reproduces the real "Moab/Whistler" scenario: a destination famous
  // for mountain biking, with real-but-modest road cycling — selecting
  // the style you actually care about should reflect that difference,
  // without a real-but-secondary style collapsing to zero/N/A.
  it('scores near-full for a signature style and mid-pack (not zero) for a casual one', () => {
    const dest = makeDestination({
      monthly: { cyclingRoad: new Array(12).fill(9) } as Record<string, number[]>,
      activityStyleTiers: { cyclingRoad: { mountainBiking: 'signature', scenicRoadCycling: 'casual' } },
    });
    const mountainScore = styleAdjustedScore(dest, 'cyclingRoad', 0, { cyclingRoad: ['mountainBiking'] });
    const roadScore = styleAdjustedScore(dest, 'cyclingRoad', 0, { cyclingRoad: ['scenicRoadCycling'] });

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
    const dest = makeDestination({ monthly: { scenicLandscapes: new Array(12).fill(9) } as Record<string, number[]> });
    const score = styleAdjustedScore(dest, 'scenicLandscapes', 0, { scenicLandscapes: ['mountains'] });
    expect(score).toBe(9);
  });

  // A destination that HAS been authored for this slider, where the
  // selected style specifically comes back 'none' (a real claim: we
  // looked, and it's a poor fit), still gets a real but soft penalty —
  // 0.3x per the user's explicit ask ("even then, probably a 3 vs a
  // 1.5"), not the old 0.15x.
  it('treats an authored-but-none-tier style as a soft penalty, not a near-zero', () => {
    const dest = makeDestination({
      monthly: { cyclingRoad: new Array(12).fill(9) } as Record<string, number[]>,
      activityStyleTiers: { cyclingRoad: { mountainBiking: 'signature', gravelRiding: 'none' } },
    });
    const score = styleAdjustedScore(dest, 'cyclingRoad', 0, { cyclingRoad: ['gravelRiding'] });
    expect(score).toBeCloseTo(9 * 0.3, 5);
    expect(score).toBeGreaterThan(0);
  });

  it('uses the best-matching selected style, not an average, when multiple are selected', () => {
    const dest = makeDestination({
      monthly: { cyclingRoad: new Array(12).fill(10) } as Record<string, number[]>,
      activityStyleTiers: { cyclingRoad: { mountainBiking: 'signature', scenicRoadCycling: 'casual' } },
    });
    const score = styleAdjustedScore(dest, 'cyclingRoad', 0, { cyclingRoad: ['mountainBiking', 'scenicRoadCycling'] });
    expect(score).toBe(10); // signature (1.0x), not dragged down by the casual (0.5x) side
  });
});

describe('scoreForMonth with selectedStyles', () => {
  it('produces a lower overall score for a road-only selection than a mountain-only one, at the same weight', () => {
    const dest = makeDestination({
      monthly: { ...Object.fromEntries(SLIDERS.map((s) => [s.key, new Array(12).fill(0)])), cyclingRoad: new Array(12).fill(9) },
      activityStyleTiers: { cyclingRoad: { mountainBiking: 'signature', scenicRoadCycling: 'casual' } },
    });
    const weights = { cyclingRoad: 10 };
    const mountainOnly = scoreForMonth(dest, weights, 0, {}, { cyclingRoad: ['mountainBiking'] });
    const roadOnly = scoreForMonth(dest, weights, 0, {}, { cyclingRoad: ['scenicRoadCycling'] });

    expect(mountainOnly).toBeGreaterThan(roadOnly);
    expect(roadOnly).toBeGreaterThan(0);
  });
});

describe('scoreForMonth — N/A sliders', () => {
  // An N/A slider is excluded from the BROAD average (breadth shouldn't
  // be dinged by one structurally-absent category) but scored as a real 0
  // in the priority-weighted SPECIALIST average, still occupying its normal
  // weight slot there — see the comment above `specialistScoreFor`
  // in rank.ts. That means how much an N/A slider costs you depends on
  // how exclusively you prioritized it: tied with several other top
  // priorities, it only loses its share of the tie (this test); the
  // caller's one undisputed top priority, it loses everything (see
  // 'costs a destination its full specialist credit...' below).
  it('excludes an N/A slider from the broad average, but only discounts (not zeroes) the specialist read when tied with other top priorities', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(8)));
    monthly.diving = new Array(12).fill(1); // a near-zero N/A placeholder value

    const withoutNAFlag = makeDestination({ monthly, naSliders: [] });
    const withNAFlag = makeDestination({ monthly, naSliders: ['diving'] });
    // diving ties with birding/wildlifeViewing for the #1 spot — N/A here
    // should only cost its one-third share of that tie, not the whole
    // destination's read.
    const weights = { diving: 9, birding: 9, wildlifeViewing: 9, hiking: 6, scenicLandscapes: 6 };

    const scoreCountingDiving = scoreForMonth(withoutNAFlag, weights, 0, allBandsSelected());
    const scoreExcludingDiving = scoreForMonth(withNAFlag, weights, 0, allBandsSelected());

    expect(scoreExcludingDiving).toBeGreaterThan(scoreCountingDiving);
    // Every OTHER weighted slider is a flat 8, so a fully-excluded N/A
    // would land exactly on 8 — the real answer is meaningfully lower
    // (diving's share of the top priority now scores 0, not silently
    // dropped), but still clearly high, reflecting genuine broad strength.
    // Pinned value moved from 6.6667 when the specialist read changed from
    // ordinal rank decay to proportional priority weighting; the three
    // behavioural assertions around it are unchanged and still hold.
    expect(scoreExcludingDiving).toBeCloseTo(6.4571, 3);
    expect(scoreExcludingDiving).toBeLessThan(8);
    expect(scoreExcludingDiving).toBeGreaterThan(6);
  });

  it('costs a destination its full specialist credit when N/A on the caller\'s one undisputed top priority', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(2)));
    monthly.birding = new Array(12).fill(9);
    monthly.wildlifeViewing = new Array(12).fill(9);
    monthly.diving = new Array(12).fill(1); // N/A, and weighted #1 alone — no tie to share the loss with

    const dest = makeDestination({ monthly, naSliders: ['diving'] });
    // The weights here used to read 10/9/9. Under ordinal rank decay that
    // made diving "rank 0" and the others "rank 1" — a 2x gap — so 10-vs-9
    // counted as undisputed dominance. Proportional weighting reads 10 and
    // 9 as what the traveller actually said: near-equal priorities. To
    // still test what this case is NAMED for, the gap has to be real.
    const weights = { diving: 10, birding: 6, wildlifeViewing: 6 };
    const score = scoreForMonth(dest, weights, 0, allBandsSelected());

    // diving carries most of the specialist read on its own, so N/A there
    // costs materially more than the near-tied case above — a small floor
    // above 0 (the broad average, and birding/wildlife's lower specialist
    // share, still contribute something), not a wipeout.
    expect(score).toBeGreaterThan(4);
    expect(score).toBeLessThan(6);
  });

  // The scenario that motivated this split: a searcher's stated #1
  // priority (weighted well above #2) must be able to decide the ranking
  // — a place that has the #1 interest should beat a place that only has
  // the #2 interest, even if the #2-only place scores higher on that one
  // dimension. Before this change, N/A silently opted a destination out
  // of being judged on its own worst gap, letting a strong secondary
  // interest stand in for a completely absent primary one.
  it('ranks a destination with the dominant weighted interest above one that is N/A on it but strong on a lesser interest', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(0)));
    monthly.diving = new Array(12).fill(8);
    monthly.scenicLandscapes = new Array(12).fill(5);
    const hasDiving = makeDestination({ monthly, naSliders: [] });

    const monthly2: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly2[s.key] = new Array(12).fill(0)));
    monthly2.scenicLandscapes = new Array(12).fill(9);
    monthly2.diving = new Array(12).fill(1); // irrelevant — N/A overrides the raw value
    const noDiving = makeDestination({ monthly: monthly2, naSliders: ['diving'] });

    const weights = { diving: 10, scenicLandscapes: 5 };
    const scoreHasDiving = scoreForMonth(hasDiving, weights, 0, allBandsSelected());
    const scoreNoDiving = scoreForMonth(noDiving, weights, 0, allBandsSelected());

    expect(scoreHasDiving).toBeGreaterThan(scoreNoDiving);
    // Pins moved with the switch from ordinal rank decay to proportional
    // priority weighting. scenicLandscapes at 5 against diving at 10 is now
    // worth (5/10)^2 = a quarter of diving's say rather than an ordinal
    // half, so the destination that HAS the dominant interest gains and the
    // one that lacks it loses — which is the direction this case asserts.
    expect(scoreHasDiving).toBeCloseTo(7.3, 5);
    expect(scoreNoDiving).toBeCloseTo(3.6, 5);
  });
});

describe('scoreForMonth — rank-decayed specialist read', () => {
  // Reproduces the real Iceland complaint: a user's top 3 stated
  // priorities (fishing/scenic/adventure, scored 9/9/10) produced only a
  // 6.8 overall match, diluted by lower-priority interests (diving,
  // sailing) the destination is weak at. The specialist read should be
  // dominated by rank, not just proportional to raw weight — two
  // interests close in weight (e.g. 10 and 9) should still separate
  // sharply once one is the clear #1 and the other is #2 or lower.
  it('weighs a destination heavily toward its score on the top few ranked interests', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(0)));
    monthly.fishing = new Array(12).fill(9);
    monthly.scenicLandscapes = new Array(12).fill(9);
    monthly.adventureSports = new Array(12).fill(10);
    monthly.diving = new Array(12).fill(4);
    monthly.sailing = new Array(12).fill(4);
    const dest = makeDestination({ monthly });
    // Weight order (descending): fishing, scenic, diving, sailing, adventure —
    // adventure ranked lowest of the five despite scoring highest, so this
    // also confirms the boost tracks WEIGHT rank, not destination score.
    const weights = { fishing: 10, scenicLandscapes: 9, diving: 8, sailing: 7, adventureSports: 6 };
    const score = scoreForMonth(dest, weights, 0, allBandsSelected());

    // This weight spread (10/9/8/7/6) is nearly FLAT — the traveller said
    // they care about all five almost equally — so the lean toward the top
    // is deliberately modest. Under the old ordinal rank decay, diving and
    // sailing were worth 0.25 and 0.125 despite being weighted 8 and 7,
    // which effectively ignored two interests the traveller had rated
    // highly. Proportional weighting lets their weak scores (4) drag, which
    // is what the stated preference asks for. The read still leans above a
    // pure weighted average of the same numbers (7.275).
    expect(score).toBeGreaterThan(7.3);
    expect(score).toBeLessThan(7.6);
  });

  it('leans hard toward the top interest when the traveller\'s priorities are genuinely steep', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(0)));
    monthly.fishing = new Array(12).fill(9);
    monthly.scenicLandscapes = new Array(12).fill(9);
    monthly.adventureSports = new Array(12).fill(10);
    monthly.diving = new Array(12).fill(4);
    monthly.sailing = new Array(12).fill(4);
    const dest = makeDestination({ monthly });
    // Same destination and same five interests as above, but the traveller
    // now has one clear priority instead of five near-equal ones. Fishing
    // at 10 against everything else at 3 makes the others worth (3/10)^2 =
    // 0.09 each, so the read tracks fishing's own 9 rather than averaging
    // in weak diving and sailing scores the traveller barely cares about.
    const weights = { fishing: 10, scenicLandscapes: 3, diving: 3, sailing: 3, adventureSports: 3 };
    const score = scoreForMonth(dest, weights, 0, allBandsSelected());
    expect(score).toBeGreaterThan(8);
  });

  it('treats equally-weighted interests as the same rank, not favoring whichever sorts first', () => {
    const monthlyA: Record<string, number[]> = {};
    const monthlyB: Record<string, number[]> = {};
    SLIDERS.forEach((s) => {
      monthlyA[s.key] = new Array(12).fill(0);
      monthlyB[s.key] = new Array(12).fill(0);
    });
    // Two destinations, each strong in exactly one of two equally-weighted
    // interests and weak in the other — symmetric except for which slider
    // carries the strength. If ties broke by array/sort order instead of
    // by weight, these two would score differently even though the user
    // weighted both interests identically.
    monthlyA.museumsArt = new Array(12).fill(9);
    monthlyA.architecture = new Array(12).fill(3);
    monthlyB.museumsArt = new Array(12).fill(3);
    monthlyB.architecture = new Array(12).fill(9);
    const destA = makeDestination({ monthly: monthlyA });
    const destB = makeDestination({ monthly: monthlyB });
    const weights = { museumsArt: 8, architecture: 8 };

    const scoreA = scoreForMonth(destA, weights, 0, allBandsSelected());
    const scoreB = scoreForMonth(destB, weights, 0, allBandsSelected());
    expect(scoreA).toBeCloseTo(scoreB, 5);
  });
});

/**
 * The `weights = {}` path — what a brand-new visitor sees before stating
 * any preference (ResultsApp opens with an empty weights object). Every
 * other scoreForMonth test above passes real weights, so none of them
 * reach this branch: when it was rewritten from a uniform average to
 * audience-weighted rank decay, all 257 tests passed unchanged, which is
 * exactly the coverage hole these fill.
 */
describe('scoreForMonth — default appeal (no stated preference)', () => {
  const bands = allBandsSelected();
  function withMonthly(values: Record<string, number>, overrides: Partial<ScoredDestination> = {}) {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(values[s.key] ?? 0)));
    return makeDestination({ monthly, ...overrides });
  }
  const defaultScore = (d: ScoredDestination) => scoreForMonth(d, {}, 0, bands);

  it('ranks a narrowly excellent destination above a broadly mediocre one', () => {
    // The regression this path exists to fix. The old uniform average
    // divided by every eligible slider, so middling content everywhere
    // beat genuine excellence at a few things — measured on real data,
    // default score correlated with a destination's authored-slider count
    // at r = 0.730, i.e. it was largely reporting how much had been
    // written about a place.
    const narrow = withMonthly({ cityExploration: 10, historyArchaeology: 10, streetFood: 9 });
    const broad = withMonthly(Object.fromEntries(SLIDERS.map((s) => [s.key, 4])));
    expect(defaultScore(narrow)).toBeGreaterThan(defaultScore(broad));
  });

  it('never penalises a destination for interests it simply lacks', () => {
    // Absence has to be free: Paris having no wildlife and Yellowstone
    // having no food scene are not defects. Padding a destination with
    // weak content must not lower its score, and must barely raise it.
    const strong: Record<string, number> = {
      cityExploration: 10, historyArchaeology: 10, streetFood: 9, museumsArt: 9, architecture: 9,
    };
    const weakPadding = Object.fromEntries(
      SLIDERS.filter((s) => !(s.key in strong)).slice(0, 20).map((s) => [s.key, 3]),
    );
    const bare = defaultScore(withMonthly(strong));
    const padded = defaultScore(withMonthly({ ...strong, ...weakPadding }));
    // Weak content must never lower the score, and must not meaningfully
    // raise it either — under the old mean this padding was worth over a
    // full point, which is precisely how accumulating mediocre content
    // out-ranked genuine excellence.
    expect(padded).toBeGreaterThanOrEqual(bare);
    expect(padded - bare).toBeLessThan(0.5);
  });

  it('caps how far a purely niche strength can carry a destination', () => {
    // Churchill's guard: a 10 for something few people travel for must
    // not read as broad appeal the way a 10 for beaches does.
    expect(defaultScore(withMonthly({ beachesSwimming: 10 }))).toBeGreaterThan(
      defaultScore(withMonthly({ birding: 10 })),
    );
  });

  it('treats an N/A interest and a genuine zero alike', () => {
    // Under a mean, N/A mattered enormously — it shrank the denominator,
    // so flagging a slider N/A was worth real points. Ranking by
    // contribution dissolves that: both sort to the bottom, where the
    // decay weight is ~0. N/A becomes a display concern, not a scoring one.
    const scores = { cityExploration: 10, historyArchaeology: 9, streetFood: 8 };
    const asZero = defaultScore(withMonthly(scores));
    const asNA = defaultScore(withMonthly(scores, { naSliders: ['diving', 'safari', 'golf'] }));
    expect(Math.abs(asNA - asZero)).toBeLessThan(0.01);
  });

  it('returns 0 rather than NaN when a destination has nothing to score', () => {
    // A divide-by-zero here would poison the whole ranking with NaN, which
    // sorts unpredictably rather than failing loudly.
    const score = defaultScore(withMonthly({}, { naSliders: SLIDERS.map((s) => s.key) }));
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(0);
  });
});

describe('timingScoreForMonth', () => {
  // Reproduces a real bug a data-quality audit found: seasonalHazards fed
  // a badge (via computeBadges) and a targeted per-slider penalty (via
  // deriveDestinationScores), but never touched the general comfort read
  // at all — a "Peak hurricane season" (bad) badge sat right next to an
  // "Excellent" general score at several real destinations, since nothing
  // here checked seasonalHazards. Only 'storm'/'airQuality' should pull
  // the general score down — 'insects'/'seaweed' stay narrowly scoped to
  // their affectedSliders, matching how they're deliberately real but
  // non-trip-ruining nuisances.
  it('lets a severe storm/airQuality hazard pull the general comfort score down', () => {
    const withHazard = makeDestination({
      climate: 'tropical',
      seasonalHazards: [{ category: 'storm', label: 'Peak hurricane season', months: [10], severity: 'severe', affectedSliders: ['beachesSwimming'] }],
    });
    const withoutHazard = makeDestination({ climate: 'tropical' });
    expect(timingScoreForMonth(withHazard, 9)).toBeLessThan(timingScoreForMonth(withoutHazard, 9)); // October
  });

  it('does not let an insects/seaweed hazard drag down the general comfort score', () => {
    const dest = makeDestination({
      climate: 'tropical',
      seasonalHazards: [{ category: 'seaweed', label: 'Peak sargassum season', months: [5], severity: 'severe', affectedSliders: ['beachesSwimming'] }],
    });
    const without = makeDestination({ climate: 'tropical' });
    expect(timingScoreForMonth(dest, 4)).toBeCloseTo(timingScoreForMonth(without, 4), 0); // May
  });

  // The model: most destinations, most months, "is this a good time to
  // go" really is just "is the weather pleasant" — a cold, wet month
  // reads worse than a warm, dry one, with no activity data involved at
  // all. See weatherComfortScore.
  it('defaults to weather comfort when nothing overrides it: cold+wet scores worse than warm+dry', () => {
    const dest = makeDestination({ climate: 'temperate', cold: [1], wet: [1], hot: [7], dry: [7] });
    const cold = timingScoreForMonth(dest, 0); // January
    const warm = timingScoreForMonth(dest, 6); // July

    expect(warm).toBeGreaterThan(cold);
    expect(scoreLabel(cold).cls).not.toBe('excellent');
    expect(scoreLabel(warm).cls).toMatch(/excellent|good/);
  });

  // Every month, snowsports/birding/wildlife (the comfort-independent
  // formulas) act as a floor via Math.max(comfort, exceptionPeak) — zeroing
  // them out here isolates weatherComfortScore's own severity behavior
  // from that unrelated mechanism, matching how the fixture's blanket
  // monthly=5 fill would otherwise mask a comfort score below 5.
  function zeroExceptionSliders(monthIdx: number): Record<string, number[]> {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(5)));
    // Every COMFORT_INDEPENDENT_FORMULAS slider (rank.ts), derived by
    // formula rather than hardcoded — the 'wildlife' formula alone now
    // covers 4 keys (wildlifeViewing/safari/whaleWatching/wildflowerBlooms),
    // and missing any of them here would leave it as a live, un-zeroed
    // "timing exception" candidate that floors the whole month's score via
    // Math.max(comfort, exceptionPeak), masking the severity penalty this
    // test is actually checking.
    SLIDERS.filter((s) => ['snow', 'birding', 'wildlife'].includes(s.formula)).forEach((s) => (monthly[s.key][monthIdx] = 0));
    return monthly;
  }

  // Reproduces the real Andalucía complaint: a genuinely extreme August
  // (40°C+) scored identically to any other merely-warm "hot" month and
  // still read as "Good"/"Excellent" — an unclassified (null → 'moderate')
  // hot flag must score exactly as before (zero-regression default), and
  // only an explicit 'severe' classification should push the month down
  // meaningfully.
  it('does not extra-penalize an unclassified hot/cold month, but does penalize a severe one', () => {
    const monthly = zeroExceptionSliders(7);
    const unclassified = makeDestination({ climate: 'mediterranean', hot: [8], monthly });
    const severe = makeDestination({ climate: 'mediterranean', hot: [8], hotSeverity: 'severe', monthly });

    const unclassifiedScore = timingScoreForMonth(unclassified, 7); // August
    const severeScore = timingScoreForMonth(severe, 7);

    expect(unclassifiedScore).toBeCloseTo(6, 0); // unchanged from the pre-severity 'hot' band baseline (± the small per-month texture nudge) — zero regression
    expect(severeScore).toBeLessThan(unclassifiedScore);
    expect(scoreLabel(severeScore).cls).not.toBe(scoreLabel(unclassifiedScore).cls);
  });

  // The signatureTier cutover (Phase 3): a destination-authored 'casual'
  // tier now WITHHOLDS the exception even for a structurally
  // comfort-independent formula (wildlife) — a merely-casual wildlife
  // showing in a genuinely bad-weather month shouldn't override that read,
  // the exact class of bug signatureTier exists to fix. 'signature' tier
  // grants it, same as before the cutover for this formula.
  it('signatureTier "casual" withholds the comfort-independent exception; "signature" grants it', () => {
    const monthly = zeroExceptionSliders(0);
    monthly.wildlifeViewing[0] = 9; // a strong wildlife showing this month...
    const casual = makeDestination({ climate: 'temperate', cold: [1], wet: [1], monthly, signatureTier: { wildlifeViewing: 'casual' } });
    const signature = makeDestination({ climate: 'temperate', cold: [1], wet: [1], monthly, signatureTier: { wildlifeViewing: 'signature' } });
    const comfortOnly = makeDestination({ climate: 'temperate', cold: [1], wet: [1], monthly: zeroExceptionSliders(0) }); // zero-exception baseline, no wildlife signal at all

    const casualScore = timingScoreForMonth(casual, 0); // January
    const signatureScore = timingScoreForMonth(signature, 0);
    const comfortScore = timingScoreForMonth(comfortOnly, 0);

    expect(casualScore).toBeCloseTo(comfortScore, 0); // ...but 'casual' tier means it doesn't get to override a cold/wet January
    expect(signatureScore).toBeGreaterThan(casualScore); // 'signature' tier does
  });

  // The other direction: signatureTier can grant exception status to a
  // slider whose FORMULA was never structurally comfort-independent
  // (culture) — e.g. a destination where Museums & Art is authored as a
  // genuine signature draw regardless of weather (a great museum doesn't
  // care if it's raining). Without an authored tier, culture-formula
  // sliders fall back to the old heuristic and never override comfort.
  it('signatureTier "signature" grants the exception to an otherwise-ordinary formula', () => {
    const monthly = zeroExceptionSliders(0);
    monthly.museumsArt[0] = 9;
    const unauthored = makeDestination({ climate: 'temperate', cold: [1], wet: [1], monthly }); // no signatureTier entry — old heuristic applies, 'culture' was never comfort-independent
    const signature = makeDestination({ climate: 'temperate', cold: [1], wet: [1], monthly, signatureTier: { museumsArt: 'signature' } });

    const unauthoredScore = timingScoreForMonth(unauthored, 0); // January
    const signatureScore = timingScoreForMonth(signature, 0);

    expect(signatureScore).toBeGreaterThan(unauthoredScore);
  });

  // Reproduces the real Galápagos/Kruger complaint: light, birding-boosting
  // rain scored exactly as harshly as an actual monsoon under the old flat
  // -3 wet penalty. 'mild' should cost less than the moderate default;
  // 'severe' (e.g. peak Indian monsoon) should cost more.
  it('scales the wet-month penalty by severity around the moderate default', () => {
    const monthly = zeroExceptionSliders(5);
    const mild = makeDestination({ climate: 'tropical', wet: [6], wetSeverity: 'mild', monthly });
    const moderate = makeDestination({ climate: 'tropical', wet: [6], monthly });
    const severe = makeDestination({ climate: 'tropical', wet: [6], wetSeverity: 'severe', monthly });

    const mildScore = timingScoreForMonth(mild, 5); // June
    const moderateScore = timingScoreForMonth(moderate, 5);
    const severeScore = timingScoreForMonth(severe, 5);

    expect(mildScore).toBeGreaterThan(moderateScore);
    expect(moderateScore).toBeGreaterThan(severeScore);
  });

  // Reproduces the real Colombian Caribbean complaint: a single flag
  // spanning many consecutive months (a 7-month wet/peak block, a 5-month
  // dry block) scored every one of those months at the exact same value —
  // an obviously fake flat plateau on the "Best months overall" chart,
  // since real weather never actually holds several different months at
  // one identical number. Tapering + per-month texture should make every
  // month in a long run numerically distinct.
  it('gives every month in a long flagged run a distinct score, not a flat plateau', () => {
    const dest = makeDestination({
      climate: 'tropical',
      dry: [12, 1, 2, 3, 4],
      wet: [5, 6, 7, 8, 9, 10, 11],
    });
    const scores = Array.from({ length: 12 }, (_, i) => timingScoreForMonth(dest, i));
    const distinct = new Set(scores.map((s) => s.toFixed(4)));
    expect(distinct.size).toBe(12);
  });

  // The other half of the real Colombian Caribbean bug: birding had no
  // authored birdingPeak months, so its own formula (base - a flat wet
  // penalty) was just as flat across the whole wet season as the weather
  // flags were — and since birding qualifies as a comfort-independent
  // "timing exception" (COMFORT_INDEPENDENT_FORMULAS), Math.max(comfort,
  // exceptionPeak) let that flat, higher exceptionPeak value clip every
  // one of comfort's newly-tapered months right back to one repeated
  // number. exceptionPeak needs its own texture too.
  it('does not let a flat comfort-independent exception score (no authored peak) re-flatten the month, even though every month shares the identical wet penalty', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(0)));
    // birding: flat base(7) - 1 (wet, no peak authored) = 6 for every wet
    // month — a real destination-shaped flat exception candidate.
    for (const m of [5, 6, 7, 8, 9, 10, 11]) monthly.birding[m - 1] = 6;

    const dest = makeDestination({ climate: 'tropical', hot: [6, 7, 8, 9], wet: [5, 6, 7, 8, 9, 10, 11], monthly });
    const summerScores = [6, 7, 8, 9].map((m) => timingScoreForMonth(dest, m - 1));
    expect(new Set(summerScores.map((s) => s.toFixed(3))).size).toBe(4);
  });

  // The tapering shouldn't be so strong that it reorders which part of a
  // season reads best — the middle of a run stays >= its own edges.
  it('still scores the heart of a long run at least as well as its edges', () => {
    const dest = makeDestination({ climate: 'temperate', wet: [1, 2, 3, 4, 5, 6, 7] });
    const start = timingScoreForMonth(dest, 0); // January: start of the run
    const heart = timingScoreForMonth(dest, 3); // April: the heart of the run
    expect(heart).toBeGreaterThanOrEqual(start - 0.5); // texture jitter is small; heart shouldn't be meaningfully worse
  });

  // Reproduces the real Kruger bug: birding peaks (migrant arrivals) in
  // the exact wet season that disperses game away from easy viewing, so
  // "great birding, harder general safari" was reading as a flat
  // "Excellent" every month via Math.max — crediting only the loudest of
  // two genuinely disagreeing standouts. Two independently-strong but
  // disagreeing exception candidates should defer to comfort instead of
  // one of them winning outright.
  it('defers to comfort when two comfort-independent candidates are both strong but disagree', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(0)));
    monthly.birding[0] = 10; // January: birding standout
    monthly.wildlifeViewing[0] = 7; // January: still decent, but well below birding — real disagreement, not mere noise

    // Poor comfort (hot + wet) so the only way January could read
    // "Excellent" is via one of the two exception candidates winning.
    const dest = makeDestination({ climate: 'tropical', hot: [1], wet: [1], monthly });
    const score = timingScoreForMonth(dest, 0);

    expect(score).toBeLessThan(9); // birding alone would have pushed this to ~10
    expect(scoreLabel(score).cls).not.toBe('excellent');
  });

  // The disagreement gate shouldn't fire for a single dominant exception,
  // or for two candidates that both agree (most safari destinations,
  // where birding and wildlife peak in the same season) — only genuine,
  // active disagreement between two independently-strong candidates.
  it('still lets a single or agreeing exception override comfort normally', () => {
    const soloMonthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (soloMonthly[s.key] = new Array(12).fill(0)));
    soloMonthly.wildlifeViewing[0] = 10; // only one comfort-independent candidate is actually strong
    const solo = makeDestination({ climate: 'tropical', hot: [1], wet: [1], monthly: soloMonthly });
    expect(timingScoreForMonth(solo, 0)).toBeGreaterThanOrEqual(9);

    const agreeingMonthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (agreeingMonthly[s.key] = new Array(12).fill(0)));
    agreeingMonthly.birding[0] = 9;
    agreeingMonthly.wildlifeViewing[0] = 9; // both strong, but they agree — not a real tradeoff
    const agreeing = makeDestination({ climate: 'tropical', hot: [1], wet: [1], monthly: agreeingMonthly });
    expect(timingScoreForMonth(agreeing, 0)).toBeGreaterThanOrEqual(8);
  });

  // Regression test for the real bug this replaces: skiing peaks in cold
  // weather, which is exactly what weatherComfortScore penalizes — so a
  // destination whose whole reason to visit in January is skiing must
  // still read as a great January, not a mediocre one.
  it('lets a comfort-independent exception (skiing) override bad weather comfort', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(5)));
    monthly.skiingSnowboarding = new Array(12).fill(5);
    monthly.skiingSnowboarding[0] = 10; // January: peak ski season

    const dest = makeDestination({ climate: 'temperate', cold: [1], monthly });
    const score = timingScoreForMonth(dest, 0);

    // Weather comfort alone for a cold January would be well below
    // "good" — the ski exception should pull this all the way up near 10.
    expect(score).toBeGreaterThanOrEqual(9);
  });

  // Reproduces the exact dilution bug from the first attempt at this:
  // averaging every "exception" slider together let an unrelated
  // off-season category (hiking, bad in January) drag down a genuine
  // standout (skiing, excellent in January) in the same month. Taking
  // the single best exception, not an average, is what fixes it.
  it('takes the best exception slider, not an average, so one bad exception cannot drag down a great one', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(5)));
    monthly.skiingSnowboarding = new Array(12).fill(5);
    monthly.skiingSnowboarding[0] = 10; // excellent skiing in January
    monthly.wildlifeViewing = new Array(12).fill(5);
    monthly.wildlifeViewing[0] = 1; // unrelated, genuinely bad wildlife-viewing in January

    const dest = makeDestination({ climate: 'temperate', cold: [1], monthly });
    const score = timingScoreForMonth(dest, 0);

    // An average of 10 and 1 (plus comfort) would land in the 5-6 range;
    // taking the best one should still land near 10.
    expect(score).toBeGreaterThanOrEqual(9);
  });

  // The other half of "no new authoring needed": a destination's own
  // sliderEvents entry (cherry blossoms, a harvest bump, Christmas
  // markets, ...) counts as a timing exception too, even though scenic's
  // formula is otherwise comfort-correlated, not comfort-independent.
  it('treats an authored sliderEvents entry as a timing exception, even for a comfort-correlated slider', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(5)));
    monthly.scenicLandscapes = new Array(12).fill(5);
    monthly.scenicLandscapes[3] = 10; // April: e.g. cherry blossoms

    const dest = makeDestination({
      climate: 'temperate',
      monthly,
      sliderEvents: { scenicLandscapes: [{ label: 'Cherry blossoms', weight: 5, months: { 4: 1 } }] },
    });
    const score = timingScoreForMonth(dest, 3);

    expect(score).toBeGreaterThanOrEqual(9);
  });

  // Regression test for a real bug: a slider with an event authored for
  // ONE month was being treated as a standing "timing exception" for
  // every month of the year, so its ordinary (non-event) baseline score
  // in an unrelated month could still override weather comfort — e.g. a
  // destination's Scenic Landscapes score being naturally high in a
  // brutally hot month it has no spring-wildflower event for, making the
  // "general timing" chart call that month "Excellent" while the
  // generated weather description called it miserable.
  it('does not treat a slider as a timing exception outside the months its own event actually applies', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(5)));
    monthly.scenicLandscapes = new Array(12).fill(5);
    monthly.scenicLandscapes[7] = 9; // August: just a naturally high baseline, no event this month

    const dest = makeDestination({
      climate: 'desert',
      hot: [7, 8], // August reads as hot — poor weather comfort
      monthly,
      sliderEvents: { scenicLandscapes: [{ label: 'Spring wildflower bloom', weight: 1, months: { 4: 1 } }] }, // April only
    });
    const score = timingScoreForMonth(dest, 7); // August

    // Scenic's 9 must NOT leak in here — the score should reflect the
    // hot-month weather comfort baseline, not scenic's unrelated peak.
    expect(score).toBeLessThan(9);
  });

  // deals/crowds are formula-driven (peak/low flags) but are an artifact
  // of the peak-season mechanic itself, not a reason anyone visits — they
  // must never count as a timing exception even though their formula
  // spikes hard in low season.
  it('never lets deals/crowds count as a timing exception', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(5)));
    monthly.deals = new Array(12).fill(5);
    monthly.deals[0] = 10; // a big low-season discount in January
    monthly.crowds = new Array(12).fill(5);
    monthly.crowds[0] = 10;

    const dest = makeDestination({ climate: 'temperate', cold: [1], monthly });
    const score = timingScoreForMonth(dest, 0);

    // With cold weather comfort and no legitimate exception, this should
    // stay down at the cold-comfort level, not get pulled up to 10.
    expect(score).toBeLessThan(6);
  });

  it('excludes N/A sliders from the exception pool entirely', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(5)));
    monthly.wildlifeViewing = new Array(12).fill(5);
    monthly.wildlifeViewing[0] = 10; // would otherwise be a strong January exception

    const withWildlife = makeDestination({ climate: 'temperate', cold: [1], monthly, naSliders: [] });
    const withoutWildlife = makeDestination({ climate: 'temperate', cold: [1], monthly, naSliders: ['wildlifeViewing'] });

    const scoreWith = timingScoreForMonth(withWildlife, 0);
    const scoreWithout = timingScoreForMonth(withoutWildlife, 0);

    expect(scoreWith).toBeGreaterThan(scoreWithout);
  });
});

describe('smoothedMonthlyDisplay', () => {
  // Reproduces the real Torres del Paine complaint: hikingWorst's flat -4
  // across exactly its flagged months (and hikingBest's flat +3, both
  // clamped to the same ceiling elsewhere) plotted as two obviously
  // synthetic plateaus on the "For You" tab's personalized chart — the
  // same bug already fixed for the general "About" tab chart, but never
  // extended to this one since it reads dest.monthly directly.
  it('softens a flagged dip run instead of leaving it flat', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(10)));
    monthly.hiking = [10, 10, 10, 10, 10, 6, 6, 6, 10, 10, 10, 10]; // Jun-Aug flagged "worst"
    const dest = makeDestination({ monthly });

    const values = Array.from({ length: 12 }, (_, i) => smoothedMonthlyDisplay(dest, 'hiking', i));
    // Every month in the dip is now distinct, not a flat 6/6/6.
    expect(new Set(values.slice(5, 8).map((v) => v.toFixed(3))).size).toBe(3);
    // The middle of the dip (July) stays at or below its edges (June/Aug)
    // — softening the transition shouldn't flip which month reads worst.
    expect(values[6]).toBeLessThanOrEqual(values[5] + 0.1);
    expect(values[6]).toBeLessThanOrEqual(values[7] + 0.1);
    // The edges move toward the neighboring "good" months, not away from them.
    expect(values[5]).toBeGreaterThan(6);
    expect(values[7]).toBeGreaterThan(6);
  });

  // A uniformly good multi-month stretch (most destinations, most
  // sliders) has no real dip to taper toward — it should stay
  // recognizably high, just not bit-for-bit identical every month.
  it('leaves a uniform "good" plateau close to its real value, just textured', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(9)));
    const dest = makeDestination({ monthly });

    const values = Array.from({ length: 12 }, (_, i) => smoothedMonthlyDisplay(dest, 'hiking', i));
    values.forEach((v) => expect(v).toBeGreaterThanOrEqual(8.5));
    expect(new Set(values.map((v) => v.toFixed(3))).size).toBeGreaterThan(1);
  });

  // Never touches dest.monthly itself — the real ranking math and every
  // existing exact-value test must see the original, unsmoothed numbers.
  it('does not mutate dest.monthly', () => {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(10)));
    monthly.hiking = [10, 10, 10, 10, 10, 6, 6, 6, 10, 10, 10, 10];
    const dest = makeDestination({ monthly });
    const before = [...dest.monthly.hiking];

    smoothedMonthlyDisplay(dest, 'hiking', 6);

    expect(dest.monthly.hiking).toEqual(before);
  });
});

describe('effectiveWeights — relative noise floor', () => {
  it('ignores passing mentions (3 or less) and anything at or below 30% of the top weight', () => {
    const w = effectiveWeights({ wildlifeViewing: 10, golf: 2, skiingSnowboarding: 3, hiking: 6, fishing: 8 });
    expect(w.golf).toBe(0);
    expect(w.skiingSnowboarding).toBe(0); // 30% of the top, and a passing mention
    expect(w.hiking).toBe(6);
    expect(w.fishing).toBe(8);
    expect(w.wildlifeViewing).toBe(10);
  });

  it('ramps linearly between 30% and 50% so a nudged slider does not flip a ranking', () => {
    const w = effectiveWeights({ wildlifeViewing: 10, hiking: 4 }); // 40%: halfway up the ramp
    expect(w.hiking).toBeCloseTo(2, 10);
  });

  it('leaves a traveller who weights many interests about equally untouched', () => {
    const stated = { museumsArt: 8, architecture: 8, cityExploration: 7, fineDining: 6 };
    expect(effectiveWeights(stated)).toEqual(stated);
  });

  it('is relative to the user\'s own top weight, not an absolute number', () => {
    // Someone whose top interest is a 5 still keeps a 4 (80% of their top) but not a 3.
    const w = effectiveWeights({ hiking: 5, golf: 4, skiingSnowboarding: 3 });
    expect(w.golf).toBe(4);
    expect(w.skiingSnowboarding).toBe(0);
  });

  it('ignores weights on hidden sliders, which the user cannot see or change', () => {
    // nationalParks is hidden: a persona's leftover 7 must not count, nor shrink the ramp for the rest.
    const w = effectiveWeights({ cyclingRoad: 10, scenicLandscapes: 8, nationalParks: 7 });
    expect(w.nationalParks).toBe(0);
    expect(w.cyclingRoad).toBe(10);
    expect(w.scenicLandscapes).toBe(8);
    // ... and a hidden 10 is not allowed to be the "top weight" the others are measured against.
    expect(effectiveWeights({ nationalParks: 10, hiking: 5 }).hiking).toBe(5);
  });

  it('passes an all-zero weight map through unchanged', () => {
    expect(effectiveWeights({ hiking: 0, golf: 0 })).toEqual({ hiking: 0, golf: 0 });
  });
});

describe('scoreForMonth — neutral interests do not decide a match', () => {
  const bands = allBandsSelected();
  // A persona-shaped profile: three real priorities, every other interest at the neutral 2.
  const persona: Record<string, number> = {};
  SLIDERS.forEach((s) => (persona[s.key] = 2));
  Object.assign(persona, { wildlifeViewing: 9, scenicLandscapes: 8, nationalParks: 7 });

  function dest(tops: number, elsewhere: number) {
    const monthly: Record<string, number[]> = {};
    SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(elsewhere)));
    ['wildlifeViewing', 'scenicLandscapes', 'nationalParks'].forEach((k) => (monthly[k] = new Array(12).fill(tops)));
    return makeDestination({ monthly });
  }

  it('ranks a strong match on the three priorities above a place that is merely decent at everything else', () => {
    // The Naturalist-in-May failure: Canary Islands (weak on wildlife, decent on the 38 interests
    // nobody asked about) beat Malaysian Borneo (strong on all three priorities, blank elsewhere).
    const focused = dest(9, 1);
    const padded = dest(5, 8);
    expect(scoreForMonth(focused, persona, 0, bands)).toBeGreaterThan(scoreForMonth(padded, persona, 0, bands));
  });

  it('gives interests held at the neutral weight no say at all', () => {
    const a = dest(9, 0);
    const b = dest(9, 10);
    expect(scoreForMonth(a, persona, 0, bands)).toBeCloseTo(scoreForMonth(b, persona, 0, bands), 8);
  });
});
