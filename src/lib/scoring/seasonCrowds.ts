import type { ScoredDestination } from './types';

/**
 * How busy and how expensive a place's month is, for the Crowds & prices scale. It reads what we authored for the place, as two separate things:
 *   - the crowds: `peakIntensity` (how extreme the crowds are in the peak months: extreme, high, moderate or mild) and `crowdBaseline` (chronically busy or quiet);
 *   - the prices: `priceSwing` (how much prices swing between the peak and low seasons: extreme, high, moderate or mild).
 * Crowds and prices are different (a remote safari camp has few crowds and wildly seasonal rates; the Galapagos has capped crowds and flat prices), so
 * each has its own tier. Both follow the place's authored peak and low season months.
 *
 * The result is an `offset`: the distance from a typical month. Negative in a busy, pricey month, positive in a quiet, cheap one, and zero in a typical
 * month, for a month nobody can visit, and (nearly) for a place whose season makes little difference. An extreme peak is 5 below typical, a high one 4,
 * a moderate one 3 and a mild one 1; a low-season month is 3 above typical for an extreme swing, 2.4 for a high one, 1.8 for a moderate one and 0.6 for a mild one. In a peak month the worse of
 * the crowds part and the prices part counts; in any other month the two are averaged.
 */
type Tier = 'extreme' | 'high' | 'moderate' | 'mild';
const SCALE: Record<Tier, number> = { extreme: 1, high: 0.8, moderate: 0.6, mild: 0.2 };
const PEAK_OFFSET = -5;
const LOW_OFFSET = 3;

type SeasonFields = Pick<ScoredDestination, 'peak' | 'low' | 'peakIntensity' | 'priceSwing' | 'crowdBaseline' | 'inaccessible'>;

export function crowdOffset(d: SeasonFields, monthIdx: number): number {
  const m = monthIdx + 1;
  const isPeak = (d.peak ?? []).includes(m);
  const isLow = (d.low ?? []).includes(m);
  let o = isPeak ? PEAK_OFFSET * SCALE[d.peakIntensity || 'moderate'] : isLow ? LOW_OFFSET * SCALE[d.peakIntensity || 'moderate'] : 0;
  // A chronically busy place stays busy even in its low season; a chronically quiet one stays quiet even in its peak.
  if (d.crowdBaseline === 'high') o = Math.min(o, isPeak ? -4 : -1);
  if (d.crowdBaseline === 'low') o = Math.max(o, isPeak ? 2 : 4);
  return o;
}

export function priceOffset(d: SeasonFields, monthIdx: number): number {
  const m = monthIdx + 1;
  const tier = SCALE[d.priceSwing || d.peakIntensity || 'moderate'];
  return (d.peak ?? []).includes(m) ? PEAK_OFFSET * tier : (d.low ?? []).includes(m) ? LOW_OFFSET * tier : 0;
}

/** How far a month sits from a typical one for this place: negative when busy and pricey, positive when quiet and cheap, 0 where it makes no difference. */
export function seasonOffset(d: SeasonFields, monthIdx: number): number {
  if ((d.inaccessible ?? []).includes(monthIdx + 1)) return 0;
  const c = crowdOffset(d, monthIdx);
  const p = priceOffset(d, monthIdx);
  // In a peak month the worse of the two counts: a quiet place with wildly seasonal prices is still an expensive month. Elsewhere they average.
  return (d.peak ?? []).includes(monthIdx + 1) ? Math.min(c, p) : (c + p) / 2;
}
