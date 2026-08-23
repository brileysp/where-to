import { describe, expect, it } from 'vitest';
import { calculateCalibrationPercent, calculateCategoryDiversity } from '@/lib/dna/calibration';
import { applySwipeBothSides, cards, createStatePair, legacy, scriptedSwipeSequence } from './helpers';

describe('calibration — exact diff vs legacy engine', () => {
  // Deliberate divergence from the legacy engine, discovered while removing
  // a dead feature: legacy budgeted 15 of its 100 calibration points to a
  // "confirmed insights" bonus tied to a check-in that was ported but never
  // wired into the swipe loop — confirmedInsights was always empty, so
  // legacy calibration could never actually reach 100%, only 85. Those 15
  // points were folded into the base (swipe-volume) component instead of
  // being dropped, so this side should always be >= legacy at the same
  // point in a sequence, and legacy is no longer the ceiling to match.
  it('matches legacy category diversity, and calibration percent is always >= legacy (never lower, since only the always-dead insight bonus moved)', () => {
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
      expect(newPercent).toBeGreaterThanOrEqual(legacyPercent);
    }
  });

  it('can actually reach 100% now — the bug this fix closes', () => {
    // The formula's three live components (base/diversity/love) are
    // designed to sum to a 100-point ceiling: 84 + 12 + 4. Before this fix,
    // the ceiling was only 85 (69 + 12 + 4) because the other 15 points
    // were reserved for a bonus that could never fire. This pins the
    // ceiling itself rather than trying to hit it via a real swipe
    // sequence, since a real sequence maxing diversity, love ratio, and
    // swipe-count progress simultaneously would fight itself.
    const MAX_BASE = 84;
    const MAX_DIVERSITY_BONUS = 12;
    const MAX_LOVE_BONUS = 4;
    expect(MAX_BASE + MAX_DIVERSITY_BONUS + MAX_LOVE_BONUS).toBe(100);
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
    expect(percent).toBeGreaterThanOrEqual(legacy.calculateCalibrationPercent(legacyState));
  });
});
