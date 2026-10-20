import { getOnboardingSettings } from './settings';

/**
 * The shortlist teaser (docs/onboarding-v2/SPEC.md 4.8). The list is a blurred teaser until enough sharpen questions are answered.
 * Skipped questions never count. It lifts early when there is nothing left to ask, and returning travelers are never locked.
 */
export function isShortlistLocked({ answered, hasQuestion, returning }: { answered: number; hasQuestion: boolean; returning: boolean }): boolean {
  if (returning) return false;
  return answered < getOnboardingSettings().unlockQuestions && hasQuestion;
}

/** How many more questions it takes. */
export const questionsToUnlock = (answered: number): number => Math.max(0, getOnboardingSettings().unlockQuestions - answered);

/** The message after an answer. The first branch names no place, so nothing blurred is given away. */
export function answerMessage({ answered, locked, mover }: { answered: number; locked: boolean; mover: { name: string; by: number } | null }): string {
  if (answered === getOnboardingSettings().unlockQuestions) return 'Your full list is unlocked';
  if (locked) return `Saved. ${questionsToUnlock(answered)} more to unlock your list`;
  if (mover && mover.by !== 0) return `${mover.name} moved ${mover.by > 0 ? 'up' : 'down'} ${Math.abs(mover.by)}`;
  return 'Saved. The order held.';
}
