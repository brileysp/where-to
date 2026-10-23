import type { InterestChipDriver, InterestFactValue } from '@/lib/db/schema';
import { chipFit } from '@/lib/admin/interest-pages/chips';
import type { FactDef } from '@/lib/admin/interest-pages/config';
import { questionsToAsk } from '@/lib/onboarding/question-rules';
import { questionFit, type QuestionFitRule } from '@/lib/onboarding/question-fit';
import { matchInterest, type AnswerCheck, type InterestMatch, type TickedChip } from './personalMatch';
import { DEFAULT_MATCH_SETTINGS, type MatchSettings } from './matchSettings';

/**
 * Personalizing one interest for one place from what the traveler ticked and answered (docs/matching-model.md). This joins the pieces:
 * the chips' measures (chip drivers), the questions that are currently asked (question-rules), each answer's fit from the place's columns
 * (question-fit), and the formula (personalMatch). Pure: the caller loads the chips, questions and the place's facts.
 */

export interface MatchChipDef {
  key: string;
  label: string;
  live: boolean;
  drivers: InterestChipDriver[];
}

export interface MatchQuestionDef {
  key: string;
  kind: 'lean' | 'limit';
  /** Keys of the chips that open the question; empty = always asked. */
  whenChips: string[];
  fitRule: QuestionFitRule | null;
  /** The reason chip text for a miss. */
  missMessage: string;
  /** Only questions the owner approved count. */
  approved: boolean;
}

export interface InterestMatchArgs {
  chips: MatchChipDef[];
  questions: MatchQuestionDef[];
  /** Keys of the chips the traveler ticked in this interest. */
  ticked: readonly string[];
  /** The traveler's answers for this interest: question key to the positions picked. */
  answers: Readonly<Record<string, readonly number[]>>;
  /** The place's facts for this interest, and the interest's column definitions. */
  facts: Record<string, InterestFactValue>;
  defs: FactDef[];
  /** The month the traveler is going, 0 = January; null when none is chosen. */
  month?: number | null;
  settings?: MatchSettings;
}

export interface InterestMatchDetail extends InterestMatch {
  /** How many questions were asked of this traveler and could be checked (asked, approved, mapped to columns, answered). */
  checked: number;
}

export function interestMatchFor(a: InterestMatchArgs): InterestMatchDetail {
  const live = a.chips.filter((c) => c.live);
  const liveKeys = live.map((c) => c.key);
  const tickedLive = live.filter((c) => a.ticked.includes(c.key));
  const ticked: TickedChip[] = tickedLive.map((c) => ({ label: c.label, rating: c.drivers.length ? chipFit(c.drivers, a.defs, a.facts) : null }));

  const asked = questionsToAsk(a.questions.map((q) => ({ ...q })), tickedLive.map((c) => c.key), liveKeys);
  const answers: AnswerCheck[] = [];
  for (const q of asked) {
    const picked = a.answers[q.key];
    if (!q.approved || !q.fitRule || !picked || picked.length === 0) continue;
    answers.push({ kind: q.kind, fit: questionFit(q.fitRule, picked, a.defs, a.facts, a.month), message: q.missMessage });
  }
  const m = matchInterest({ ticked, chipsOffered: live.length, answers }, a.settings ?? DEFAULT_MATCH_SETTINGS);
  return { ...m, checked: answers.length };
}
