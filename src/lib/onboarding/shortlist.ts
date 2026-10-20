import { computeRankedDestinations, type RankedDestination } from '@/lib/scoring/rank';
import { isVisibleForWeights } from '@/lib/scoring/gating';
import type { ScoredDestination } from '@/lib/scoring/types';
import { airportByCode, estimateFlightHours, milesBetween } from './airports';
import { getOnboardingSettings } from './settings';

/** The shortlist's ranking and flight limits (docs/onboarding-v2/SPEC.md 4.8). The ranking is the app's own engine. */

/** The month the engine ranks for: the chosen one (0 to 11 here), or this month when no month was chosen. */
export const rankingMonth = (month: number | null): number => (month == null ? new Date().getMonth() + 1 : month + 1);

/** Every place the traveler may see (specialist places they have not unlocked are left out), best first. */
export function rankPlaces(destinations: ScoredDestination[], weights: Record<string, number>, month: number | null, bands: Record<string, string[]>): RankedDestination[] {
  return computeRankedDestinations(destinations, weights, rankingMonth(month), bands).filter((r) => isVisibleForWeights(r.d, weights));
}

export interface SetAside {
  d: ScoredDestination;
  why: string;
}

export interface PlaceCoords {
  lat: number;
  lon: number;
}

/**
 * Applies the flight-hour limit: a place that is further than the limit from the traveler's home is set aside, with the reason. A place
 * with no coordinates on file can't be judged, so it stays. No home or no limit sets nothing aside.
 */
export function applyFlightLimit(ranked: RankedDestination[], home: string | null, maxHours: number, coords: Record<string, PlaceCoords>): { kept: RankedDestination[]; aside: SetAside[] } {
  const from = airportByCode(home);
  if (!from || !maxHours) return { kept: ranked, aside: [] };
  const kept: RankedDestination[] = [];
  const aside: SetAside[] = [];
  for (const r of ranked) {
    const c = coords[r.d.id];
    if (!c) {
      kept.push(r);
      continue;
    }
    const hours = estimateFlightHours(milesBetween(from, c));
    if (hours > maxHours) aside.push({ d: r.d, why: `About ${hours} hours from ${from.code}, over your ${maxHours}-hour limit` });
    else kept.push(r);
  }
  return { kept, aside };
}

/** Ids of the first n places. */
export const topIds = (ranked: RankedDestination[], n = getOnboardingSettings().shortlistPlaces): string[] => ranked.slice(0, n).map((r) => r.d.id);

/** How many of the top places sit in a different position (or are different places) in the other list. */
export const changedPositions = (a: string[], b: string[]): number => a.filter((id, i) => id !== b[i]).length;
