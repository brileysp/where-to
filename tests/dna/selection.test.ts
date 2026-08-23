import { describe, expect, it, vi } from 'vitest';
import { chooseNextCard, alignmentScore, categorySwipeStats } from '@/lib/dna/selection';
import { checkDomainUnlocks } from '@/lib/dna/domains';
import { createInitialDNAState } from '@/lib/dna/state';
import { applySwipeBothSides, cards, createStatePair, dimensions, domains, legacy, mulberry32 } from './helpers';
import type { SwipeType } from '@/lib/dna/types';

// A deterministic (not random) "how did the user respond" function, so
// the session evolves realistically without adding a second source of
// nondeterminism on top of the thing actually under test.
function scriptedResponse(step: number): SwipeType {
  const cycle: SwipeType[] = ['yes', 'love', 'no', 'yes'];
  return cycle[step % cycle.length];
}

describe('alignmentScore / categorySwipeStats — exact diff vs legacy engine', () => {
  it('matches legacy for every card against an evolved profile', () => {
    let { legacyState, newState } = createStatePair();
    for (let i = 0; i < 30; i++) {
      const card = cards[i % cards.length];
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, card.id, scriptedResponse(i)));
    }
    for (const card of cards) {
      expect(alignmentScore(card, newState.profile)).toBe(legacy.alignmentScore(card, legacyState.profile));
    }
    expect(categorySwipeStats(newState, cards)).toEqual(legacy.categorySwipeStats(legacyState, cards));
  });
});

describe('chooseNextCard — exact diff vs legacy engine, given an identical Math.random() sequence at every step', () => {
  it('picks the exact same card id at every step of a 120-swipe simulated session', () => {
    let { legacyState, newState } = createStatePair();

    for (let step = 0; step < 120; step++) {
      legacyState.swipeCount = legacyState.swipes.length;
      newState.swipeCount = newState.swipes.length;

      const rngLegacy = mulberry32(9001 + step);
      const spyLegacy = vi.spyOn(Math, 'random').mockImplementation(rngLegacy);
      const legacyCard = legacy.chooseNextCard(legacyState, cards);
      spyLegacy.mockRestore();

      const rngNew = mulberry32(9001 + step);
      const spyNew = vi.spyOn(Math, 'random').mockImplementation(rngNew);
      const newCard = chooseNextCard(newState, cards, domains);
      spyNew.mockRestore();

      expect(newCard?.id, `step ${step}`).toBe(legacyCard?.id);

      if (!legacyCard) break; // deck exhausted on both sides simultaneously — session over

      const swipeType = scriptedResponse(step);
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, legacyCard.id, swipeType));

      // Mirror domain unlocks into state exactly as dna-ui.js's handleSwipe
      // does, so downstream picks (which depend on isDomainUnlocked /
      // promisingDomainKeys) stay driven by identical state on both sides.
      const legacyUnlocked = legacy.checkDomainUnlocks(legacyState);
      const newUnlocked = checkDomainUnlocks(newState, cards, domains);
      legacyState.unlockedDomains = [...legacyState.unlockedDomains, ...legacyUnlocked];
      newState.unlockedDomains = [...newState.unlockedDomains, ...newUnlocked];
    }
  });

  it('never returns a card excluded by Basics filters (luxury-only, no-kids scenario)', () => {
    const restrictiveBands = {
      budget: ['highend', 'luxury'],
      weather: ['cold', 'cool', 'warm', 'hot'],
      vibe: ['secluded', 'easygoing', 'lively', 'highenergy'],
      physical: ['easy', 'moderate', 'active', 'challenging'],
    };
    let { newState } = createStatePair();
    newState = { ...newState, bands: restrictiveBands as never, companions: [] };

    const rng = mulberry32(555);
    const spy = vi.spyOn(Math, 'random').mockImplementation(rng);
    for (let step = 0; step < 40; step++) {
      newState.swipeCount = newState.swipes.length;
      const card = chooseNextCard(newState, cards, domains);
      if (!card) break;
      expect(card.category, `step ${step}`).not.toBe('Rustic Adventure');
      expect(card.category, `step ${step}`).not.toBe('Family');
      const swipeType = scriptedResponse(step);
      newState = {
        ...newState,
        swipes: [...newState.swipes, { cardId: card.id, type: swipeType, timestamp: 0 }],
        answeredCardIds: [...newState.answeredCardIds, card.id],
      };
    }
    spy.mockRestore();
  });
});

describe('chooseNextCard — Mode 0.5 picked-interest priority boost', () => {
  // Regression test for a real product gap: picking "Photography" on the
  // Basics screen pooled Photography's cards together with categories the
  // interest picker doesn't even cover (tier1, e.g. Cities) in Mode 1, so
  // picking an interest barely changed how often it actually appeared —
  // its Mode-1 share was proportional to card count alone (~15/76 for
  // Photography vs ~11/76 for Cities, a category nobody picked). Mode 0.5
  // gives a directly-picked category its own standing draw, independent
  // of card-count parity with unrelated tier1 categories.
  it('draws from the picked-interest category (Photography) far more often than an unpicked tier1 category (Cities) with a similar card count', () => {
    const TRIALS = 400;
    const counts: Record<string, number> = { Photography: 0, Cities: 0, other: 0 };

    for (let trial = 0; trial < TRIALS; trial++) {
      let state = createInitialDNAState(dimensions);
      state = { ...state, pickedInterests: ['photography'], swipeCount: 0 };

      const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(31000 + trial));
      const card = chooseNextCard(state, cards, domains);
      spy.mockRestore();

      if (!card) continue;
      if (card.category === 'Photography') counts.Photography += 1;
      else if (card.category === 'Cities') counts.Cities += 1;
      else counts.other += 1;
    }

    const photographyShare = counts.Photography / TRIALS;
    const citiesShare = counts.Cities / TRIALS;

    // Before the Mode 0.5 boost, these two shares tracked their card
    // counts almost exactly (~15/76 vs ~11/76 — roughly 1.4x apart). The
    // boost should widen that gap substantially.
    expect(photographyShare).toBeGreaterThan(citiesShare * 3);
    // Sanity bound tied to the 0.4 Mode-0.5 probability itself, not just
    // the ratio — guards against a future refactor accidentally routing
    // Mode 0.5 through a much lower effective rate.
    expect(photographyShare).toBeGreaterThan(0.3);
  });

  it('does not affect selection at all when no interests are picked', () => {
    let { legacyState, newState } = createStatePair();
    for (let step = 0; step < 40; step++) {
      legacyState.swipeCount = legacyState.swipes.length;
      newState.swipeCount = newState.swipes.length;

      const rngLegacy = mulberry32(4200 + step);
      const spyLegacy = vi.spyOn(Math, 'random').mockImplementation(rngLegacy);
      const legacyCard = legacy.chooseNextCard(legacyState, cards);
      spyLegacy.mockRestore();

      const rngNew = mulberry32(4200 + step);
      const spyNew = vi.spyOn(Math, 'random').mockImplementation(rngNew);
      const newCard = chooseNextCard(newState, cards, domains);
      spyNew.mockRestore();

      expect(newCard?.id, `step ${step}`).toBe(legacyCard?.id);
      if (!legacyCard) break;

      const swipeType = scriptedResponse(step);
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, legacyCard.id, swipeType));
    }
  });
});
