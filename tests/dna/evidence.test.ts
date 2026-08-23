import { describe, expect, it } from 'vitest';
import { generateEvidenceForDimension, generateEvidenceForTension, getWhyWeThinkThis, pickEvidenceCardIdsForPoles } from '@/lib/dna/evidence';
import { calculateDimensionScores } from '@/lib/dna/dimensions';
import { applyDimensionSignalsFromSwipe } from '@/lib/dna/dimensions';
import { createInitialDNAState } from '@/lib/dna/state';
import type { DimensionDef, DnaCard, DnaState, TensionDef, TensionResult } from '@/lib/dna/types';

const TEST_DIMENSION: DimensionDef = {
  id: 'test_depth_variety',
  label: 'Depth vs Variety',
  poleA: 'Depth',
  poleB: 'Variety',
  keyA: 'depth',
  keyB: 'variety',
  summaryA: 'Prefers depth.',
  summaryB: 'Prefers variety.',
  question: 'Depth or variety?',
};

function makeCard(id: string, title: string, dimensionSignals: Record<string, number>, niche = false): DnaCard {
  return {
    id,
    short: title,
    title,
    description: title,
    category: 'Test',
    tags: [],
    preferenceSignals: {},
    dimensionSignals,
    stage: 'broad',
    domain: null,
    niche,
    subdimensions: null,
    sampleDestinations: null,
    unlockMinPositive: null,
    unlockMinLove: null,
    diagnosticPurpose: null,
  };
}

describe('generateEvidenceForDimension', () => {
  // Reproduces the real "you liked wreck diving but you passed on
  // inn-to-inn cycling" bug: the user swiped LOVE on the trailing-pole
  // card, never "no" on it, but the evidence line called it "passed on".
  it('never labels a positively-swiped trailing-pole card as rejected', () => {
    const depthCard = makeCard('depth_card', 'wreck diving', { depth: 6 });
    const varietyCard = makeCard('variety_card', 'inn-to-inn cycling', { variety: 3 });
    const cards = [depthCard, varietyCard];

    let state: DnaState = createInitialDNAState([TEST_DIMENSION]);
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, depthCard, 'love', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: depthCard.id, type: 'love', timestamp: 0 }],
    };
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, varietyCard, 'love', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: varietyCard.id, type: 'love', timestamp: 1 }],
    };

    const [dimResult] = calculateDimensionScores(state, [TEST_DIMENSION]);
    expect(dimResult.leadingPole).toBe('Depth'); // depth card scored higher

    const evidence = generateEvidenceForDimension(state, cards, dimResult, [TEST_DIMENSION]);
    expect(evidence).not.toBeNull();
    expect(evidence!.opposingCardIds).toEqual([]);
    expect(evidence!.loved).toContain('variety_card');

    const why = getWhyWeThinkThis(evidence, cards);
    expect(why.rejected).toEqual([]);
    expect(why.loved.some((t) => t.includes('inn-to-inn cycling'))).toBe(true);
  });

  // The other half of the fix: a REAL "no" swipe on a trailing-pole card
  // should show up as genuine "passed on" evidence — this is what makes
  // the insight feel earned instead of just a list of things anyone
  // would like.
  it('surfaces real no-swipes on trailing-pole cards as rejected evidence, once there are 2+', () => {
    const depthCard = makeCard('depth_card', 'wreck diving', { depth: 6 });
    const varietyCard = makeCard('variety_card', 'inn-to-inn cycling', { variety: 3 });
    const varietyCard2 = makeCard('variety_card_2', 'guided city food crawl', { variety: 2 });
    const cards = [depthCard, varietyCard, varietyCard2];

    let state: DnaState = createInitialDNAState([TEST_DIMENSION]);
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, depthCard, 'love', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: depthCard.id, type: 'love', timestamp: 0 }],
    };
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, varietyCard, 'no', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: varietyCard.id, type: 'no', timestamp: 1 }],
    };
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, varietyCard2, 'no', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: varietyCard2.id, type: 'no', timestamp: 2 }],
    };

    const [dimResult] = calculateDimensionScores(state, [TEST_DIMENSION]);
    const evidence = generateEvidenceForDimension(state, cards, dimResult, [TEST_DIMENSION]);

    expect(evidence!.opposingCardIds).toEqual(['variety_card', 'variety_card_2']);
    expect(evidence!.loved).not.toContain('variety_card');

    const why = getWhyWeThinkThis(evidence, cards);
    expect(why.rejected.some((t) => t.includes('inn-to-inn cycling'))).toBe(true);
  });

  it('does not cite a single trailing-pole reject — one "no" is not enough evidence', () => {
    const depthCard = makeCard('depth_card', 'wreck diving', { depth: 6 });
    const varietyCard = makeCard('variety_card', 'inn-to-inn cycling', { variety: 3 });
    const cards = [depthCard, varietyCard];

    let state: DnaState = createInitialDNAState([TEST_DIMENSION]);
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, depthCard, 'love', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: depthCard.id, type: 'love', timestamp: 0 }],
    };
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, varietyCard, 'no', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: varietyCard.id, type: 'no', timestamp: 1 }],
    };

    const [dimResult] = calculateDimensionScores(state, [TEST_DIMENSION]);
    const evidence = generateEvidenceForDimension(state, cards, dimResult, [TEST_DIMENSION]);

    expect(evidence!.opposingCardIds).toEqual([]);
  });

  it('never cites a niche card\'s reject, even with 2+ of them', () => {
    const depthCard = makeCard('depth_card', 'wreck diving', { depth: 6 });
    const nicheVariety1 = makeCard('niche_variety_1', 'extreme downhill descent', { variety: 3 }, true);
    const nicheVariety2 = makeCard('niche_variety_2', 'packaged photo-op tour', { variety: 2 }, true);
    const cards = [depthCard, nicheVariety1, nicheVariety2];

    let state: DnaState = createInitialDNAState([TEST_DIMENSION]);
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, depthCard, 'love', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: depthCard.id, type: 'love', timestamp: 0 }],
    };
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, nicheVariety1, 'no', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: nicheVariety1.id, type: 'no', timestamp: 1 }],
    };
    state = {
      ...state,
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, nicheVariety2, 'no', [TEST_DIMENSION]),
      swipes: [...state.swipes, { cardId: nicheVariety2.id, type: 'no', timestamp: 2 }],
    };

    const [dimResult] = calculateDimensionScores(state, [TEST_DIMENSION]);
    const evidence = generateEvidenceForDimension(state, cards, dimResult, [TEST_DIMENSION]);

    expect(evidence!.opposingCardIds).toEqual([]);
  });
});

describe('generateEvidenceForTension', () => {
  const TEST_TENSION: TensionDef = {
    id: 'test_challenge_without_chaos',
    title: 'Challenge without chaos',
    insightText: 'You accept effort for reward, but still want structure.',
    recommendationImplication: null,
    relatedDimensions: [],
    signalA: { label: 'Accepts effort for reward', type: 'dimensionPole', keys: ['reward'], min: 1 },
    signalB: { label: 'Wants a solid framework', type: 'dimensionPole', keys: ['structure'], min: 1 },
  };

  // Reproduces the real "Challenge without chaos" complaint: neither side
  // is a `rejectedAttrs` type, so before this fix `opposingCardIds` was
  // always empty for this tension — no matter what the user actually
  // rejected. A card authored with a negative `structure` signal
  // represents a chaotic/disorganized experience; rejecting it is
  // genuine "passed on chaos" evidence for the structure side.
  it('surfaces real no-swipes on negative-signal cards as rejected evidence, once there are 2+, even with no rejectedAttrs side', () => {
    const rewardCard = makeCard('reward_card', 'grueling summit push', { reward: 4 });
    const chaosCard = makeCard('chaos_card', 'unplanned wander with no itinerary', { structure: -3 });
    const chaosCard2 = makeCard('chaos_card_2', 'no-plan hostel hopping', { structure: -2 });
    const cards = [rewardCard, chaosCard, chaosCard2];

    const state: DnaState = {
      ...createInitialDNAState([]),
      swipes: [
        { cardId: rewardCard.id, type: 'love', timestamp: 0 },
        { cardId: chaosCard.id, type: 'no', timestamp: 1 },
        { cardId: chaosCard2.id, type: 'no', timestamp: 2 },
      ],
    };

    const tensionResult: TensionResult = {
      id: TEST_TENSION.id,
      title: TEST_TENSION.title,
      insightText: TEST_TENSION.insightText,
      confidence: 0.8,
      signalA: { label: TEST_TENSION.signalA.label, attributes: TEST_TENSION.signalA.keys, supportingCardIds: ['reward_card'] },
      signalB: { label: TEST_TENSION.signalB.label, attributes: TEST_TENSION.signalB.keys, supportingCardIds: [] },
      relatedDimensions: [],
      recommendationImplication: null,
      status: 'confirmed',
    };

    const evidence = generateEvidenceForTension(state, cards, tensionResult, [TEST_TENSION]);

    expect(evidence!.opposingCardIds).toContain('chaos_card');
    expect(evidence!.opposingCardIds).toContain('chaos_card_2');
    const why = getWhyWeThinkThis(evidence, cards);
    expect(why.rejected.some((t) => t.includes('unplanned wander'))).toBe(true);
  });

  it('does not cite a single negative-signal reject — one "no" is not enough evidence', () => {
    const rewardCard = makeCard('reward_card', 'grueling summit push', { reward: 4 });
    const chaosCard = makeCard('chaos_card', 'unplanned wander with no itinerary', { structure: -3 });
    const cards = [rewardCard, chaosCard];

    const state: DnaState = {
      ...createInitialDNAState([]),
      swipes: [
        { cardId: rewardCard.id, type: 'love', timestamp: 0 },
        { cardId: chaosCard.id, type: 'no', timestamp: 1 },
      ],
    };

    const tensionResult: TensionResult = {
      id: TEST_TENSION.id,
      title: TEST_TENSION.title,
      insightText: TEST_TENSION.insightText,
      confidence: 0.8,
      signalA: { label: TEST_TENSION.signalA.label, attributes: TEST_TENSION.signalA.keys, supportingCardIds: ['reward_card'] },
      signalB: { label: TEST_TENSION.signalB.label, attributes: TEST_TENSION.signalB.keys, supportingCardIds: [] },
      relatedDimensions: [],
      recommendationImplication: null,
      status: 'confirmed',
    };

    const evidence = generateEvidenceForTension(state, cards, tensionResult, [TEST_TENSION]);

    expect(evidence!.opposingCardIds).toEqual([]);
  });

  it('never cites a niche card\'s reject as tension opposing evidence, even with 2+ of them', () => {
    const rewardCard = makeCard('reward_card', 'grueling summit push', { reward: 4 });
    const nicheChaos1 = makeCard('niche_chaos_1', 'extreme downhill descent', { structure: -3 }, true);
    const nicheChaos2 = makeCard('niche_chaos_2', 'packaged photo-op tour', { structure: -2 }, true);
    const cards = [rewardCard, nicheChaos1, nicheChaos2];

    const state: DnaState = {
      ...createInitialDNAState([]),
      swipes: [
        { cardId: rewardCard.id, type: 'love', timestamp: 0 },
        { cardId: nicheChaos1.id, type: 'no', timestamp: 1 },
        { cardId: nicheChaos2.id, type: 'no', timestamp: 2 },
      ],
    };

    const tensionResult: TensionResult = {
      id: TEST_TENSION.id,
      title: TEST_TENSION.title,
      insightText: TEST_TENSION.insightText,
      confidence: 0.8,
      signalA: { label: TEST_TENSION.signalA.label, attributes: TEST_TENSION.signalA.keys, supportingCardIds: ['reward_card'] },
      signalB: { label: TEST_TENSION.signalB.label, attributes: TEST_TENSION.signalB.keys, supportingCardIds: [] },
      relatedDimensions: [],
      recommendationImplication: null,
      status: 'confirmed',
    };

    const evidence = generateEvidenceForTension(state, cards, tensionResult, [TEST_TENSION]);

    expect(evidence!.opposingCardIds).toEqual([]);
  });
});

describe('pickEvidenceCardIdsForPoles — Love outranks a more-recent Yes', () => {
  it('cites an older Love over a more-recent Yes when both match', () => {
    const lovedCard = makeCard('loved_card', 'wreck diving', { depth: 6 });
    const yesCard = makeCard('yes_card', 'guided city walk', { depth: 3 });
    const cards = [lovedCard, yesCard];

    const state: DnaState = {
      ...createInitialDNAState([]),
      swipes: [
        { cardId: lovedCard.id, type: 'love', timestamp: 0 },
        { cardId: yesCard.id, type: 'yes', timestamp: 1 }, // more recent, but only a Yes
      ],
    };

    const ids = pickEvidenceCardIdsForPoles(state, cards, ['depth'], 1);
    expect(ids).toEqual(['loved_card']);
  });

  it('fills remaining slots with Yes cards once every matching Love is included', () => {
    const lovedCard = makeCard('loved_card', 'wreck diving', { depth: 6 });
    const yesCard1 = makeCard('yes_card_1', 'guided city walk', { depth: 3 });
    const yesCard2 = makeCard('yes_card_2', 'museum morning', { depth: 2 });
    const cards = [lovedCard, yesCard1, yesCard2];

    const state: DnaState = {
      ...createInitialDNAState([]),
      swipes: [
        { cardId: lovedCard.id, type: 'love', timestamp: 0 },
        { cardId: yesCard1.id, type: 'yes', timestamp: 1 },
        { cardId: yesCard2.id, type: 'yes', timestamp: 2 },
      ],
    };

    const ids = pickEvidenceCardIdsForPoles(state, cards, ['depth'], 2);
    expect(ids).toEqual(['loved_card', 'yes_card_2']); // Love first, then most-recent Yes
  });
});
