import { describe, expect, it } from 'vitest';
import { calculateCalibrationPercent, calculateCategoryDiversity } from '@/lib/dna/calibration';
import { applySwipeBothSides, cards, createStatePair, legacy, scriptedSwipeSequence } from './helpers';

describe('calibration — exact diff vs legacy engine', () => {
  it('matches legacy calibration percent and category diversity at every swipe up to 65', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(65);

    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));

      const legacyDiversity = legacy.calculateCategoryDiversity(legacyState);
      const newDiversity = calculateCategoryDiversity(newState, cards);
      expect(newDiversity).toBeCloseTo(legacyDiversity, 10);

      // calculateCalibrationPercent reads dnaState.calibrationPercent nowhere
      // internally — both sides compute it fresh from swipes/profile/etc.
      const legacyPercent = legacy.calculateCalibrationPercent(legacyState);
      const newPercent = calculateCalibrationPercent(newState, cards);
      expect(newPercent).toBe(legacyPercent);
    }
  });

  it('the 10-swipe guarantee holds on the new port too: under 10% no matter the mix', () => {
    let { legacyState, newState } = createStatePair();
    // All-Love opening streak — the worst case the legacy design doc calls out.
    const sequence = scriptedSwipeSequence(10).map((s) => ({ ...s, swipeType: 'love' as const }));
    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
    }
    const percent = calculateCalibrationPercent(newState, cards);
    expect(percent).toBeLessThan(10);
    expect(percent).toBe(legacy.calculateCalibrationPercent(legacyState));
  });
});
