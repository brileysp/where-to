import { describe, expect, it, vi } from 'vitest';
import {
  checkDomainUnlocks,
  domainSwipeStats,
  buildDeepDiveQueue,
  startDeepDive,
  isDeepDiveComplete,
  generateDomainRecap,
  resolveAxisOptions,
  rebranchDeepDiveQueue,
  maybeExtendDeepDive,
  resolveEarnedStyles,
  hasEarnedDomainNuance,
  resolveUnresolvedDomains,
  DOMAIN_CORE_AXES,
} from '@/lib/dna/domains';
import { applySwipeToProfile } from '@/lib/dna/profile';
import { createInitialDNAState } from '@/lib/dna/state';
import { applySwipeBothSides, cards, createStatePair, dimensions, domains, legacy, mulberry32, scriptedSwipeSequence } from './helpers';
import type { DnaCard, DnaState } from '@/lib/dna/types';

describe('domain tracking — exact diff vs legacy engine', () => {
  it('domainSwipeStats matches legacy after 50 scripted swipes', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(50, 8);
    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
    }
    expect(domainSwipeStats(newState, cards, domains)).toEqual(legacy.domainSwipeStats(legacyState));
  });

  it('checkDomainUnlocks fires the same newly-unlocked domains at the same swipe as legacy', () => {
    // Bias the sequence toward Birding cards so a real unlock actually
    // happens within a reasonable number of swipes, exercising the "2+
    // Love OR 4+ positive" threshold rather than just the empty case.
    const birdingCards = cards.filter((c) => c.domain === 'Birding' || c.category === 'Birding');
    expect(birdingCards.length).toBeGreaterThan(4);

    let { legacyState, newState } = createStatePair();
    for (let i = 0; i < Math.min(6, birdingCards.length); i++) {
      const cardId = birdingCards[i].id;
      const swipeType = i < 2 ? 'love' : 'yes';
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));

      const legacyUnlocked = legacy.checkDomainUnlocks(legacyState).sort();
      const newUnlocked = checkDomainUnlocks(newState, cards, domains).sort();
      expect(newUnlocked).toEqual(legacyUnlocked);

      // Mirror the unlock into state the same way dna-ui.js would, so
      // "already unlocked, never re-fires" stays in sync going forward.
      legacyState.unlockedDomains = [...legacyState.unlockedDomains, ...legacyUnlocked];
      newState.unlockedDomains = [...newState.unlockedDomains, ...newUnlocked];
    }
  });
});

describe('buildDeepDiveQueue / startDeepDive — same shape as legacy, deliberately different picks', () => {
  // buildDeepDiveQueue no longer round-robins subdimensions in fixed
  // declaration order — it shuffles per call and reserves core-axis
  // evidence slots first (see the axis-coverage describe block below), a
  // deliberate fix for a real bug where late-declared subdimensions (or
  // any subdimension beyond desiredCount of them) could never get picked
  // at all, let alone twice. So exact parity with the legacy engine's
  // queue *contents* is no longer the right invariant for a domain with
  // no core axis either (Birding/Surfing here) — the shuffle changes
  // which subdims win a slot even for domains this fix doesn't otherwise
  // target. What should still hold: same candidate pool, same size,
  // no duplicates, and (for startDeepDive) the same target *count* as
  // legacy, since neither the MIN/MAX_QUESTIONS formula nor its own
  // Math.random() draw changed for a domain with zero axis options.
  it('produces a valid Birding queue drawn from the same legacy candidate pool, same length', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(20, 2);
    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
    }

    const rng1 = mulberry32(777);
    const spy1 = vi.spyOn(Math, 'random').mockImplementation(rng1);
    const legacyQueue = legacy.buildDeepDiveQueue('Birding', legacyState, cards, 8);
    spy1.mockRestore();

    const rng2 = mulberry32(777);
    const spy2 = vi.spyOn(Math, 'random').mockImplementation(rng2);
    const newQueue = buildDeepDiveQueue('Birding', newState, cards, domains, 8);
    spy2.mockRestore();

    expect(newQueue.length).toBe(legacyQueue.length);
    expect(new Set(newQueue).size).toBe(newQueue.length);
    const legacyCandidatePool = new Set(cards.filter((c) => c.stage === 'deep' && c.domain === 'Birding').map((c) => c.id));
    newQueue.forEach((id) => expect(legacyCandidatePool).toContain(id));
  });

  it('startDeepDive picks the same target count as legacy for a domain with no core axis', () => {
    const { newState } = createStatePair();
    const { legacyState } = createStatePair();

    const rng1 = mulberry32(123);
    const spy1 = vi.spyOn(Math, 'random').mockImplementation(rng1);
    const legacyDive = legacy.startDeepDive('Surfing', legacyState, cards);
    spy1.mockRestore();

    const rng2 = mulberry32(123);
    const spy2 = vi.spyOn(Math, 'random').mockImplementation(rng2);
    const newDive = startDeepDive('Surfing', newState, cards, domains);
    spy2.mockRestore();

    // branchedAxes/extended are new engine-only state (see
    // DOMAIN_CORE_AXES, maybeExtendDeepDive) with no legacy equivalent —
    // both should always start at their empty/false defaults regardless.
    expect(newDive.branchedAxes).toEqual([]);
    expect(newDive.extended).toBe(false);
    expect(newDive.target).toBe(legacyDive.target);
    expect(newDive.queue.length).toBe(legacyDive.queue.length);
    expect(new Set(newDive.queue).size).toBe(newDive.queue.length);
    const legacyCandidatePool = new Set(cards.filter((c) => c.stage === 'deep' && c.domain === 'Surfing').map((c) => c.id));
    newDive.queue.forEach((id) => expect(legacyCandidatePool).toContain(id));
  });
});

describe('buildDeepDiveQueue — excludes core-axis specialty cards pre-resolution', () => {
  const mtbSpecialtyIds = [
    'cycle_deep_mtb_xc_endurance',
    'cycle_deep_mtb_enduro',
    'cycle_deep_mtb_bikepark',
    'cycle_deep_mtb_bikepacking',
    'cycle_deep_mtb_all_mountain',
    'cycle_deep_mtb_skills_coaching',
  ];
  const gravelSpecialtyIds = [
    'cycle_deep_gravel_racing',
    'cycle_deep_gravel_bikepacking',
    'cycle_deep_gravel_remote',
    'cycle_deep_gravel_casual',
  ];

  // Regression test for a real production bug: specialty cards are
  // tagged with BOTH their own specialty subdimension AND the parent
  // axis key (e.g. ["xcEndurance", "mountainBiking"]) so they can serve
  // as evidence once introduced post-resolution. But that same tagging
  // meant the round-robin's 'mountainBiking'/'gravelRiding' buckets
  // contained 6-7 candidates instead of just the one true generic
  // axis-probing card — so a real user could easily be shown a narrow
  // specialty variant (and reject it) before the broad axis ever got a
  // fair, neutral chance to be evidenced at all. Runs many seeded
  // shuffles since the original bug was probabilistic — a single lucky
  // seed could otherwise mask it.
  it('never includes MTB/gravel specialty cards in an unresolved Cycling queue, across many random orderings', () => {
    const { newState } = createStatePair();
    for (let seed = 1; seed <= 30; seed++) {
      const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
      const queue = buildDeepDiveQueue('Cycling', newState, cards, domains, 10);
      spy.mockRestore();
      const leaked = queue.filter((id) => mtbSpecialtyIds.includes(id) || gravelSpecialtyIds.includes(id));
      expect(leaked).toEqual([]);
    }
  });

  it('still includes the true generic mountainBiking/gravelRiding probe cards', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(42));
    const { newState } = createStatePair();
    const queue = buildDeepDiveQueue('Cycling', newState, cards, domains, 10);
    spy.mockRestore();
    expect(queue).toContain('cycle_deep_mtb_technical');
    expect(queue).toContain('cycle_deep_gravel_backroads');
  });
});

describe('buildDeepDiveQueue — guarantees core-axis evidence coverage', () => {
  // Regression test for a real production bug: a user loved a desert
  // photography card but never earned the "Desert" pill, and never even
  // saw a forest card, because the old fixed-declaration-order round
  // robin only had room for whichever subdimensions happened to be
  // declared earliest — with 20 Landscape Photography subdimensions and
  // only 6-10 slots, deserts/mountains/forests/coastlines could each get
  // 0 or 1 card, never the 2 needed to actually resolve. Runs many seeded
  // shuffles since coverage should hold regardless of shuffle order, not
  // just for a lucky seed.
  it('reserves at least 2 cards for every Landscape Photography axis option (Terrain + Night Sky) across many seeds', () => {
    const { newState } = createStatePair();
    const axisOptionKeys = DOMAIN_CORE_AXES['Landscape Photography'].flatMap((axis) => axis.options.map((o) => o.key));
    for (let seed = 1; seed <= 20; seed++) {
      const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
      const queue = buildDeepDiveQueue('Landscape Photography', newState, cards, domains, 14);
      spy.mockRestore();
      axisOptionKeys.forEach((key) => {
        const countForKey = queue.filter((id) => {
          const card = cards.find((c) => c.id === id);
          return (card?.subdimensions || []).includes(key);
        }).length;
        expect(countForKey).toBeGreaterThanOrEqual(2);
      });
    }
  });

  it("startDeepDive gives Landscape Photography's 5 axis options enough room (10-14 questions) to all be covered", () => {
    const { newState } = createStatePair();
    for (let seed = 1; seed <= 10; seed++) {
      const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
      const dive = startDeepDive('Landscape Photography', newState, cards, domains);
      spy.mockRestore();
      expect(dive.target).toBeGreaterThanOrEqual(10);
      expect(dive.target).toBeLessThanOrEqual(14);
    }
  });

  it("does not change Cycling's question-count range (3 axis options already fit the old 6-10 range)", () => {
    const { newState } = createStatePair();
    for (let seed = 1; seed <= 10; seed++) {
      const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
      const dive = startDeepDive('Cycling', newState, cards, domains);
      spy.mockRestore();
      expect(dive.target).toBeGreaterThanOrEqual(6);
      expect(dive.target).toBeLessThanOrEqual(10);
    }
  });
});

function makeProfileCard(id: string, preferenceSignals: Record<string, number>): DnaCard {
  return {
    id,
    short: id,
    title: id,
    description: id,
    category: 'Test',
    tags: [],
    preferenceSignals,
    dimensionSignals: {},
    stage: 'broad',
    domain: null,
    niche: false,
    subdimensions: null,
    sampleDestinations: null,
    unlockMinPositive: null,
    unlockMinLove: null,
    diagnosticPurpose: null,
  };
}

function loveCard(state: DnaState, card: DnaCard): DnaState {
  return {
    ...state,
    profile: applySwipeToProfile(state.profile, card, 'love'),
    swipes: [...state.swipes, { cardId: card.id, type: 'love', timestamp: 0 }],
    answeredCardIds: [...state.answeredCardIds, card.id],
    swipeCount: state.swipeCount + 1,
  };
}

describe('generateDomainRecap — false-dichotomy and evidence-count fixes', () => {
  // Reproduces the real "you ride for the climbing, not the views" bug:
  // the old template only checked hardClimbing/mountainBiking, never
  // scenicRoadCycling, so a rider who loved BOTH still got told they
  // don't care about scenery.
  it('does not claim "not the scenery" when scenicRoadCycling is also genuinely high', () => {
    let state = createInitialDNAState(dimensions);
    const climb1 = makeProfileCard('climb1', { hardClimbing: 3 });
    const climb2 = makeProfileCard('climb2', { hardClimbing: 3 });
    const scenic1 = makeProfileCard('scenic1', { scenicRoadCycling: 3 });
    const scenic2 = makeProfileCard('scenic2', { scenicRoadCycling: 3 });
    [climb1, climb2, scenic1, scenic2].forEach((c) => {
      state = loveCard(state, c);
    });

    const recap = generateDomainRecap('Cycling', state, [climb1, climb2, scenic1, scenic2], []);
    expect(recap).not.toContain('not the scenery');
    expect(recap).toContain('AND the views');
  });

  it('still makes the exclusive claim when the opposing signal is genuinely low', () => {
    let state = createInitialDNAState(dimensions);
    const climb1 = makeProfileCard('climb1', { hardClimbing: 3 });
    const climb2 = makeProfileCard('climb2', { hardClimbing: 3 });
    [climb1, climb2].forEach((c) => {
      state = loveCard(state, c);
    });

    const recap = generateDomainRecap('Cycling', state, [climb1, climb2], []);
    expect(recap).toContain('not the scenery');
  });

  // A single strongly-loved card shouldn't be enough to earn a nuance
  // claim — matches the >=2-distinct-cards bar already used for
  // dimensions/tensions.
  it('requires at least 2 distinct evidence cards, not just one strongly-loved card', () => {
    let state = createInitialDNAState(dimensions);
    const climb1 = makeProfileCard('climb1', { hardClimbing: 10 });
    state = loveCard(state, climb1);

    const recap = generateDomainRecap('Cycling', state, [climb1], []);
    expect(recap).not.toContain('physical challenge');
  });

  // "Timing, solitude, and dramatic light" named solitude as a driver but
  // never checked for it — the same unearned-claim bug as the original
  // wildlife/cycling issues, just within a single template's own text.
  it('does not claim "solitude" drives Landscape Photography without real solitude evidence', () => {
    let state = createInitialDNAState(dimensions);
    const golden1 = makeProfileCard('golden1', { goldenHour: 3 });
    const golden2 = makeProfileCard('golden2', { goldenHour: 3 });
    [golden1, golden2].forEach((c) => {
      state = loveCard(state, c);
    });

    const recap = generateDomainRecap('Landscape Photography', state, [golden1, golden2], []);
    expect(recap).not.toContain('solitude');
  });

  it('claims "solitude" for Landscape Photography once solitude is genuinely evidenced too', () => {
    let state = createInitialDNAState(dimensions);
    const golden1 = makeProfileCard('golden1', { goldenHour: 3 });
    const golden2 = makeProfileCard('golden2', { goldenHour: 3 });
    const solitude1 = makeProfileCard('solitude1', { solitude: 3 });
    const solitude2 = makeProfileCard('solitude2', { solitude: 3 });
    [golden1, golden2, solitude1, solitude2].forEach((c) => {
      state = loveCard(state, c);
    });

    const recap = generateDomainRecap('Landscape Photography', state, [golden1, golden2, solitude1, solitude2], []);
    expect(recap).toContain('solitude');
  });

  // Reproduces the astrophotography analogue of the cycling bug: a user
  // could love astrophotography cards AND separate golden-hour/iconic
  // cards, making the "not just daytime scenery" claim false even though
  // no single card in the dataset conflates the two signals.
  it('does not claim "not just daytime scenery" when daytime landscape signal is also genuinely high', () => {
    let state = createInitialDNAState(dimensions);
    const astro1 = makeProfileCard('astro1', { astrophotography: 3 });
    const astro2 = makeProfileCard('astro2', { astrophotography: 3 });
    const iconic1 = makeProfileCard('iconic1', { iconicLandscapes: 3 });
    const iconic2 = makeProfileCard('iconic2', { iconicLandscapes: 3 });
    [astro1, astro2, iconic1, iconic2].forEach((c) => {
      state = loveCard(state, c);
    });

    const recap = generateDomainRecap('Landscape Photography', state, [astro1, astro2, iconic1, iconic2], []);
    expect(recap).not.toContain('not just daytime scenery');
  });

  it('still claims "not just daytime scenery" when daytime landscape signal is genuinely low', () => {
    let state = createInitialDNAState(dimensions);
    const astro1 = makeProfileCard('astro1', { astrophotography: 3 });
    const astro2 = makeProfileCard('astro2', { astrophotography: 3 });
    [astro1, astro2].forEach((c) => {
      state = loveCard(state, c);
    });

    const recap = generateDomainRecap('Landscape Photography', state, [astro1, astro2], []);
    expect(recap).toContain('not just daytime scenery');
  });
});

/** Loves one real card by id from the shared `cards` fixture. */
function loveRealCard(state: DnaState, cardId: string): DnaState {
  const card = cards.find((c) => c.id === cardId)!;
  return {
    ...state,
    profile: applySwipeToProfile(state.profile, card, 'love'),
    swipes: [...state.swipes, { cardId, type: 'love', timestamp: 0 }],
    answeredCardIds: [...state.answeredCardIds, cardId],
    swipeCount: state.swipeCount + 1,
  };
}

describe('resolveAxisOptions — Cycling Terrain axis', () => {
  const axis = DOMAIN_CORE_AXES.Cycling[0];

  it('does not resolve an option with fewer than 2 evidencing cards', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    expect(resolveAxisOptions(state, cards, axis)).toEqual([]);
  });

  it('resolves a single option independently once it clears its own evidence bar', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    state = loveRealCard(state, 'cycle_mountain_descent');
    const resolved = resolveAxisOptions(state, cards, axis);
    expect(resolved.map((o) => o.key)).toEqual(['mountainBiking']);
  });

  it('resolves multiple options simultaneously — the "loves everything" case', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    state = loveRealCard(state, 'cycle_mountain_descent');
    state = loveRealCard(state, 'cycle_deep_gravel_backroads');
    state = loveRealCard(state, 'cycle_gravel_backroad');
    const resolved = resolveAxisOptions(state, cards, axis).map((o) => o.key);
    expect(resolved.sort()).toEqual(['gravelRiding', 'mountainBiking']);
  });

  // Regression test: an option with NO specialty card pool (Road has
  // specialtySubdimensions: []) must still be able to resolve as a real
  // earned style purely on evidence — resolution and "has a specialty
  // pool to rebrand into" are separate questions. Previously
  // resolveAxisOptions required specialtySubdimensions.length > 0, which
  // silently made Road impossible to ever earn regardless of evidence.
  it('resolves an option with no specialty pool at all, purely on evidence', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_cafe_inns');
    state = loveRealCard(state, 'cycle_country_road');
    const roadOption = axis.options.find((o) => o.key === 'scenicRoadCycling')!;
    expect(roadOption.specialtySubdimensions).toEqual([]);
    const resolved = resolveAxisOptions(state, cards, axis);
    expect(resolved.map((o) => o.key)).toEqual(['scenicRoadCycling']);
  });
});

describe('rebranchDeepDiveQueue — adaptive Cycling deep-dive branching', () => {
  const genericDeepIds = [
    'cycle_deep_mtb_technical',
    'cycle_deep_climbing_reward',
    'cycle_deep_cafe_inns',
    'cycle_deep_ebike_scenery',
    'cycle_deep_famous_route',
  ];
  const mtbSpecialtyIds = [
    'cycle_deep_mtb_xc_endurance',
    'cycle_deep_mtb_enduro',
    'cycle_deep_mtb_bikepark',
    'cycle_deep_mtb_bikepacking',
    'cycle_deep_mtb_all_mountain',
    'cycle_deep_mtb_skills_coaching',
  ];

  function buildResolvableState(remainingQueueIds: string[]) {
    let state = createInitialDNAState(dimensions);
    genericDeepIds.forEach((id) => {
      state = loveRealCard(state, id);
    });
    // 2nd mountainBiking-evidencing card, beyond cycle_deep_mtb_technical.
    state = loveRealCard(state, 'cycle_mountain_descent');
    const queue = [...genericDeepIds, ...remainingQueueIds];
    state = {
      ...state,
      activeDeepDive: { domain: 'Cycling', queue, seenCount: genericDeepIds.length, target: queue.length, branchedAxes: [] },
    };
    return state;
  }

  it('does not rebranch before MIN_AXIS_PROBE_SWIPES real deep swipes in this domain, even with strong evidence', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    state = loveRealCard(state, 'cycle_mountain_descent');
    const queue = ['cycle_deep_mtb_technical', 'cycle_deep_cafe_inns', 'cycle_deep_famous_route'];
    state = {
      ...state,
      activeDeepDive: { domain: 'Cycling', queue, seenCount: 1, target: queue.length, branchedAxes: [] },
    };

    const result = rebranchDeepDiveQueue(state, cards, domains);
    expect(result.activeDeepDive?.queue).toEqual(queue);
    expect(result.activeDeepDive?.branchedAxes).toEqual([]);
  });

  it('swaps the remaining unanswered queue for the resolved branch specialty pool once the probe threshold is met', () => {
    const remaining = ['cycle_deep_cafe_inns_dup1', 'cycle_deep_cafe_inns_dup2', 'cycle_deep_cafe_inns_dup3'];
    // Use placeholder unanswered ids distinct from anything real, so the
    // test proves they get REPLACED rather than coincidentally kept.
    let state = buildResolvableState(remaining);

    const result = rebranchDeepDiveQueue(state, cards, domains);
    const dive = result.activeDeepDive!;

    expect(dive.branchedAxes).toEqual(['Terrain']);
    // The 5 already-answered cards stay exactly as they were, in order.
    expect(dive.queue.slice(0, 5)).toEqual(genericDeepIds);
    // The remaining slots are now real mountain-biking specialty cards,
    // not the original placeholder ids.
    const newSlots = dive.queue.slice(5);
    expect(newSlots.length).toBeGreaterThan(0);
    newSlots.forEach((id) => expect(mtbSpecialtyIds).toContain(id));
    expect(newSlots).not.toEqual(expect.arrayContaining(remaining));
  });

  it('does not re-branch an axis a second time once already branched', () => {
    let state = buildResolvableState(['placeholder_a', 'placeholder_b']);
    const firstPass = rebranchDeepDiveQueue(state, cards, domains);
    const secondPass = rebranchDeepDiveQueue(firstPass, cards, domains);
    expect(secondPass).toBe(firstPass);
  });

  it('is a no-op for domains with no declared core axes', () => {
    let state = createInitialDNAState(dimensions);
    const surfingCard = cards.find((c) => c.stage === 'deep' && c.domain === 'Surfing')!;
    state = loveRealCard(state, surfingCard.id);
    const queue = [surfingCard.id];
    state = {
      ...state,
      activeDeepDive: { domain: 'Surfing', queue, seenCount: 1, target: queue.length, branchedAxes: [] },
    };
    const result = rebranchDeepDiveQueue(state, cards, domains);
    expect(result).toBe(state);
  });
});

describe('maybeExtendDeepDive — one extra chance when the dive ends with nothing earned', () => {
  function makeDeepCard(id: string, domain: string): DnaCard {
    return {
      id,
      short: id,
      title: id,
      description: id,
      category: 'Test',
      tags: [],
      preferenceSignals: {},
      dimensionSignals: {},
      stage: 'deep',
      domain,
      niche: false,
      subdimensions: [],
      sampleDestinations: null,
      unlockMinPositive: null,
      unlockMinLove: null,
      diagnosticPurpose: null,
    };
  }

  // A domain with no DOMAIN_NUANCE_TEMPLATES entry at all can never earn
  // a nuance line, isolating the extension mechanism itself from having
  // to also avoid accidentally triggering a real template.
  const TEST_DOMAIN = 'UnitTestDomain';

  it('extends the queue by up to DEEP_DIVE_EXTENSION_SIZE real unseen cards when the dive completes with nothing earned', () => {
    const initial = [makeDeepCard('td1', TEST_DOMAIN), makeDeepCard('td2', TEST_DOMAIN)];
    const extra = [makeDeepCard('td3', TEST_DOMAIN), makeDeepCard('td4', TEST_DOMAIN), makeDeepCard('td5', TEST_DOMAIN)];
    const allCards = [...initial, ...extra];

    let state = createInitialDNAState(dimensions);
    initial.forEach((c) => {
      state = loveCard(state, c);
    });
    state = {
      ...state,
      activeDeepDive: { domain: TEST_DOMAIN, queue: initial.map((c) => c.id), seenCount: 2, target: 2, branchedAxes: [], extended: false },
    };

    expect(isDeepDiveComplete(state)).toBe(true);
    const result = maybeExtendDeepDive(state, allCards, domains);
    expect(result.activeDeepDive?.extended).toBe(true);
    // Only 3 real candidates exist beyond the initial 2, so all 3 get added.
    expect(result.activeDeepDive!.queue.length).toBe(5);
    expect(result.activeDeepDive!.target).toBe(5);
    extra.forEach((c) => expect(result.activeDeepDive!.queue).toContain(c.id));
    expect(isDeepDiveComplete(result)).toBe(false);
  });

  it('does not extend a second time', () => {
    const initial = [makeDeepCard('td1', TEST_DOMAIN)];
    const extra = [makeDeepCard('td2', TEST_DOMAIN)];
    let state = createInitialDNAState(dimensions);
    state = loveCard(state, initial[0]);
    state = {
      ...state,
      activeDeepDive: { domain: TEST_DOMAIN, queue: initial.map((c) => c.id), seenCount: 1, target: 1, branchedAxes: [], extended: true },
    };
    const result = maybeExtendDeepDive(state, [...initial, ...extra], domains);
    expect(result).toBe(state);
  });

  it('does not extend when no more real candidate cards exist', () => {
    const initial = [makeDeepCard('td1', TEST_DOMAIN)];
    let state = createInitialDNAState(dimensions);
    state = loveCard(state, initial[0]);
    state = {
      ...state,
      activeDeepDive: { domain: TEST_DOMAIN, queue: initial.map((c) => c.id), seenCount: 1, target: 1, branchedAxes: [], extended: false },
    };
    const result = maybeExtendDeepDive(state, initial, domains);
    expect(result).toBe(state);
    expect(result.activeDeepDive?.extended ?? false).toBe(false);
  });

  it('does not extend a dive that has not reached its target yet', () => {
    const initial = [makeDeepCard('td1', TEST_DOMAIN), makeDeepCard('td2', TEST_DOMAIN)];
    const extra = [makeDeepCard('td3', TEST_DOMAIN)];
    let state = createInitialDNAState(dimensions);
    state = loveCard(state, initial[0]);
    state = {
      ...state,
      activeDeepDive: { domain: TEST_DOMAIN, queue: initial.map((c) => c.id), seenCount: 1, target: 2, branchedAxes: [], extended: false },
    };
    const result = maybeExtendDeepDive(state, [...initial, ...extra], domains);
    expect(result).toBe(state);
  });

  it('does not extend when the domain has genuinely earned a real nuance line', () => {
    // Cycling has real DOMAIN_NUANCE_TEMPLATES entries — use real evidence
    // to earn one, and confirm a completed dive stays completed rather
    // than getting a pointless extra batch.
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    state = loveRealCard(state, 'cycle_mountain_descent');
    const queue = ['cycle_deep_mtb_technical'];
    state = {
      ...state,
      activeDeepDive: { domain: 'Cycling', queue, seenCount: 1, target: 1, branchedAxes: [], extended: false },
    };
    const result = maybeExtendDeepDive(state, cards, domains);
    expect(result).toBe(state);
  });
});

describe('hasEarnedDomainNuance / resolveUnresolvedDomains — the "still zeroing in" fix', () => {
  it('is false when there is not yet enough evidence for any real nuance claim', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    expect(hasEarnedDomainNuance('Cycling', state, cards)).toBe(false);
  });

  it('is true once real evidence clears a nuance template', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    state = loveRealCard(state, 'cycle_mountain_descent');
    expect(hasEarnedDomainNuance('Cycling', state, cards)).toBe(true);
  });

  it('resolveUnresolvedDomains drops only the domain that just earned a real nuance line', () => {
    let state = createInitialDNAState(dimensions);
    state = { ...state, unresolvedDeepDomains: ['Cycling', 'Surfing'] };
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    state = loveRealCard(state, 'cycle_mountain_descent');

    const result = resolveUnresolvedDomains(state, cards);
    expect(result.unresolvedDeepDomains).toEqual(['Surfing']);
  });

  it('is a no-op (same state reference) when nothing has resolved yet', () => {
    let state = createInitialDNAState(dimensions);
    state = { ...state, unresolvedDeepDomains: ['Cycling'] };
    const result = resolveUnresolvedDomains(state, cards);
    expect(result).toBe(state);
  });

  it('is a no-op when there are no unresolved domains to check', () => {
    const state = createInitialDNAState(dimensions);
    const result = resolveUnresolvedDomains(state, cards);
    expect(result).toBe(state);
  });
});

describe('resolveEarnedStyles — DNA-to-destination-scoring bridge', () => {
  it('collapses resolved axis options into a slider-keyed map', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'cycle_deep_mtb_technical');
    state = loveRealCard(state, 'cycle_mountain_descent');

    const earned = resolveEarnedStyles(state, cards);
    expect(earned).toEqual({ cyclingRoad: ['mountainBiking'] });
  });

  it('returns an empty map when nothing has resolved yet', () => {
    const state = createInitialDNAState(dimensions);
    expect(resolveEarnedStyles(state, cards)).toEqual({});
  });
});

describe('Landscape Photography — Terrain + Night Sky core axes', () => {
  const [terrainAxis, nightSkyAxis] = DOMAIN_CORE_AXES['Landscape Photography'];

  it('resolves a Terrain option purely on evidence, with no specialty pool required', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'landscape_photo_desert_roadtrip');
    state = loveRealCard(state, 'photo_desert_dunes');
    const desertOption = terrainAxis.options.find((o) => o.key === 'deserts')!;
    expect(desertOption.specialtySubdimensions).toEqual([]);
    expect(resolveAxisOptions(state, cards, terrainAxis).map((o) => o.key)).toEqual(['deserts']);
  });

  it('resolves multiple Terrain options at once — loving desert, mountain, and coastal together', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'landscape_photo_desert_roadtrip');
    state = loveRealCard(state, 'photo_desert_dunes');
    state = loveRealCard(state, 'landscape_photo_sunrise_overlook');
    state = loveRealCard(state, 'landscape_photo_mountains_alpenglow');
    state = loveRealCard(state, 'landscape_photo_coastline_cliff');
    state = loveRealCard(state, 'photo_coastline_storm');
    const resolved = resolveAxisOptions(state, cards, terrainAxis).map((o) => o.key);
    expect(resolved.sort()).toEqual(['coastlines', 'deserts', 'mountains']);
  });

  it('resolves the single-option Night Sky axis once the photo_night_sky content bug fix gives it real 2-card evidence', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'landscape_photo_dark_sky');
    state = loveRealCard(state, 'photo_night_sky');
    expect(resolveAxisOptions(state, cards, nightSkyAxis).map((o) => o.key)).toEqual(['astrophotography']);
  });

  it('does not include the new Night Sky specialty cards in an unresolved initial deep-dive queue', () => {
    const { newState } = createStatePair();
    const nightSkySpecialtyIds = [
      'landscape_photo_milky_way_season',
      'landscape_photo_aurora_chase',
      'landscape_photo_star_trails',
      'landscape_photo_moonlit_landscape',
    ];
    for (let seed = 1; seed <= 15; seed++) {
      const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
      const queue = buildDeepDiveQueue('Landscape Photography', newState, cards, domains, 10);
      spy.mockRestore();
      const leaked = queue.filter((id) => nightSkySpecialtyIds.includes(id));
      expect(leaked).toEqual([]);
    }
  });

  it('resolveEarnedStyles combines both axes under the shared landscapePhotography slider key', () => {
    let state = createInitialDNAState(dimensions);
    state = loveRealCard(state, 'landscape_photo_desert_roadtrip');
    state = loveRealCard(state, 'photo_desert_dunes');
    state = loveRealCard(state, 'landscape_photo_dark_sky');
    state = loveRealCard(state, 'photo_night_sky');
    const earned = resolveEarnedStyles(state, cards);
    expect(earned.landscapePhotography?.sort()).toEqual(['astrophotography', 'deserts']);
  });
});
