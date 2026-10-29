import { DEFAULT_MATCH_SETTINGS, type MatchSettings } from '@/lib/scoring/matchSettings';

/**
 * "How long?" (the trip's length) and what it does: the flights to a place are counted against the trip. The time in the air both ways, plus a
 * few hours of airports and transfers, as a share of the trip. A small share is fine, a larger one ranks the place a little lower, and a
 * share that would be most of the trip ranks it much lower. It never hides a place; the numbers are on the admin's Matching tab.
 */
export type TripLength = 'wk' | '1w' | '2w' | '3w';

export interface TripLengthChoice {
  key: TripLength;
  label: string;
  sub: string;
  days: number;
}

export const TRIP_LENGTHS: TripLengthChoice[] = [
  { key: 'wk', label: 'Long weekend', sub: '3 to 4 days', days: 4 },
  { key: '1w', label: '1 week', sub: '', days: 7 },
  { key: '2w', label: '2 weeks', sub: '', days: 14 },
  { key: '3w', label: '3+ weeks', sub: '', days: 21 },
];

export const isTripLength = (v: unknown): v is TripLength => TRIP_LENGTHS.some((l) => l.key === v);
export const daysFor = (len: TripLength | null | undefined): number | null => TRIP_LENGTHS.find((l) => l.key === len)?.days ?? null;

export type LengthTier = 'ok' | 'stretch' | 'far';

/** The share of the trip spent getting there and back, 0 and up. */
export function travelShare(days: number, hoursEachWay: number, s: MatchSettings = DEFAULT_MATCH_SETTINGS): number {
  return (2 * hoursEachWay + s.tripAirportHours) / (days * 24);
}

export function lengthTier(days: number, hoursEachWay: number, s: MatchSettings = DEFAULT_MATCH_SETTINGS): LengthTier {
  const share = travelShare(days, hoursEachWay, s);
  return share <= s.tripStretchShare ? 'ok' : share <= s.tripFarShare ? 'stretch' : 'far';
}

/** What the place keeps of its score for this trip length: 1, or a little less, or much less. */
export function lengthFactor(days: number, hoursEachWay: number, s: MatchSettings = DEFAULT_MATCH_SETTINGS): number {
  const t = lengthTier(days, hoursEachWay, s);
  return t === 'ok' ? 1 : t === 'stretch' ? s.keepIfTripStretch : s.keepIfTripFar;
}
