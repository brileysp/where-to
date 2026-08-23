import { applyLearningFeedback, type Feedback } from './summary';
import { calculateCalibrationPercent } from './calibration';
import type { CalibrationResponse, DimensionDef, DnaCard, DnaState, InsightFeedback, LearningCheck, TensionDef } from './types';

/**
 * Calibration & Confidence Feedback — a lightweight reaction a user can
 * give directly on a Summary-screen conclusion (dimension row, tension
 * card, or "what we're learning" item). Deliberately layered ON TOP of
 * the existing dimensions/tensions/evidence machinery rather than
 * replacing any of it:
 *
 *   - "Spot on" / "Not really" / "Not sure" reuse the exact same
 *     confirm/reject/unsure scoring path the swipe-flow's Learning Check
 *     already uses (applyLearningFeedback), via a minimal LearningCheck
 *     shim built from the dimension/tension result already on screen.
 *   - "Sort of" is new and deliberately does NOT call that path at all —
 *     per product spec, it must never move dimension/tension scoring in
 *     either direction, only get logged and leave the topic open for
 *     more evidence to accumulate naturally.
 *
 * The Travel DNA calibration bar gets a small explicit nudge on top of
 * the existing swipe-based formula (calculateCalibrationPercent, left
 * untouched) — see computeDisplayCalibrationPercent.
 */

export const CALIBRATION_DELTA: Record<CalibrationResponse, number> = {
  spot_on: 3,
  sort_of: 0,
  not_really: -3,
  not_sure: -1,
};

const RESPONSE_TO_FEEDBACK: Partial<Record<CalibrationResponse, Feedback>> = {
  spot_on: 'confirmed',
  not_really: 'rejected',
  not_sure: 'unsure',
  // sort_of intentionally has no mapping — it never touches dimension/tension scoring.
};

/** Base formula (calculateCalibrationPercent) + accumulated calibration-feedback nudges, clamped 0-100. This is the ONLY place the two are combined — use it wherever calibrationPercent gets (re)computed. */
export function computeDisplayCalibrationPercent(dnaState: DnaState, allCards: DnaCard[]): number {
  const base = calculateCalibrationPercent(dnaState, allCards);
  const adjustment = dnaState.calibrationAdjustment ?? 0;
  return Math.max(0, Math.min(100, base + adjustment));
}

export function getInsightFeedback(
  dnaState: DnaState,
  targetType: 'dimension' | 'tension' | 'domain',
  targetId: string,
): InsightFeedback | null {
  const list = dnaState.insightFeedback || [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].targetType === targetType && list[i].targetId === targetId) return list[i];
  }
  return null;
}

/**
 * Records the reaction, nudges the calibration adjustment, and — for
 * spot_on/not_really/not_sure only — delegates to the existing
 * applyLearningFeedback for the actual dimension/tension score change.
 * Returns a NEW DnaState; does not persist (caller's responsibility).
 */
export function applyCalibrationFeedback(
  dnaState: DnaState,
  targetType: 'dimension' | 'tension' | 'domain',
  targetId: string,
  title: string,
  response: CalibrationResponse,
  dimensions: DimensionDef[],
  tensions: TensionDef[],
  allCards: DnaCard[],
): DnaState {
  const record: InsightFeedback = {
    id: `${targetType}-${targetId}-${Date.now()}`,
    targetType,
    targetId,
    response,
    timestamp: new Date().toISOString(),
  };

  let next: DnaState = {
    ...dnaState,
    insightFeedback: [...(dnaState.insightFeedback || []), record],
    calibrationAdjustment: (dnaState.calibrationAdjustment ?? 0) + CALIBRATION_DELTA[response],
  };

  // A domain recap isn't a dimension or tension — there's no raw score to
  // strengthen/weaken, so it only ever moves calibrationAdjustment above.
  // Routing it through applyLearningFeedback would find no matching
  // DimensionDef for the domain key and silently fall through, but would
  // still push a bogus record onto confirmedDimensionLearnings/etc., so
  // it's excluded outright rather than relying on that fallthrough.
  if (targetType !== 'domain') {
    const feedback = RESPONSE_TO_FEEDBACK[response];
    if (feedback) {
      // `confidence`/`insightText`/`evidenceLine` are part of the LearningCheck
      // shape but not read by applyLearningFeedback (which only uses kind/
      // refId/title/shownAtSwipeCount) — left inert here rather than
      // recomputed, since nothing downstream consumes them.
      const check: LearningCheck = {
        id: record.id,
        kind: targetType,
        refId: targetId,
        confidence: 0,
        title,
        insightText: title,
        evidenceLine: '',
        shownAtSwipeCount: next.swipeCount,
      };
      next = applyLearningFeedback(next, check, feedback, dimensions, tensions);
    }
  }

  next.calibrationPercent = computeDisplayCalibrationPercent(next, allCards);
  return next;
}
