import { getEligibleCards } from './eligibility';
import type { DnaCard, DnaState } from './types';

// Ported verbatim from traveldna.js:750-867 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

/**
 * Logistic S-curve normalized so f(0)=0 and f(1)=1 — used to shape
 * calibration's base component. `midpoint` sets where the curve is
 * steepest (as a fraction of progress 0-1); `steepness` controls how
 * sharp the slow -> fast -> slow transitions are.
 */
export function sCurve(progress: number, midpoint: number, steepness: number): number {
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
  const raw = sigmoid(steepness * (progress - midpoint));
  const at0 = sigmoid(steepness * (0 - midpoint));
  const at1 = sigmoid(steepness * (1 - midpoint));
  return (raw - at0) / (at1 - at0);
}

/**
 * Calibration is deliberately slow to start — 10 swipes alone should land
 * under 10% no matter how the swipes go. `base` uses an S-curve so it's
 * slow through roughly the first 8 swipes, picks up through the middle,
 * then decelerates again near the 60-swipe budget. Diversity/love bonuses
 * are additionally damped by early-session progress on top of that.
 */
export function calculateCalibrationPercent(dnaState: DnaState, allCards: DnaCard[]): number {
  const swipeCount = dnaState.swipeCount || 0;
  if (swipeCount === 0) return 0;

  const MAX_BASE_SWIPES = 60;
  const progress = Math.min(swipeCount / MAX_BASE_SWIPES, 1);
  const earlyDamper = Math.min(progress * 2, 1);

  // Base: swipe volume, S-curved — worth up to 69 of the 100 points.
  const base = sCurve(progress, 0.55, 7) * 69;

  // Diversity: worth up to 12 points, damped early.
  const diversityBonus = calculateCategoryDiversity(dnaState, allCards) * 12 * earlyDamper;

  // Confirmed insights: independent validation. Worth up to 15 points (3
  // each, capped at 5 counted).
  const confirmedCount = (dnaState.confirmedInsights || []).length;
  const insightBonus = Math.min(confirmedCount, 5) * 3;

  // A stream of decisive Love swipes, capped low and damped early.
  const loveCount = (dnaState.swipes || []).filter((s) => s.type === 'love').length;
  const loveRatio = swipeCount ? loveCount / swipeCount : 0;
  const loveBonus = Math.min(loveRatio * 8, 4) * earlyDamper;

  const total = base + diversityBonus + insightBonus + loveBonus;
  return Math.max(0, Math.min(100, Math.round(total)));
}

/** Ratio (0..1) of distinct categories swiped vs. a realistic diversity target. */
export function calculateCategoryDiversity(dnaState: DnaState, allCards: DnaCard[]): number {
  const answeredIds = dnaState.answeredCardIds || [];
  if (!answeredIds.length) return 0;
  const categories = new Set<string>();
  answeredIds.forEach((id) => {
    const card = allCards.find((c) => c.id === id);
    if (card) categories.add(card.category);
  });
  // Target a healthy spread of what's actually still eligible, not the
  // full dataset — a user with no kids shouldn't be marked "less diverse"
  // for never touching Family, since Family was never offered to them.
  const eligibleCategoryCount = new Set(getEligibleCards(dnaState, allCards).map((c) => c.category)).size;
  const allCategoryCount = new Set(allCards.map((c) => c.category)).size;
  const target = Math.min(eligibleCategoryCount || allCategoryCount, 12);
  return Math.min(categories.size / target, 1);
}

// The "want to see matches yet?" nudge re-appears at each of these
// calibration milestones.
export const CALIBRATION_MILESTONES = [50, 70, 90, 100];

/** Returns the next calibration milestone crossed but not yet shown, or null. */
export function nextUnshownCalibrationMilestone(dnaState: DnaState): number | null {
  const shown = new Set(dnaState.calibrationMilestonesShown || []);
  return CALIBRATION_MILESTONES.find((m) => dnaState.calibrationPercent >= m && !shown.has(m)) ?? null;
}

export function calibrationStatusText(percent: number): string {
  if (percent <= 0) return "You're a blank slate — let's find out what you actually like.";
  if (percent < 10) return 'Almost no signal yet.';
  if (percent < 25) return 'Starting to pick up a few clues.';
  if (percent < 45) return 'Some patterns are emerging.';
  if (percent < 65) return 'Your travel taste is getting clearer.';
  if (percent < 85) return "We're getting useful signal now.";
  if (percent < 100) return 'Strong read. A few more swipes will sharpen it.';
  return 'Profile calibrated. Recommendations should now feel meaningfully more personal.';
}
