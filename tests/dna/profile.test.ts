import { describe, expect, it } from 'vitest';
import { applySwipeBothSides, cards, createStatePair, scriptedSwipeSequence, withoutNewProfileAttributes } from './helpers';

describe('applySwipeToProfile — exact diff vs legacy engine', () => {
  it('produces an identical profile to the legacy engine after 80 scripted swipes', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(80);

    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
    }

    expect(withoutNewProfileAttributes(newState.profile, legacyState.profile)).toEqual(legacyState.profile);
  });

  it('matches at every intermediate step, not just the end state', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(30, 40);

    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
      expect(withoutNewProfileAttributes(newState.profile, legacyState.profile)).toEqual(legacyState.profile);
    }
  });

  it('damps negative signals identically on Love swipes (does not amplify by 2.5x)', () => {
    // Find a real card with at least one negative preferenceSignal to
    // exercise the damping branch, same as the legacy engine would.
    const cardWithNegative = cards.find((c) => Object.values(c.preferenceSignals).some((v) => v < 0));
    if (!cardWithNegative) throw new Error('expected at least one card with a negative preferenceSignal');

    let { legacyState, newState } = createStatePair();
    ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardWithNegative.id, 'love'));

    expect(withoutNewProfileAttributes(newState.profile, legacyState.profile)).toEqual(legacyState.profile);
  });
});
