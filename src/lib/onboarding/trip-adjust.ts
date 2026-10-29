import { DEFAULT_MATCH_SETTINGS, type MatchSettings } from '@/lib/scoring/matchSettings';
import { estimateFlightHours, milesBetween } from './airports';
import type { Origin } from './origin';
import { daysFor, lengthFactor, lengthTier, type LengthTier, type TripLength } from './trip-length';
import { allRegions, regionAllows, type RegionKey } from './regions';

/**
 * What the trip settings do to the places, in one place so the shortlist, the full results page and the settings sheet agree:
 *   - Trip length ranks a place lower when the flights would eat the trip (`factors`, never hides a place).
 *   - Continents leave out places in regions the traveler turned off (`leftOut`).
 * The flight-hour limit is separate (applyFlightLimit in shortlist.ts) because it also says why a place was set aside.
 */

export interface TripAdjustInput {
  coords: Record<string, { lat: number; lon: number }>;
  regions: Record<string, RegionKey | null>;
  origin: Origin | null;
  length: TripLength | null;
  continents: readonly RegionKey[];
  settings?: MatchSettings;
}

export interface TripAdjust {
  /** Place id to what the place keeps of its score for the trip length (only places below 1). */
  factors: Record<string, number>;
  /** Place id to how the flights fit the trip length, for the "How long" card. Empty without a home or a length. */
  tiers: Record<string, LengthTier>;
  /** Place id to flying hours one way from home. */
  hours: Record<string, number>;
  /** Ids of places in regions that are turned off. */
  leftOut: Set<string>;
}

export function tripAdjust(a: TripAdjustInput): TripAdjust {
  const s = a.settings ?? DEFAULT_MATCH_SETTINGS;
  const days = daysFor(a.length);
  const out: TripAdjust = { factors: {}, tiers: {}, hours: {}, leftOut: new Set() };
  const filtering = !allRegions(a.continents);
  for (const [id, at] of Object.entries(a.coords)) {
    if (a.origin) {
      const h = estimateFlightHours(milesBetween(a.origin, at));
      out.hours[id] = h;
      if (days) {
        out.tiers[id] = lengthTier(days, h, s);
        const f = lengthFactor(days, h, s);
        if (f < 1) out.factors[id] = f;
      }
    }
  }
  // A place with no coordinates still has a region (it comes from its country), so the continents filter reads the region map, not the coordinates.
  for (const id of Object.keys(a.regions)) if (filtering && !regionAllows(a.continents, a.regions[id])) out.leftOut.add(id);
  return out;
}
