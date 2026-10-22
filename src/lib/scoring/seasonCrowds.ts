import type { ScoredDestination } from './types';

/**
 * How busy and expensive a place's month is, from what we authored for it: its peak and low season months, how extreme its peak is
 * (`peakIntensity`: extreme, moderate or mild) and whether it is chronically busy or quiet (`crowdBaseline`). The same rules the old Crowds and Deals
 * formula used (destinations.ts), kept here so "Crowds & prices" reads real authored seasonality, not a number derived from other interests' curves
 * (which swings about the same for every place, Amalfi and the Galapagos alike).
 *
 * It reads "Crowds & prices" together, so unlike the old Crowds formula it does not treat a quiet place's peak month as quiet: prices still peak. The value runs 0 to 10, high = quiet and cheap. A typical month (no flag) is 6, which is the neutral point: `seasonOffset` is the distance from it.
 */
export const TYPICAL_SEASON = 6;

/** The quietness of a month, 1 to 10, or null for a month nobody can visit (it is neither a deal nor quiet). `monthIdx` is 0 to 11. */
export function seasonQuietness(d: Pick<ScoredDestination, 'peak' | 'low' | 'peakIntensity' | 'crowdBaseline' | 'inaccessible'>, monthIdx: number): number | null {
  const m = monthIdx + 1;
  if ((d.inaccessible ?? []).includes(m)) return null;
  const isPeak = (d.peak ?? []).includes(m);
  let v: number;
  if (isPeak) {
    const intensity = d.peakIntensity || 'moderate';
    v = intensity === 'extreme' ? 1 : intensity === 'mild' ? 5 : 3;
  } else {
    v = (d.low ?? []).includes(m) ? 9 : TYPICAL_SEASON;
  }
  // A chronically busy place stays busy and pricey even in its low season. A chronically quiet place (a remote safari camp, say) has few crowds but
  // its peak months are still the expensive ones, so its peak counts as at least a moderate peak instead of being read as quiet.
  if (d.crowdBaseline === 'high') v = Math.min(v, isPeak ? 2 : 5);
  if (d.crowdBaseline === 'low' && isPeak) v = Math.min(v, 3);
  return v;
}

/** How far a month sits from a typical one: negative in a busy, pricey month, positive in a quiet, cheap one, 0 where it makes no difference. */
export function seasonOffset(d: Parameters<typeof seasonQuietness>[0], monthIdx: number): number {
  const v = seasonQuietness(d, monthIdx);
  return v === null ? 0 : v - TYPICAL_SEASON;
}
