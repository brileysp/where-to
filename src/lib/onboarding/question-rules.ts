import { getOnboardingSettings } from './settings';

/**
 * Which onboarding questions a traveler is asked (interest_question_chips in the schema). A question is either asked of everyone who picks
 * the interest, or opened by chips: it is asked only when the traveler has ticked at least one of them. Chips never depend on chips and
 * questions never depend on questions. Every screen (onboarding, the Travel DNA page) and the scoring use this one check so they cannot
 * disagree. Answers to a question that is not currently asked are kept but ignored.
 */

export interface RuledQuestion {
  key: string;
  /** Keys of the chips, in the same interest, that open the question. Empty = asked of everyone who picks the interest. */
  whenChips: readonly string[];
}

export interface RuleChip {
  key: string;
  live: boolean;
}

/** True when the question is asked: no chips listed, or at least one listed chip is live and ticked. A draft chip cannot be ticked, so it never opens anything. */
export function isQuestionAsked(q: RuledQuestion, ticked: ReadonlySet<string> | readonly string[], liveChips: ReadonlySet<string> | readonly string[]): boolean {
  if (q.whenChips.length === 0) return true;
  const t = new Set(ticked);
  const l = new Set(liveChips);
  return q.whenChips.some((k) => t.has(k) && l.has(k));
}

/** The questions to ask, in their given order. */
export function questionsToAsk<T extends RuledQuestion>(questions: readonly T[], ticked: ReadonlySet<string> | readonly string[], liveChips: ReadonlySet<string> | readonly string[]): T[] {
  return questions.filter((q) => isQuestionAsked(q, ticked, liveChips));
}

/** Questions that can never be asked right now because every chip that opens them is still a draft (or gone). For the admin warning. */
export function questionsWaitingOnDrafts<T extends RuledQuestion>(questions: readonly T[], chips: readonly RuleChip[]): T[] {
  const live = new Set(chips.filter((c) => c.live).map((c) => c.key));
  return questions.filter((q) => q.whenChips.length > 0 && !q.whenChips.some((k) => live.has(k)));
}

/**
 * How many questions each of the traveler's top interests gets, in order (the first interests get the larger share). The shares come from
 * the settings (5 interests: 2 each; 4: 3, 3, 2, 2; 3: 3 each; 2: 4 each; 1: 10). More interests than the settings cover use the
 * largest group's shares.
 */
export function interestQuotas(interestCount: number): number[] {
  const table = getOnboardingSettings().questionShares;
  if (interestCount <= 0) return [];
  const n = Math.min(interestCount, table.length);
  return [...table[n - 1]];
}

export interface QuestionPlanItem {
  interest: string;
  /** What the settings allow for this interest. */
  allowed: number;
  /** How many will actually be asked: the share, or all the questions that apply when there are fewer. */
  ask: number;
}

/**
 * The plan for the grouped questions: for each top interest in order, its share, cut down to how many questions actually apply to that
 * traveler (`available`, counted after the chip rules). A share a short interest cannot use is not handed to another. `total` is how many
 * questions will be asked in all, which is what the shortlist unlock counts.
 */
export function questionPlan(interests: readonly string[], available: Readonly<Record<string, number>>): { items: QuestionPlanItem[]; total: number } {
  const quotas = interestQuotas(interests.length);
  const items = interests.slice(0, quotas.length).map((interest, i) => ({ interest, allowed: quotas[i], ask: Math.max(0, Math.min(quotas[i], available[interest] ?? 0)) }));
  return { items, total: items.reduce((n, x) => n + x.ask, 0) };
}
