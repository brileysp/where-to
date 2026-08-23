import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_DELTA,
  computeDisplayCalibrationPercent,
  applyCalibrationFeedback,
  getInsightFeedback,
} from '@/lib/dna/calibration-feedback';
import { calculateCalibrationPercent } from '@/lib/dna/calibration';
import { applySwipeToProfile } from '@/lib/dna/profile';
import { applyDimensionSignalsFromSwipe } from '@/lib/dna/dimensions';
import { createInitialDNAState } from '@/lib/dna/state';
import { cards, dimensions, scriptedSwipeSequence, tensions } from './helpers';
import type { DnaState } from '@/lib/dna/types';

/** A DnaState with real swipe/dimension/profile history to rate insights against (doesn't need the legacy side — only the new port's own behavior is under test here). */
function populatedState(): DnaState {
  let state = createInitialDNAState(dimensions);
  for (const { cardId, swipeType } of scriptedSwipeSequence(40, 5)) {
    const card = cards.find((c) => c.id === cardId)!;
    state = {
      ...state,
      profile: applySwipeToProfile(state.profile, card, swipeType),
      dimensionState: applyDimensionSignalsFromSwipe(state.dimensionState, card, swipeType, dimensions),
      swipes: [...state.swipes, { cardId, type: swipeType, timestamp: 0 }],
      answeredCardIds: [...state.answeredCardIds, cardId],
      swipeCount: state.swipeCount + 1,
    };
  }
  return state;
}

describe('CALIBRATION_DELTA', () => {
  it('matches the product spec exactly', () => {
    expect(CALIBRATION_DELTA).toEqual({ spot_on: 3, sort_of: 0, not_really: -3, not_sure: -1 });
  });
});

describe('computeDisplayCalibrationPercent', () => {
  it('equals the base formula when there is no adjustment', () => {
    const state = populatedState();
    expect(computeDisplayCalibrationPercent(state, cards)).toBe(calculateCalibrationPercent(state, cards));
  });

  it('adds the adjustment on top of the base formula', () => {
    const state = { ...populatedState(), calibrationAdjustment: 7 };
    const base = calculateCalibrationPercent(state, cards);
    expect(computeDisplayCalibrationPercent(state, cards)).toBe(Math.min(100, base + 7));
  });

  it('never exceeds 100', () => {
    const state = { ...populatedState(), calibrationAdjustment: 500 };
    expect(computeDisplayCalibrationPercent(state, cards)).toBe(100);
  });

  it('never drops below 0', () => {
    const state = { ...populatedState(), calibrationAdjustment: -500 };
    expect(computeDisplayCalibrationPercent(state, cards)).toBe(0);
  });
});

describe('applyCalibrationFeedback', () => {
  it('spot_on: records feedback, nudges calibration up, and strengthens the dimension (mirrors "confirmed")', () => {
    const state = populatedState();
    const dim = dimensions[0];
    const before = state.calibrationAdjustment;

    const next = applyCalibrationFeedback(state, 'dimension', dim.id, 'test title', 'spot_on', dimensions, tensions, cards);

    expect(next.calibrationAdjustment).toBe(before + 3);
    expect(next.confirmedDimensionLearnings.some((r) => r.id === dim.id)).toBe(true);
    expect(getInsightFeedback(next, 'dimension', dim.id)?.response).toBe('spot_on');
  });

  it('not_really: records feedback, nudges calibration down, and weakens the dimension (mirrors "rejected")', () => {
    const state = populatedState();
    const dim = dimensions[0];
    const before = state.calibrationAdjustment;

    const next = applyCalibrationFeedback(state, 'dimension', dim.id, 'test title', 'not_really', dimensions, tensions, cards);

    expect(next.calibrationAdjustment).toBe(before - 3);
    expect(next.rejectedDimensionLearnings.some((r) => r.id === dim.id)).toBe(true);
  });

  it('not_sure: records feedback, nudges calibration down slightly, marks unsure', () => {
    const state = populatedState();
    const dim = dimensions[0];
    const before = state.calibrationAdjustment;

    const next = applyCalibrationFeedback(state, 'dimension', dim.id, 'test title', 'not_sure', dimensions, tensions, cards);

    expect(next.calibrationAdjustment).toBe(before - 1);
    expect(next.unsureDimensionLearnings.some((r) => r.id === dim.id)).toBe(true);
  });

  it('sort_of: records feedback but leaves calibration, dimensionState, and every feedback array untouched', () => {
    const state = populatedState();
    const dim = dimensions[0];

    const next = applyCalibrationFeedback(state, 'dimension', dim.id, 'test title', 'sort_of', dimensions, tensions, cards);

    expect(next.calibrationAdjustment).toBe(state.calibrationAdjustment);
    expect(next.dimensionState).toEqual(state.dimensionState);
    expect(next.confirmedDimensionLearnings).toEqual(state.confirmedDimensionLearnings);
    expect(next.rejectedDimensionLearnings).toEqual(state.rejectedDimensionLearnings);
    expect(next.unsureDimensionLearnings).toEqual(state.unsureDimensionLearnings);
    // Still logged, for status-badge display and any future consumer.
    expect(getInsightFeedback(next, 'dimension', dim.id)?.response).toBe('sort_of');
  });

  it('works the same way for tensions as for dimensions', () => {
    const state = populatedState();
    const tension = tensions[0];

    const next = applyCalibrationFeedback(state, 'tension', tension.id, tension.title, 'spot_on', dimensions, tensions, cards);

    expect(next.confirmedTensions.some((r) => r.id === tension.id)).toBe(true);
    expect(getInsightFeedback(next, 'tension', tension.id)?.response).toBe('spot_on');
  });

  it('getInsightFeedback returns the most recent response when rated more than once', () => {
    const state = populatedState();
    const dim = dimensions[1];

    let next = applyCalibrationFeedback(state, 'dimension', dim.id, 'title', 'not_sure', dimensions, tensions, cards);
    next = applyCalibrationFeedback(next, 'dimension', dim.id, 'title', 'spot_on', dimensions, tensions, cards);

    expect(getInsightFeedback(next, 'dimension', dim.id)?.response).toBe('spot_on');
    expect(next.insightFeedback.filter((f) => f.targetId === dim.id)).toHaveLength(2);
  });

  it('getInsightFeedback returns null when nothing has been rated', () => {
    const state = populatedState();
    expect(getInsightFeedback(state, 'dimension', dimensions[0].id)).toBeNull();
  });

  // A deep-dive domain recap ("here's what we learned about your birding
  // style") isn't a dimension or tension — there's no underlying raw
  // score to strengthen/weaken, so every response should only ever move
  // calibrationAdjustment and log the record, never touch dimensionState
  // or any of the confirmed/rejected/unsure learning lists.
  describe('domain (deep-dive recap ratings)', () => {
    it('spot_on: nudges calibration up, logs feedback, leaves dimension/tension state untouched', () => {
      const state = populatedState();
      const before = state.calibrationAdjustment;

      const next = applyCalibrationFeedback(state, 'domain', 'birding', 'recap text', 'spot_on', dimensions, tensions, cards);

      expect(next.calibrationAdjustment).toBe(before + 3);
      expect(getInsightFeedback(next, 'domain', 'birding')?.response).toBe('spot_on');
      expect(next.dimensionState).toEqual(state.dimensionState);
      expect(next.confirmedDimensionLearnings).toEqual(state.confirmedDimensionLearnings);
      expect(next.confirmedTensions).toEqual(state.confirmedTensions);
    });

    it('not_really: nudges calibration down, logs feedback, leaves dimension/tension state untouched', () => {
      const state = populatedState();
      const before = state.calibrationAdjustment;

      const next = applyCalibrationFeedback(state, 'domain', 'birding', 'recap text', 'not_really', dimensions, tensions, cards);

      expect(next.calibrationAdjustment).toBe(before - 3);
      expect(getInsightFeedback(next, 'domain', 'birding')?.response).toBe('not_really');
      expect(next.rejectedDimensionLearnings).toEqual(state.rejectedDimensionLearnings);
      expect(next.rejectedTensions).toEqual(state.rejectedTensions);
    });

    it('not_sure: nudges calibration down slightly, logs feedback, leaves dimension/tension state untouched', () => {
      const state = populatedState();
      const before = state.calibrationAdjustment;

      const next = applyCalibrationFeedback(state, 'domain', 'birding', 'recap text', 'not_sure', dimensions, tensions, cards);

      expect(next.calibrationAdjustment).toBe(before - 1);
      expect(next.unsureDimensionLearnings).toEqual(state.unsureDimensionLearnings);
    });

    it('sort_of: leaves calibration and every state array untouched, still logs feedback', () => {
      const state = populatedState();

      const next = applyCalibrationFeedback(state, 'domain', 'birding', 'recap text', 'sort_of', dimensions, tensions, cards);

      expect(next.calibrationAdjustment).toBe(state.calibrationAdjustment);
      expect(next.dimensionState).toEqual(state.dimensionState);
      expect(getInsightFeedback(next, 'domain', 'birding')?.response).toBe('sort_of');
    });
  });
});
