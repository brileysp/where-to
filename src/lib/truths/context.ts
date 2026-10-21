import type { InterestFactValue } from '@/lib/db/schema';

/**
 * Everything the known-truths checks look at, loaded once. The checks are pure functions of this, so each can be tried against a deliberately
 * broken copy to prove it can fail.
 */
export interface TruthChip {
  interestKey: string;
  chipKey: string;
  label: string;
  status: 'live' | 'draft';
  drivers: Array<{ column: string; option?: string; fullAt?: number }>;
  needsColumn: string;
  approvedBy: string;
  approvedAt: Date | string | null;
}

export interface TruthQuestion {
  interestKey: string;
  questionKey: string;
  text: string;
  options: string[];
  maxPicks: number;
  missMessage: string;
  fitRule: { answers: Array<{ checks: Array<Record<string, unknown>> } | null> } | null;
  approvedBy: string;
  approvedAt: Date | string | null;
}

export interface TruthLink {
  interestKey: string;
  questionKey: string;
  chipKey: string;
  suggested: boolean;
}

export interface TruthFactRow {
  placeId: string;
  interestKey: string;
  facts: Record<string, InterestFactValue>;
}

export interface TruthPlace {
  id: string;
  name: string;
  region: string;
  emoji: string;
  baseScores: Record<string, number>;
  curves: Record<string, { anchors: Array<{ month: number; value: number }> }>;
  naSliders: string[];
  naReasons: Record<string, { reason?: string }>;
  overview: Record<string, string>;
  monthly: Record<string, Array<string | null>>;
}

export interface TruthTodo {
  id: string;
  status: string;
  doneAt: Date | string | null;
}

export interface TruthContext {
  chips: TruthChip[];
  questions: TruthQuestion[];
  links: TruthLink[];
  facts: TruthFactRow[];
  places: TruthPlace[];
  todos: TruthTodo[];
  /** The matching numbers saved in the admin (only what was changed). */
  matchOverride: unknown;
}

export const emptyContext = (): TruthContext => ({ chips: [], questions: [], links: [], facts: [], places: [], todos: [], matchOverride: null });
