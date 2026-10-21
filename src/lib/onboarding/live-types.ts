import type { MatchContent } from '@/lib/scoring/matchTable';

/** What the live questions need from the server, shared by the loader and the screens (no database code in here). */

export interface OnboardingQuestion {
  key: string;
  text: string;
  options: string[];
  /** How many answers can be picked. */
  maxPicks: number;
  kind: 'lean' | 'limit';
  /** Chips (same interest) that open the question; empty = asked of everyone who picks the interest. */
  whenChips: string[];
  order: number;
  /** True when the answers are tied to place data, so the answer changes the list. False = asked anyway, changes nothing yet. */
  mapped: boolean;
}

export interface InterestMatchSetup {
  /** Chips and questions as the browser combines them with the per-place tables. */
  content: MatchContent;
  /** The questions to show, in the admin's order. */
  questions: OnboardingQuestion[];
}

/** Interest key to its setup. Only interests with at least one approved, mapped question appear. */
export type MatchSetups = Record<string, InterestMatchSetup>;
