import { createHash } from 'crypto';
import type { GenerationOutput } from './schema';

/**
 * Finds the sentences in generated text that a reader could be misled by if a fact in them is wrong, so each can be checked
 * against a source before the text goes live (see docs/fact-check-process.md). Pure and deterministic: the same text always
 * gives the same sentences and the same hashes, so a verdict stays attached to a sentence that has not changed.
 *
 * High risk (must be verified before applying): a named place, trail or feature; a number with a unit (distance, elevation,
 * duration); an access claim (permit, fee, closure, opening dates, shuttle); a count or plural claim ("several", "many",
 * "loops"); a hard superlative ("only", "first", "longest"); a climate claim (a temperature, "wettest month"). Everything else is low
 * risk and not gated.
 */

export type ClaimKind = 'named' | 'number' | 'access' | 'plural' | 'superlative' | 'climate';

export interface Claim {
  hash: string;
  sentence: string;
  where: string[]; // 'overview' or month keys, every place the sentence appears
  kinds: ClaimKind[];
  entities: string[]; // the named things found, for the person checking
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Capitalized words that are not a named feature.
const NOT_NAMED = new Set([
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'spring', 'summer', 'autumn', 'fall', 'winter',
  'north', 'south', 'east', 'west', 'northern', 'southern', 'eastern', 'western', 'fahrenheit', 'celsius', 'american',
  'atlantic', 'pacific', 'indian', 'arctic', 'mediterranean', 'europe', 'asia', 'africa', 'america', 'i', 'a', 'the',
]);
const CONNECTORS = new Set(['of', 'de', 'di', 'del', 'della', 'la', 'le', 'du', 'des', 'da', 'do']);

export const hashSentence = (s: string): string => createHash('sha1').update(s.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);

export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
}

/** Capitalized runs inside a sentence that look like a name ("Table Mountain", "Pico do Arieiro", "Alta Via 1"). */
export function namedThings(sentence: string, ownName: string): string[] {
  const own = new Set(ownName.toLowerCase().split(/[\s&,]+/).filter(Boolean));
  const raw = sentence.split(/\s+/).filter(Boolean);
  const words = raw.map((w) => w.replace(/[(),;:"“”]/g, ''));
  const found: string[] = [];
  let run: string[] = [];
  const flush = (startIdx: number) => {
    while (run.length && CONNECTORS.has(run[run.length - 1].toLowerCase())) run.pop();
    if (run.length) {
      const phrase = run.join(' ').replace(/[.'’]s$/, '').replace(/[.!?]+$/, '');
      const toks = phrase.split(' ').filter((t) => !CONNECTORS.has(t.toLowerCase()));
      const allOwn = toks.every((t) => own.has(t.toLowerCase().replace(/[^a-z]/g, '')));
      const allCommon = toks.every((t) => NOT_NAMED.has(t.toLowerCase().replace(/[^a-z]/g, '')));
      const lone = toks.length === 1;
      if (!allOwn && !allCommon && !(lone && startIdx === 0)) found.push(phrase);
    }
    run = [];
  };
  let start = 0;
  words.forEach((w, i) => {
    const bare = w.replace(/[.!?]+$/, '');
    const isCap = /^[A-ZÀ-Þ]/.test(bare) || /^\d+$/.test(bare) && run.length > 0;
    if (isCap) { if (run.length === 0) start = i; run.push(bare); }
    else if (run.length && CONNECTORS.has(bare.toLowerCase())) run.push(bare);
    else flush(start);
    if (/[.!?]$/.test(w) || /[,;:)]$/.test(raw[i] ?? '')) flush(start);
  });
  flush(start);
  return [...new Set(found)];
}

const NUMBER_UNIT = /\b\d[\d,.]*(?:\s?(?:-|–|to)\s?\d[\d,.]*)?[\s-]*(?:miles?|mi|km|kilometers?|kilometres?|ft|feet|foot|meters?|metres?|days?|hours?|hrs?|minutes?|mins?|nights?)\b/i;
const ACCESS = /\b(shuts?|shut|huts?|refuges?|lifts?|gondolas?|permits?|reservations?|bookings?|fees?|toll|shuttles?|tickets?|closed|closures?|closing|reopen(?:s|ed)?|restricted|restrictions?|cable cars?|funiculars?|(?:huts?|refuges?|lifts?|ferries|ferry|roads?|passes) (?:are |is )?(?:open|shut|closed|running|operat\w+)|opens? (?:from|in|late|early)|guides? (?:are )?(?:required|mandatory))\b/i;
const PLURAL = /\b(several|many|numerous|multiple|dozens?|hundreds?|countless|network|loops|trails range|routes range|walks range|miles of)\b/i;
const CLIMATE = /\b(wettest|driest|hottest|coldest|warmest|coolest|windiest|rainiest|snowiest|monsoon|rainy season|dry season)\b|\b(?:highs?|lows?|temperatures?|temps)\b[^.]{0,40}\b\d{1,3}0?s?\b|\b\d{2,3}\s?(?:°\s?F|degrees)\b|\bin the \d0s\b|\bnear \d{2,3}\b/i;
const SUPERLATIVE = /\b(only|first|oldest|highest|tallest|longest|largest|deepest|steepest|the world's|in the world|in europe|in africa|in asia|in north america)\b/i;

export function claimKinds(sentence: string, ownName: string): { kinds: ClaimKind[]; entities: string[] } {
  const kinds: ClaimKind[] = [];
  const entities = namedThings(sentence, ownName);
  if (entities.length) kinds.push('named');
  if (NUMBER_UNIT.test(sentence)) kinds.push('number');
  if (ACCESS.test(sentence)) kinds.push('access');
  if (PLURAL.test(sentence)) kinds.push('plural');
  if (SUPERLATIVE.test(sentence)) kinds.push('superlative');
  if (CLIMATE.test(sentence)) kinds.push('climate');
  return { kinds, entities };
}

/** Every high-risk sentence in the output (overview and 12 months), merged when the same sentence appears in several months. */
export function extractClaims(output: GenerationOutput, ownName: string): Claim[] {
  const byHash = new Map<string, Claim>();
  const texts: Array<[string, string]> = [['overview', output.overview], ...output.monthly.map((m, i) => [MONTH_KEYS[i], m.text] as [string, string])];
  for (const [where, text] of texts) {
    for (const sentence of splitSentences(text ?? '')) {
      const { kinds, entities } = claimKinds(sentence, ownName);
      if (kinds.length === 0) continue;
      const hash = hashSentence(sentence);
      const known = byHash.get(hash);
      if (known) { if (!known.where.includes(where)) known.where.push(where); continue; }
      byHash.set(hash, { hash, sentence, where: [where], kinds, entities });
    }
  }
  return [...byHash.values()];
}
