import type { InterestFactValue } from '@/lib/db/schema';
import { driverFit } from '@/lib/admin/interest-pages/chips';
import { LIKELIHOODS, type FactDef } from '@/lib/admin/interest-pages/config';

/**
 * How a place's data answers an onboarding question (docs/matching-model.md, "A fit for each question from its columns").
 * For one question there is a rule with one entry per answer option. The entry says what the place has to look like for a traveler who
 * picked that answer. null = that answer asks for nothing in particular ("It does not matter", "Either", "I can handle anything"), so the
 * whole question is skipped.
 *
 * Every check returns a fit from 0 (the place is the opposite of what was asked) to 1 (it matches), or null when the place has nothing
 * recorded for it. No data is a pass: the caller leaves that check out. A fit feeds `matchInterest` as `AnswerCheck.fit`.
 *
 *   within    an ordered column, with the highest level the traveler accepts. One step over loses half, two steps lose all of it.
 *   has       the column (choice, multi or tick) includes one of the listed options.
 *   atLeast   the best 0 to 10 reading among the listed columns (a rating, or the odds written in an animal cell) reaches a number.
 *   atMost    a 0 to 10 rating stays at or under a number; above it, it falls away to nothing at 10.
 *   count     a multi column has at most this many options ticked (for the crowding evidence).
 *   warmest   the lowest water temperature written in a text column such as "54-79 F, 3/2 mm" stays at or above a number of degrees F.
 *   named     a named animal in an "Animal (likelihood, months)" cell, scored by its odds (guaranteed 10, likely 8, possible 5, unlikely 2).
 */
export type FitCheck =
  | { type: 'within'; column: string; order: string[]; allowed: string }
  | { type: 'has'; column: string; options: string[] }
  | { type: 'atLeast'; columns: string[]; value: number }
  | { type: 'atMost'; column: string; value: number }
  | { type: 'count'; column: string; atMost: number }
  | { type: 'warmest'; column: string; minF: number }
  | { type: 'named'; column: string; names: string[] };

export interface AnswerRule {
  /** all = every check must hold (the weakest counts); any = one is enough (the best counts). Default all. */
  mode?: 'all' | 'any';
  checks: FitCheck[];
}

export interface QuestionFitRule {
  /** One entry per answer option, in the order of the question's options. null = this answer asks for nothing. */
  answers: Array<AnswerRule | null>;
}

/** What one step over an accepted level costs. */
export const STEP_OVER_COST = 0.5;
/** How far (in degrees F) below the traveler's limit the water can be before the fit falls to nothing. */
export const TEMP_SLACK_F = 10;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const hasFacts = (facts: Record<string, InterestFactValue>) => Object.keys(facts).length > 0;

/** The lowest temperature (degrees F) written in a text such as "54-79 F, 3/2 mm in winter". Null when there is no number to read. */
export function lowestTempF(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const m = text.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  // A leading wetsuit size such as "3/2 mm" is not a temperature: temperatures sit well above freezing for the places we cover.
  return n >= 20 && n <= 100 ? n : null;
}

/** Best odds (0 to 10) among the entries of an "Animal (likelihood, ...)" cell whose name contains one of the words. Null when the cell is blank. */
export function namedAnimalFit(text: unknown, names: string[]): number | null {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const wanted = names.map((n) => n.toLowerCase());
  const odds: Record<string, number> = { guaranteed: 10, likely: 8, possible: 5, unlikely: 2 };
  let best = 0;
  for (const m of text.matchAll(/([^,();]+?)\s*\((guaranteed|likely|possible|unlikely)/gi)) {
    const name = m[1].toLowerCase();
    if (wanted.some((w) => name.includes(w))) best = Math.max(best, odds[m[2].toLowerCase()]);
  }
  return best;
}

export function checkFit(c: FitCheck, defs: FactDef[], facts: Record<string, InterestFactValue>): number | null {
  if (!hasFacts(facts)) return null;
  switch (c.type) {
    case 'within': {
      const v = facts[c.column];
      if (typeof v !== 'string') return null;
      const at = c.order.indexOf(v);
      const ok = c.order.indexOf(c.allowed);
      if (at < 0 || ok < 0) return null;
      return clamp01(1 - STEP_OVER_COST * Math.max(0, at - ok));
    }
    case 'has': {
      const v = facts[c.column];
      if (typeof v === 'boolean') return v === c.options.includes('true') ? 1 : 0;
      // Only a tick is ever stored for the whale ticks, so a tick column that is missing reads as not ticked.
      if (v === undefined && defs.find((d) => d.key === c.column)?.type === 'bool') return 0;
      if (typeof v === 'string') return v === '' ? null : c.options.includes(v) ? 1 : 0;
      if (Array.isArray(v)) return v.length === 0 ? null : v.some((x) => c.options.includes(x)) ? 1 : 0;
      return null;
    }
    case 'atLeast': {
      const reads = c.columns.map((col) => driverFit({ column: col, fullAt: undefined }, defs, facts)).filter((x): x is number => x !== null);
      if (!reads.length) return null;
      return clamp01(Math.max(...reads) / c.value);
    }
    case 'atMost': {
      const v = facts[c.column];
      if (typeof v !== 'number') return null;
      return v <= c.value ? 1 : clamp01(1 - (v - c.value) / (10 - c.value));
    }
    case 'count': {
      const v = facts[c.column];
      // Crowding evidence lists what is documented; a place with the column unticked has no documented crowding.
      const n = Array.isArray(v) ? v.length : 0;
      return clamp01(1 - STEP_OVER_COST * Math.max(0, n - c.atMost));
    }
    case 'warmest': {
      const low = lowestTempF(facts[c.column]);
      if (low === null) return null;
      return low >= c.minF ? 1 : clamp01(1 - (c.minF - low) / TEMP_SLACK_F);
    }
    case 'named': {
      const v = namedAnimalFit(facts[c.column], c.names);
      return v === null ? null : v / 10;
    }
  }
}

/** The fit of a place for one answer: every check (weakest) or any check (best); null when none of them has data. */
export function answerRuleFit(a: AnswerRule, defs: FactDef[], facts: Record<string, InterestFactValue>): number | null {
  const fits = a.checks.map((c) => checkFit(c, defs, facts)).filter((x): x is number => x !== null);
  if (!fits.length) return null;
  return (a.mode ?? 'all') === 'any' ? Math.max(...fits) : Math.min(...fits);
}

/**
 * The fit of a place for a traveler's answer to one question. `picked` are the chosen option positions (a question can allow two).
 * Picking an answer that asks for nothing, or no answer at all, gives null (no check). Several picks: the best one counts, because each is a
 * wish for something different.
 */
export function questionFit(rule: QuestionFitRule, picked: readonly number[], defs: FactDef[], facts: Record<string, InterestFactValue>): number | null {
  if (picked.length === 0) return null;
  const rules = picked.map((i) => rule.answers[i] ?? null);
  if (rules.some((r) => r === null)) return null;
  const fits = (rules as AnswerRule[]).map((r) => answerRuleFit(r, defs, facts)).filter((x): x is number => x !== null);
  return fits.length ? Math.max(...fits) : null;
}

// ---- Plain-language description, for the admin and the review page ----

const labelOf = (defs: FactDef[], col: string) => defs.find((d) => d.key === col)?.label ?? col;
const optionLabel = (defs: FactDef[], col: string, value: string) => {
  const d = defs.find((x) => x.key === col);
  if (d?.type === 'likelihood') return LIKELIHOODS.find((o) => o.value === value)?.label ?? value;
  return d?.options?.find((o) => o.value === value)?.label ?? value;
};
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

const ODDS_WORDS: Record<number, string> = { 10: 'Guaranteed', 8: 'Likely', 5: 'Possible', 2: 'Unlikely' };
const isOddsColumn = (defs: FactDef[], col: string) => { const d = defs.find((x) => x.key === col); return d?.type === 'likelihood' || !!d?.animals; };

export function describeCheck(c: FitCheck, defs: FactDef[]): string {
  switch (c.type) {
    case 'within': {
      const at = c.order.indexOf(c.allowed);
      const passing = c.order.slice(0, at + 1).map((v) => optionLabel(defs, c.column, v));
      const next = c.order[at + 1];
      return `${labelOf(defs, c.column)} is ${list(passing)}${next ? `; "${optionLabel(defs, c.column, next)}" counts half` : ''}`;
    }
    case 'has': {
      const d = defs.find((x) => x.key === c.column);
      if (d?.type === 'bool') return `${labelOf(defs, c.column)} is ticked`;
      return `${labelOf(defs, c.column)} includes ${list(c.options.map((o) => optionLabel(defs, c.column, o)))}`;
    }
    case 'atLeast': {
      if (c.columns.every((x) => isOddsColumn(defs, x))) {
        const word = ODDS_WORDS[c.value];
        const subject = c.columns.length > 3 ? 'The best odds among all the species entries' : `${list(c.columns.map((x) => labelOf(defs, x)))} odds`;
        return `${subject} are ${word ? `${word}${c.value < 10 ? ' or better' : ''}` : `${c.value} of 10 or more`}`;
      }
      return `${list(c.columns.map((x) => labelOf(defs, x)))} is ${c.value} of 10 or more`;
    }
    case 'atMost':
      return `${labelOf(defs, c.column)} is ${c.value} of 10 or lower`;
    case 'count':
      return `${labelOf(defs, c.column)} shows ${c.atMost === 0 ? 'no signs' : c.atMost === 1 ? 'at most 1 sign' : `at most ${c.atMost} signs`} of crowding`;
    case 'warmest':
      return `The coldest water written in "${labelOf(defs, c.column)}" is ${c.minF} F or warmer`;
    case 'named':
      return `${labelOf(defs, c.column)} lists ${list(c.names)} with good odds (a place that lists animals but not this one counts as a miss)`;
  }
}

export function describeAnswerRule(a: AnswerRule | null, defs: FactDef[]): string {
  if (!a) return 'Asks for nothing, so no check';
  const parts = a.checks.map((c) => describeCheck(c, defs));
  return parts.length === 1 ? parts[0] : `${a.mode === 'any' ? 'Either' : 'Both'}: ${parts.join(a.mode === 'any' ? ' / ' : ' and ')}`;
}

/** One line per answer for the admin: "Stay low: Altitude is Low ...". Empty when the question is not mapped to columns yet. */
export function describeQuestionRule(rule: QuestionFitRule | null, options: string[], defs: FactDef[]): string[] {
  if (!rule) return [];
  return options.map((o, i) => `${o}: ${describeAnswerRule(rule.answers[i] ?? null, defs)}`);
}
