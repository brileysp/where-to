import type { InterestFactValue } from '@/lib/db/schema';
import type { FactDef } from '@/lib/admin/interest-pages/config';
import { chipFit } from '@/lib/admin/interest-pages/chips';
import { questionsToAsk } from '@/lib/onboarding/question-rules';
import { answerRuleFit } from '@/lib/onboarding/question-fit';
import { matchInterest, type AnswerCheck, type TickedChip } from './personalMatch';
import { DEFAULT_MATCH_SETTINGS, type MatchSettings } from './matchSettings';
import type { InterestMatchDetail, MatchChipDef, MatchQuestionDef } from './interestMatch';

/**
 * The match, split so the traveler's browser never needs the place facts or the rules behind them. The server works out, once per place, how
 * well the place does for every chip and every answer option (`buildPlaceFits`). The browser then only combines the traveler's picks with those
 * small tables (`matchFromFits`), through the same `matchInterest` formula the rest of the app uses. A test proves both routes agree.
 */

/** Marks an answer option that asks for nothing in particular ("It does not matter"): picking it skips the whole question. */
export const ASKS_NOTHING = -1;

export interface PlaceMatchFits {
  /** Chip key to the place's 0 to 10 rating, or null when it has no data (which counts as fine). Live chips only. */
  chips: Record<string, number | null>;
  /** Question key to one entry per answer option: a 0 to 1 fit, null for no data, or ASKS_NOTHING. Asked-about questions only. */
  answers: Record<string, Array<number | null>>;
}

/** What the browser needs to know about an interest to combine picks with the tables (no place data in here). */
export interface MatchContent {
  chips: Array<{ key: string; label: string; live: boolean }>;
  questions: Array<{ key: string; kind: 'lean' | 'limit'; whenChips: string[]; missMessage: string }>;
}

/** Server side: how well one place does for every chip and every answer option of one interest. Questions that are not approved or not mapped are left out. */
export function buildPlaceFits(chips: MatchChipDef[], questions: MatchQuestionDef[], facts: Record<string, InterestFactValue>, defs: FactDef[]): PlaceMatchFits {
  const out: PlaceMatchFits = { chips: {}, answers: {} };
  for (const c of chips) {
    if (!c.live) continue;
    out.chips[c.key] = c.drivers.length ? chipFit(c.drivers, defs, facts) : null;
  }
  for (const q of questions) {
    if (!q.approved || !q.fitRule) continue;
    out.answers[q.key] = q.fitRule.answers.map((rule) => (rule ? answerRuleFit(rule, defs, facts) : ASKS_NOTHING));
  }
  return out;
}

/** The fit for the picked answer positions, the same rule as `questionFit`: skipped if any pick asks for nothing, otherwise the best pick. */
export function fitFromOptions(perOption: ReadonlyArray<number | null> | undefined, picked: readonly number[]): number | null {
  if (!perOption || picked.length === 0) return null;
  const reads = picked.map((i) => (i >= 0 && i < perOption.length ? perOption[i] : ASKS_NOTHING));
  if (reads.some((r) => r === ASKS_NOTHING)) return null;
  const fits = (reads as Array<number | null>).filter((x): x is number => x !== null);
  return fits.length ? Math.max(...fits) : null;
}

export interface MatchFromFitsArgs {
  content: MatchContent;
  fits: PlaceMatchFits | undefined;
  /** Keys of the chips the traveler ticked in this interest. */
  ticked: readonly string[];
  /** Question key to the positions picked. */
  answers: Readonly<Record<string, readonly number[]>>;
  settings?: MatchSettings;
}

/** Browser side: the same answer as `interestMatchFor`, from the tables. A place with no table (no data on file) is a pass. */
export function matchFromFits(a: MatchFromFitsArgs): InterestMatchDetail {
  const s = a.settings ?? DEFAULT_MATCH_SETTINGS;
  const live = a.content.chips.filter((c) => c.live);
  const liveKeys = live.map((c) => c.key);
  const tickedLive = live.filter((c) => a.ticked.includes(c.key));
  const ticked: TickedChip[] = tickedLive.map((c) => ({ label: c.label, rating: a.fits?.chips[c.key] ?? null }));
  const asked = questionsToAsk(a.content.questions, tickedLive.map((c) => c.key), liveKeys);
  const answers: AnswerCheck[] = [];
  for (const q of asked) {
    const picked = a.answers[q.key];
    if (!picked || picked.length === 0) continue;
    const perOption = a.fits?.answers[q.key];
    if (!perOption) continue;
    answers.push({ kind: q.kind, fit: fitFromOptions(perOption, picked), message: q.missMessage });
  }
  const m = matchInterest({ ticked, chipsOffered: live.length, answers }, s);
  return { ...m, checked: answers.length };
}
