import type { MatchSettings } from '@/lib/scoring/matchSettings';

/**
 * Peak or off peak: one scale in five steps that replaces the old "Deals" tick. The traveler says whether they would rather go at the most
 * popular time, or take less perfect weather for fewer crowds and off-season deals. It is a trip setting with a default, like budget and
 * climate. The step is stored as 0 to 4; the middle (2) is where it starts.
 */

export const PEAK_STEPS = 5;
export const DEFAULT_PEAK = 2;

export const isPeak = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < PEAK_STEPS;

/** The short name of each step, as the Trip sheet's row shows it. */
export const PEAK_NAMES = ['Peak times', 'Leaning peak', 'In between', 'Leaning off peak', 'Off peak'] as const;

/** The two ends, with the line that explains each. */
export const PEAK_ENDS = {
  peak: { title: 'Peak times', help: 'Go at the most popular time, even if busy and pricey.' },
  off: { title: 'Off peak', help: 'Less perfect weather in exchange for fewer crowds & off-season deals.' },
} as const;

/** The title of the row, wherever the scale is shown. */
export const PEAK_TITLE = 'Crowds & prices';

/** How far a score moves at a step, per point a month is busier or quieter than typical for the place (the numbers are on the Matching tab). The middle is 0. */
export function peakGain(peak: number, s: MatchSettings): number {
  return [s.peakStepPeak, s.peakStepLeanPeak, 0, s.peakStepLeanOff, s.peakStepOff][isPeak(peak) ? peak : DEFAULT_PEAK];
}
