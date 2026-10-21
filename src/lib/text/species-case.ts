import { BIRD_NAMES } from './bird-names';
import { stripEmphasis } from './emphasis';

/**
 * Species-name capitalization (owner rule, 19 Oct 2026): a bird's full official name is written in Title Case ("Grey Heron", "Brent Geese");
 * every other animal is lowercase except for proper nouns and adjectives inside the name. This checks the first half for the birds we know
 * by name: the headline birds of the birding facts (src/lib/text/bird-names.ts, rebuilt by scripts/build-bird-case-list.ts). It finds each
 * known name written in any other casing, singular or plural, and says how it should read. It does not know birds that are not on that list.
 */

export const SPECIES_CASE_INTERESTS: ReadonlySet<string> = new Set(['birding', 'wildlifeViewing', 'whaleWatching', 'safari']);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest names first, so "Eurasian Teal" is read as one name and not twice.
const COMPILED = [...BIRD_NAMES].sort((a, b) => b.length - a.length).map((name) => ({ name, re: new RegExp(`(?<![\\p{L}-])${escape(name)}(?=(?:e?s)?(?![\\p{L}-]))`, 'giu') }));

export interface CaseProblem {
  found: string;
  expected: string;
}

/** Known bird names written in the wrong casing. Empty means nothing to fix. */
export function birdCaseProblems(text: string): CaseProblem[] {
  const plain = stripEmphasis(text);
  const out: CaseProblem[] = [];
  for (const { name, re } of COMPILED) {
    re.lastIndex = 0;
    for (const m of plain.matchAll(re)) if (m[0] !== name) out.push({ found: m[0], expected: name });
  }
  return out;
}
