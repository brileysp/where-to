import { MONTH_NAMES } from './constants';
import { deriveWeatherBand, has } from './destinations';
import type { ScoringDestination } from './types';

// Ported verbatim from data.js:152-343 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/data.js).

const prevMonth = (m: number) => (m === 1 ? 12 : m - 1);
const nextMonth = (m: number) => (m === 12 ? 1 : m + 1);

/**
 * Where month `m` falls within the CONTIGUOUS run of `arr` that contains
 * it (not `arr`'s raw index) — some destinations have multi-segment
 * seasons, so this walks outward from `m` to find just the segment it's
 * actually part of, wrapping across the Dec->Jan boundary correctly.
 */
export function seasonPosition(arr: number[] | null | undefined, m: number): string | null {
  if (!Array.isArray(arr) || !arr.length) return null;
  const set = new Set(arr);
  if (!set.has(m)) return null;
  // A year-round "season" has no meaningful start/middle/end.
  if (set.size >= 12) return null;
  let start = m;
  let end = m;
  let guard = 0;
  while (set.has(prevMonth(start)) && guard < 11) {
    start = prevMonth(start);
    guard++;
  }
  guard = 0;
  while (set.has(nextMonth(end)) && guard < 11) {
    end = nextMonth(end);
    guard++;
  }
  const len = start <= end ? end - start + 1 : 12 - start + 1 + end;
  const idx = m >= start ? m - start : 12 - start + m;
  if (len === 1) return 'the only month of';
  if (idx === 0) return 'the start of';
  if (idx === len - 1) return 'the tail end of';
  if (idx <= Math.floor(len / 3)) return 'early in';
  if (idx >= Math.ceil((2 * len) / 3) - 1) return 'late in';
  return 'the heart of';
}

interface SeasonDescriptor {
  arr: number[];
  phrase: string;
}

/** Which named season (if any) headlines month `m`, and the array to position within. */
export function seasonDescriptor(d: ScoringDestination, m: number): SeasonDescriptor | null {
  const dry = has(d.dry, m);
  const wet = has(d.wet, m);
  const hot = has(d.hot, m);
  const cold = has(d.cold, m);
  if (dry && hot) return { arr: d.dry, phrase: 'the hot, dry season' };
  if (dry && cold) return { arr: d.dry, phrase: 'the cool, dry season' };
  if (wet && hot) return { arr: d.wet, phrase: 'the hot, wet season' };
  if (wet && cold) return { arr: d.wet, phrase: 'the cold, wet season' };
  if (dry) return { arr: d.dry, phrase: 'the dry season' };
  if (wet) return { arr: d.wet, phrase: 'the wet season' };
  if (cold) return { arr: d.cold, phrase: 'the cold season' };
  if (hot) return { arr: d.hot, phrase: 'the hot season' };
  return null;
}

const WEATHER_BAND_WORD: Record<string, string> = { cold: 'cold', cool: 'mild', warm: 'warm', hot: 'hot' };

// A stable, deterministic (not random-per-render) way to give same-pattern
// destinations different wording: hash the destination id into a pick
// among a few equivalent phrasings.
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pickVariant<T>(arr: T[], seed: string): T {
  return arr[hashSeed(seed) % arr.length];
}

// Same weather BAND reads differently depending on what kind of place it
// is — "warm" means something different in the tropics than at altitude.
const CLIMATE_TEMP_PHRASE: Record<string, Record<string, string>> = {
  tropical: { cold: 'cool for the tropics', cool: 'pleasantly cool', warm: 'warm and humid', hot: 'hot and humid' },
  desert: { cold: 'cold once the sun drops', cool: 'cool and dry', warm: 'warm and dry', hot: 'scorching and dry' },
  mediterranean: { cold: 'cool and crisp', cool: 'mild', warm: 'warm and sunny', hot: 'hot and dry' },
  temperate: { cold: 'cold', cool: 'cool and changeable', warm: 'mild', hot: 'warm' },
  highland: { cold: 'cold, with thin mountain air', cool: 'crisp at altitude', warm: 'mild by day, cold at night', hot: 'warm for the altitude' },
  polar: { cold: 'bitterly cold', cool: 'cold', warm: 'cool by Arctic standards', hot: 'as warm as it gets up here' },
};
function climateTempPhrase(climate: string, band: string): string {
  const row = CLIMATE_TEMP_PHRASE[climate];
  return (row && row[band]) || WEATHER_BAND_WORD[band] || 'mild';
}

const SHOULDER_PHRASE: Record<string, string> = {
  tropical: 'a quieter, in-between month',
  desert: 'a quieter shoulder month',
  mediterranean: 'a quieter shoulder month',
  temperate: 'a transitional month between seasons',
  highland: 'a quieter month between the main seasons',
  polar: 'a quieter month before the extremes set in',
};

const LOW_TAIL_VARIANTS = [
  'a good time for value and thinner crowds',
  'quieter and easier on the budget',
  'fewer visitors and better deals than usual',
];

/**
 * Crowds & price — deliberately NOT interest-specific: whether a month is
 * peak or low season affects everyone's trip. Intensity-aware on the peak
 * side; deliberately understated even at 'extreme'. 'mild' peaks aren't
 * mentioned at all, matching the badge behavior.
 */
export function crowdPriceClause(d: ScoringDestination, m: number): string {
  const peak = has(d.peak, m);
  const low = has(d.low, m);
  if (peak) {
    const intensity = d.peakIntensity || 'moderate';
    if (intensity === 'extreme') return ', with peak crowds and prices';
    if (intensity === 'moderate') return ', with higher tourism volume and prices';
    return '';
  }
  if (!low) return '';
  const yearRound = new Set(d.low).size >= 12;
  const position = yearRound ? null : seasonPosition(d.low, m);
  const tail = pickVariant(LOW_TAIL_VARIANTS, d.id + ':low');
  return yearRound
    ? `, and it's low season year-round — ${tail}`
    : `, and ${position} low season — ${tail}`;
}

/**
 * Practical "don't get blindsided" facts — closures and hazards, not
 * activity endorsements. Only the single most severe one shows, in
 * priority order.
 */
export function accessCaveatClause(d: ScoringDestination, m: number): string {
  if (has(d.inaccessible, m)) return ' <span class="blurb-caveat">Not accessible this month.</span>';
  if (has(d.wildlifeClosed, m)) return ' <span class="blurb-caveat">The wildlife reserve/park is closed this month.</span>';
  if (has(d.swimHazard, m)) return ' <span class="blurb-caveat">Storm or hazard risk in the water this month.</span>';
  if (d.shopClosures && has(d.low, m)) return ' <span class="blurb-caveat">Some shops, hotels & restaurants close for the season.</span>';
  return '';
}

/**
 * A destination-specific, non-weather headline event — hand-authored per
 * destination in `d.specialSeasons` because the "why now" is a real,
 * named thing rather than a climate pattern.
 */
export function specialSeasonClause(d: ScoringDestination, m: number): string {
  if (!Array.isArray(d.specialSeasons)) return '';
  const hit = d.specialSeasons.find((s) => has(s.months, m));
  if (!hit) return '';
  return ` <span class="blurb-special">${hit.text}</span>`;
}

export function generateMonthlyBlurb(d: ScoringDestination, m: number): string {
  const monthName = MONTH_NAMES[m - 1];

  // d.monthlyWeather is real, researched per-destination-per-month text —
  // replaces the generated climate-archetype + season-position phrasing
  // below, which draws from a small shared phrase bank and reads
  // near-identically across destinations that share a climate.
  const handWritten = Array.isArray(d.monthlyWeather) ? d.monthlyWeather[m - 1] : null;

  let seasonClause: string;
  let tempClause: string;
  if (handWritten) {
    seasonClause = handWritten;
    tempClause = '';
  } else {
    const season = seasonDescriptor(d, m);
    const band = deriveWeatherBand(d, m);
    const tempPhrase = climateTempPhrase(d.climate, band);
    const seasonIsYearRound = season && new Set(season.arr).size >= 12;
    seasonClause = seasonIsYearRound
      ? `${season.phrase}, year-round`
      : season
        ? `${seasonPosition(season.arr, m)} ${season.phrase}`
        : SHOULDER_PHRASE[d.climate] || 'a quieter shoulder month';
    // Skip restating temperature if the season phrase already named it.
    tempClause = season && /hot|cold|cool/.test(season.phrase) ? '' : `, ${tempPhrase}`;
  }

  const crowdClause = crowdPriceClause(d, m);
  const specialClause = specialSeasonClause(d, m);
  const caveatClause = accessCaveatClause(d, m);

  return `<strong class="blurb-month">${monthName}</strong> in ${d.name} is ${seasonClause}${tempClause}${crowdClause}.${specialClause}${caveatClause}`;
}
