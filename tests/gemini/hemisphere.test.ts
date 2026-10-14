import { describe, expect, it } from 'vitest';
import { seasonWordsIn, usesMonthsNotSeasons } from '../../src/lib/gemini/hemisphere';

describe('hemisphere wording', () => {
  it('flags Southern Hemisphere and equatorial country codes', () => {
    expect(usesMonthsNotSeasons('ZAF')).toBe(true);
    expect(usesMonthsNotSeasons('arg')).toBe(true);
    expect(usesMonthsNotSeasons('KEN')).toBe(true);
    expect(usesMonthsNotSeasons('ITA')).toBe(false);
    expect(usesMonthsNotSeasons(null)).toBe(false);
  });
  it('finds season words but not unrelated "fall"', () => {
    expect(seasonWordsIn('Winter rains and spring flowers.')).toEqual(['winter', 'spring']);
    expect(seasonWordsIn('Rocks fall onto the path.')).toEqual([]);
    expect(seasonWordsIn('Best in the fall.')).toEqual(['fall']);
  });
});
