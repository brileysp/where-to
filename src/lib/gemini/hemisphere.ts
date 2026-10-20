/**
 * Places whose text must name months instead of seasons: the Southern Hemisphere, and the equatorial belt where there are no
 * four seasons. Most app users live in the Northern Hemisphere, so "summer" or "winter" for Cape Town or Patagonia reads backwards.
 * Decided by country code (the catalog has no coordinates yet); a few places in mixed countries are listed by id.
 * Owner rule, 14 Oct 2026.
 */
const MONTHS_ONLY_COUNTRIES = new Set([
  'AUS', 'NZL', 'ZAF', 'NAM', 'BWA', 'ZWE', 'ZMB', 'MOZ', 'MDG', 'MUS', 'AGO', 'MWI', 'LSO', 'SWZ', 'ARG', 'CHL', 'URY', 'PRY', 'BOL', 'PER',
  'BRA', 'ECU', 'FLK', 'ATA', 'FJI', 'PYF', 'WSM', 'TON', 'COK', 'NCL', 'VUT', 'SLB', 'PNG', 'REU', 'SYC', 'TZA', 'KEN', 'RWA', 'UGA', 'COD', 'IDN', 'TLS',
]);

export function usesMonthsNotSeasons(countryCode: string | null | undefined): boolean {
  return !!countryCode && MONTHS_ONLY_COUNTRIES.has(countryCode.toUpperCase());
}

const SEASON_WORDS = /\b(spring|summer|autumn|fall|winter)\b/gi;

/** The season words found in the text, for the validator. "Fall" only counts when capitalized or clearly a season ("in fall"). */
export function seasonWordsIn(text: string): string[] {
  return [...text.matchAll(SEASON_WORDS)].map((m) => m[0].toLowerCase()).filter((w) => w !== 'fall' || /\b(in|the|during|late|early) fall\b|\bFall\b/.test(text));
}
