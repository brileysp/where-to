import { describe, expect, it } from 'vitest';
import { calculateDimensionScores, applyDimensionSignalsIfBroad, createInitialDimensionState } from '@/lib/dna/dimensions';
import { applySwipeBothSides, cards, createStatePair, dimensions, legacy, scriptedSwipeSequence } from './helpers';

describe('calculateDimensionScores — exact diff vs legacy engine', () => {
  it('matches legacy dimension results after 60 scripted swipes', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(60, 10);

    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
    }

    const legacyResults = legacy.calculateDimensionScores(legacyState);
    const newResults = calculateDimensionScores(newState, dimensions);

    expect(newResults).toEqual(legacyResults);
  });

  it('matches at every 10-swipe checkpoint (confidence/status transitions included)', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(50, 25);

    for (let i = 0; i < sequence.length; i++) {
      const { cardId, swipeType } = sequence[i];
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
      if ((i + 1) % 10 === 0) {
        expect(calculateDimensionScores(newState, dimensions)).toEqual(legacy.calculateDimensionScores(legacyState));
      }
    }
  });
});

describe('applyDimensionSignalsIfBroad', () => {
  it('leaves dimensionState untouched for a deep-stage card, even one with real dimensionSignals', () => {
    const deepCard = cards.find((c) => c.id === 'birding_deep_endemic_dawn');
    expect(deepCard?.stage).toBe('deep');
    expect(Object.keys(deepCard!.dimensionSignals).length).toBeGreaterThan(0);

    const before = createInitialDimensionState(dimensions);
    const after = applyDimensionSignalsIfBroad(before, deepCard!, 'love', dimensions);

    expect(after).toEqual(before);
  });

  it('still updates dimensionState for a broad-stage card, matching the underlying ported function', () => {
    const broadCard = cards.find((c) => c.stage === 'broad' && Object.keys(c.dimensionSignals).length > 0);
    expect(broadCard).toBeTruthy();

    const before = createInitialDimensionState(dimensions);
    const after = applyDimensionSignalsIfBroad(before, broadCard!, 'love', dimensions);

    expect(after).not.toEqual(before);
  });
});
