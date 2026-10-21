import { DEFAULT_MATCH_SETTINGS, type MatchSettings } from './matchSettings';

/**
 * Personalizing one interest's score (docs/matching-model.md). The place's original score is the ceiling: chips and answers can only keep it or
 * lower it. For every check, what survives is
 *
 *   1 - (1 - keep) * (1 - fit)        keep = what a complete miss leaves (from the settings), fit = how well the place matches, 0 to 1
 *
 * Chips are one check: the best rating among the chips the traveler ticked. Each answered question is one more check, a Limit (wall) or a Lean
 * (wish). The checks multiply, the interest never keeps less than the floor, and a check with no data counts as a pass. The result replaces the
 * interest's score before the existing blend across interests, so an interest the traveler cares little about barely moves the match.
 */

export interface TickedChip {
  label: string;
  /** The place's 0 to 10 rating for this chip (for the month being scored when the chip is timed). Null = not recorded, which counts as fine. */
  rating: number | null;
}

export interface AnswerCheck {
  kind: 'limit' | 'lean';
  /** How well the place matches this answer, 0 to 1. Null = not recorded, which counts as fine. */
  fit: number | null;
  /** The reason chip text for a miss. Empty = no chip for this question. */
  message: string;
}

export interface InterestMatchInput {
  /** The interest's live chips the traveler ticked, with this place's ratings. Ticking none, or every chip, asks for nothing in particular. */
  ticked: TickedChip[];
  /** How many chips the interest offers (live ones). */
  chipsOffered: number;
  /** Only the questions that are currently asked (see question-rules.ts), answered. */
  answers: AnswerCheck[];
}

export interface MatchReason {
  source: 'chip' | 'limit' | 'lean';
  message: string;
  /** The share of the interest's score this one check takes off, 0 to 1. */
  cost: number;
}

export interface InterestMatch {
  /** What survives, 0.3 to 1 with the default floor. Multiply the interest's original score by this. */
  factor: number;
  /** The biggest knock-downs worth a chip, biggest first, at most `maxReasons`. */
  reasons: MatchReason[];
  /** The ticked chips this place matches fully, for the green "Matches" chip. These change no numbers. */
  matches: string[];
}

export const survives = (keep: number, fit: number): number => 1 - (1 - keep) * (1 - Math.max(0, Math.min(1, fit)));

export function matchInterest(input: InterestMatchInput, s: MatchSettings = DEFAULT_MATCH_SETTINGS): InterestMatch {
  const parts: MatchReason[] = [];
  const matches: string[] = [];
  let factor = 1;

  const asksForSomething = input.ticked.length > 0 && input.ticked.length < input.chipsOffered;
  if (asksForSomething) {
    const known = input.ticked.filter((c) => c.rating !== null) as Array<TickedChip & { rating: number }>;
    if (known.length) {
      const best = known.reduce((a, b) => (b.rating > a.rating ? b : a));
      const fit = Math.min(1, best.rating / s.chipFullMatchRating);
      const f = survives(s.keepIfChipMissed, fit);
      factor *= f;
      const names = input.ticked.map((c) => c.label);
      if (1 - f > 0) parts.push({ source: 'chip', message: names.length === 1 ? `Not much for: ${names[0]}` : 'Not much of what you picked', cost: 1 - f });
      for (const c of known) if (c.rating >= s.chipFullMatchRating) matches.push(c.label);
    }
  }

  for (const a of input.answers) {
    if (a.fit === null) continue;
    const f = survives(a.kind === 'limit' ? s.keepIfLimitMissed : s.keepIfLeanMissed, a.fit);
    factor *= f;
    if (1 - f > 0 && a.message) parts.push({ source: a.kind, message: a.message, cost: 1 - f });
  }

  factor = Math.max(s.interestFloor, factor);
  const reasons = parts.filter((p) => p.cost >= s.reasonThreshold).sort((a, b) => b.cost - a.cost).slice(0, s.maxReasons);
  return { factor, reasons, matches };
}
