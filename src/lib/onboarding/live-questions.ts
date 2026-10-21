import type { InterestAnswers } from './profile';
import type { MatchSetups, OnboardingQuestion } from './live-types';
import { isQuestionAsked, questionPlan } from './question-rules';

/**
 * The live questions on the results screen (the approved mockup, "Results with live questions"). Pure decisions only: which question comes
 * next, where the gate sits, how far the DNA bar has filled. The screens draw what this says.
 *
 * The order: the questions every top interest always asks (up to its share) come first, and answering them all opens the gate (the full list).
 * Then the traveler ticks chips for every interest they have, which opens more questions, then can add more interests and tick chips for those.
 */

export type LiveStep = 'q1' | 'chips' | 'q3' | 'interests' | 'newchips' | 'newq';

export interface LiveItem {
  interest: string;
  q: OnboardingQuestion;
  /** The chip that opened this question, for "Because you picked ...". */
  because?: string;
  /** An always-asked question that was not part of the first batch: nice to answer, never required. */
  optional?: boolean;
}

export const qid = (interest: string, questionKey: string): string => `${interest}.${questionKey}`;

/** Which questions have been skipped (never asked again this visit), by qid. */
export type Skipped = Readonly<Record<string, boolean>>;

const answered = (qa: InterestAnswers, interest: string, q: OnboardingQuestion): boolean => (qa[interest]?.[q.key]?.length ?? 0) > 0;

/** The first batch, in order: each top interest's always-asked questions, up to that interest's share (see questionPlan). */
export function gateItems(topInterests: readonly string[], setups: MatchSetups): LiveItem[] {
  const always = (k: string) => (setups[k]?.questions ?? []).filter((q) => q.whenChips.length === 0);
  const plan = questionPlan(topInterests, Object.fromEntries(topInterests.map((k) => [k, always(k).length])));
  return plan.items.flatMap((it) => always(it.interest).slice(0, it.ask).map((q) => ({ interest: it.interest, q })));
}

/** The position of the first gate question not yet answered or skipped; the gate length when they all are. */
export function firstUnansweredGate(gate: readonly LiveItem[], qa: InterestAnswers, skipped: Skipped): number {
  const i = gate.findIndex((g) => !answered(qa, g.interest, g.q) && !skipped[qid(g.interest, g.q.key)]);
  return i < 0 ? gate.length : i;
}

/**
 * After the chips: first the questions the ticked chips opened (each with the chip that opened it), then, as optional extras, the always-asked
 * questions left over. Anything answered, skipped or already in the first batch is left out.
 */
export function deeperItems(interests: readonly string[], setups: MatchSetups, ticked: Record<string, string[]>, qa: InterestAnswers, skipped: Skipped, gate: readonly LiveItem[]): LiveItem[] {
  const out: LiveItem[] = [];
  const seen = new Set<string>();
  const inGate = (k: string, q: OnboardingQuestion) => gate.some((g) => g.interest === k && g.q.key === q.key);
  const open = (k: string, q: OnboardingQuestion) => !seen.has(qid(k, q.key)) && !inGate(k, q) && !answered(qa, k, q) && !skipped[qid(k, q.key)];
  for (const k of interests) {
    const setup = setups[k];
    if (!setup) continue;
    const live = setup.content.chips.map((c) => c.key);
    for (const q of setup.questions) {
      if (!q.whenChips.length || !open(k, q)) continue;
      if (!isQuestionAsked(q, ticked[k] ?? [], live)) continue;
      seen.add(qid(k, q.key));
      out.push({ interest: k, q, because: q.whenChips.find((c) => (ticked[k] ?? []).includes(c)) });
    }
  }
  for (const k of interests) {
    for (const q of setups[k]?.questions ?? []) {
      if (q.whenChips.length || !open(k, q)) continue;
      seen.add(qid(k, q.key));
      out.push({ interest: k, q, optional: true });
    }
  }
  return out;
}

/** The questions for interests added later, once their chips are ticked: always-asked ones, and the ones a ticked chip opened. */
export function newItems(newInterests: readonly string[], setups: MatchSetups, ticked: Record<string, string[]>, qa: InterestAnswers, skipped: Skipped): LiveItem[] {
  const out: LiveItem[] = [];
  for (const k of newInterests) {
    const setup = setups[k];
    if (!setup) continue;
    const live = setup.content.chips.map((c) => c.key);
    for (const q of setup.questions) {
      if (answered(qa, k, q) || skipped[qid(k, q.key)]) continue;
      if (!q.whenChips.length) out.push({ interest: k, q });
      else if (isQuestionAsked(q, ticked[k] ?? [], live)) out.push({ interest: k, q, because: q.whenChips.find((c) => (ticked[k] ?? []).includes(c)) });
    }
  }
  return out;
}

// ---- the DNA bar ----

/** How many points the extra steps can add to the bar, so the first batch is only part of it. */
export const BAR_CAPS = { interests: 4, marks: 4, newChips: 4, newQuestions: 8 } as const;

export interface BarInput {
  /** Interests the traveler picked before the results (with questions), and the ones added on the results screen. */
  keys: readonly string[];
  added: readonly string[];
  setups: MatchSetups;
  qa: InterestAnswers;
  ticked: Record<string, string[]>;
  chipsDone: boolean;
  /** Places the traveler marked Visited or Saved on the results. */
  marks: number;
  /** Added interests whose chips were ticked through. */
  newChipped: readonly string[];
}

export function barTotal(i: Pick<BarInput, 'keys' | 'setups'>): number {
  const questions = i.keys.reduce((n, k) => n + (i.setups[k]?.questions.length ?? 0), 0);
  return questions + i.keys.length + BAR_CAPS.interests + BAR_CAPS.marks + BAR_CAPS.newChips + BAR_CAPS.newQuestions;
}

const answeredCount = (qa: InterestAnswers, keys: readonly string[]): number => keys.reduce((n, k) => n + Object.values(qa[k] ?? {}).filter((p) => p.length > 0).length, 0);

export function barPoints(i: BarInput): number {
  const first = answeredCount(i.qa, i.keys);
  const chipPts = i.chipsDone ? i.keys.filter((k) => (i.ticked[k] ?? []).length > 0).length : 0;
  const newAnswered = answeredCount(i.qa, i.added);
  return first + chipPts + Math.min(BAR_CAPS.interests, i.added.length) + Math.min(BAR_CAPS.marks, i.marks) + Math.min(BAR_CAPS.newChips, i.newChipped.length) + Math.min(BAR_CAPS.newQuestions, newAnswered);
}

/** 0 to 100, whole numbers. */
export const dnaPercent = (i: BarInput): number => Math.round((barPoints(i) / barTotal(i)) * 100);

/** Where the gate sits on the bar, 0 to 100. */
export const gatePercent = (gateLength: number, i: Pick<BarInput, 'keys' | 'setups'>): number => (gateLength / barTotal(i)) * 100;

/** Questions left before the gate opens. */
export const toUnlock = (gateLength: number, position: number): number => Math.max(0, gateLength - Math.min(gateLength, position));
