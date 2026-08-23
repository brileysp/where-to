import { describe, expect, it } from 'vitest';
import { generateLearningCheck } from '@/lib/dna/summary';
import { applySwipeToProfile } from '@/lib/dna/profile';
import { createInitialDNAState } from '@/lib/dna/state';
import type { DnaCard, DnaState, SwipeType, TensionDef } from '@/lib/dna/types';

function makeCard(id: string, preferenceSignals: Record<string, number>): DnaCard {
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

function swipe(state: DnaState, card: DnaCard, type: SwipeType): DnaState {
  return {
    ...state,
    profile: applySwipeToProfile(state.profile, card, type),
    swipes: [...state.swipes, { cardId: card.id, type, timestamp: 0 }],
    answeredCardIds: [...state.answeredCardIds, card.id],
    swipeCount: state.swipeCount + 1,
  };
}

// No-contrast tension: both sides plain 'profile', no negative-signal
// cards authored anywhere, so opposingCardIds can never be non-empty.
const NO_CONTRAST_TENSION: TensionDef = {
  id: 'nc',
  title: 'No contrast tension',
  insightText: 'nc insight',
  recommendationImplication: null,
  relatedDimensions: [],
  signalA: { label: 'A', type: 'profile', keys: ['nc_a'], min: 1 },
  signalB: { label: 'B', type: 'profile', keys: ['nc_b'], min: 1 },
};

// Contrastive tension: side A has a real "no" swipe on a negative-signal
// card (rejectedOppositeSideEvidence), so opposingCardIds is non-empty.
const WITH_CONTRAST_TENSION: TensionDef = {
  id: 'wc',
  title: 'With contrast tension',
  insightText: 'wc insight',
  recommendationImplication: null,
  relatedDimensions: [],
  signalA: { label: 'A', type: 'profile', keys: ['wc_a'], min: 1 },
  signalB: { label: 'B', type: 'profile', keys: ['wc_b'], min: 1 },
};

describe('generateLearningCheck — contrastive-first, patience for additive-only', () => {
  it('does not fire an additive-only candidate below the higher (0.7) bar', () => {
    let state = createInitialDNAState([]);
    // 2 cards per side + love => confidence 0.65, below the no-contrast bar.
    const ncA1 = makeCard('nc_a1', { nc_a: 2 });
    const ncA2 = makeCard('nc_a2', { nc_a: 2 });
    const ncB1 = makeCard('nc_b1', { nc_b: 2 });
    const ncB2 = makeCard('nc_b2', { nc_b: 2 });
    [ncA1, ncA2, ncB1, ncB2].forEach((c) => {
      state = swipe(state, c, 'love');
    });
    for (let i = 0; i < 8; i++) {
      state = swipe(state, makeCard(`filler_${i}`, { filler: 1 }), 'yes');
    }
    expect(state.swipeCount).toBeGreaterThanOrEqual(12);

    const check = generateLearningCheck(state, [ncA1, ncA2, ncB1, ncB2], [], [NO_CONTRAST_TENSION]);
    expect(check).toBeNull();
  });

  it('fires the additive-only candidate once it clears the higher (0.7) bar', () => {
    let state = createInitialDNAState([]);
    // 3 cards per side + love => confidence 0.825, above the no-contrast bar.
    const cardsUsed = [
      makeCard('nc_a1', { nc_a: 2 }),
      makeCard('nc_a2', { nc_a: 2 }),
      makeCard('nc_a3', { nc_a: 2 }),
      makeCard('nc_b1', { nc_b: 2 }),
      makeCard('nc_b2', { nc_b: 2 }),
      makeCard('nc_b3', { nc_b: 2 }),
    ];
    cardsUsed.forEach((c) => {
      state = swipe(state, c, 'love');
    });
    for (let i = 0; i < 8; i++) {
      state = swipe(state, makeCard(`filler_${i}`, { filler: 1 }), 'yes');
    }
    expect(state.swipeCount).toBeGreaterThanOrEqual(12);

    const check = generateLearningCheck(state, cardsUsed, [], [NO_CONTRAST_TENSION]);
    expect(check).not.toBeNull();
    expect(check?.refId).toBe('nc');
  });

  it('prefers a lower-confidence CONTRASTIVE candidate over a higher-confidence additive-only one', () => {
    let state = createInitialDNAState([]);

    // no-contrast tension: pushed to high confidence (~1.0, well above 0.7).
    const ncCards = [
      makeCard('nc_a1', { nc_a: 2 }),
      makeCard('nc_a2', { nc_a: 2 }),
      makeCard('nc_a3', { nc_a: 2 }),
      makeCard('nc_a4', { nc_a: 2 }),
      makeCard('nc_b1', { nc_b: 2 }),
      makeCard('nc_b2', { nc_b: 2 }),
      makeCard('nc_b3', { nc_b: 2 }),
      makeCard('nc_b4', { nc_b: 2 }),
    ];
    ncCards.forEach((c) => {
      state = swipe(state, c, 'love');
    });

    // contrastive tension: only ~0.65 confidence, but has 2 real rejections
    // (the min for opposing evidence to count as contrast at all).
    const wcA1 = makeCard('wc_a1', { wc_a: 2 });
    const wcA2 = makeCard('wc_a2', { wc_a: 2 });
    const wcB1 = makeCard('wc_b1', { wc_b: 2 });
    const wcB2 = makeCard('wc_b2', { wc_b: 2 });
    const wcRejected = makeCard('wc_a_neg', { wc_a: -2 }); // represents "the opposite of A", taken too far
    const wcRejected2 = makeCard('wc_a_neg2', { wc_a: -2 });
    [wcA1, wcA2, wcB1, wcB2].forEach((c) => {
      state = swipe(state, c, 'love');
    });
    state = swipe(state, wcRejected, 'no');
    state = swipe(state, wcRejected2, 'no');

    const allCards = [...ncCards, wcA1, wcA2, wcB1, wcB2, wcRejected, wcRejected2];
    const check = generateLearningCheck(state, allCards, [], [NO_CONTRAST_TENSION, WITH_CONTRAST_TENSION]);

    expect(check).not.toBeNull();
    expect(check?.refId).toBe('wc');
  });
});
