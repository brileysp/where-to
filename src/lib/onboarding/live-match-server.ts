import { getMatchFits, getMatchSetups } from '@/lib/db/queries/match-data';
import { loadMatchSettings } from '@/lib/scoring/matchSettingsServer';
import { liveMatch, type LiveMatch } from './live-factors';
import { getPlaceCoords } from '@/lib/db/queries/onboarding-chips';
import { regionsForPlaces } from './regions';
import { resolveOrigin } from './origin';
import { tripAdjust } from './trip-adjust';
import { allRegions } from './regions';
import { estimateFlightHours, milesBetween } from './airports';
import type { TravelProfile } from './profile';
import { effectiveTrip, type Trip } from './trips';

/**
 * What a saved traveler's chips and answers do to every place, worked out on the server so the full results page ranks the same way the
 * onboarding shortlist did. Null when the profile has no chips or answers (nothing to apply), so travelers who never used the new flow see
 * no change at all.
 */
export async function liveMatchForProfile(profile: TravelProfile | null): Promise<LiveMatch | null> {
  if (!profile) return null;
  const hasPicks = Object.keys(profile.qa ?? {}).length > 0 || Object.values(profile.subs).some((v) => v.length > 0);
  if (!hasPicks) return null;
  const setups = await getMatchSetups();
  const interests = Object.keys(profile.levels).filter((k) => setups[k]);
  if (!interests.length) return null;
  const [fits, { settings }] = await Promise.all([getMatchFits(interests), loadMatchSettings()]);
  const m = liveMatch({ interests, setups, fits, ticked: profile.subs, qa: profile.qa ?? {}, settings });
  return Object.keys(m.factors).length || Object.keys(m.notes).length ? m : null;
}

export interface TripEffect {
  /** What each place keeps of its score for the trip length. */
  placeFactors: Record<string, number>;
  /** Places left out: in a continent turned off, or further than the longest flight. */
  hidden: string[];
}

/**
 * What the trip settings in a saved profile (trip length, continents, where you live, longest flight) do to every place, for the full results
 * page. When the traveler has saved trips, the active one supplies trip length, continents and longest flight (a trip can change that last one
 * for itself); otherwise the profile's own values are used. Null when none of them is set, so everyone else sees no change.
 */
export async function tripEffectForProfile(saved: TravelProfile | null, activeTrip?: Trip | null): Promise<TripEffect | null> {
  if (!saved) return null;
  const profile: TravelProfile = activeTrip
    ? { ...saved, length: activeTrip.length, continents: activeTrip.continents, maxHours: effectiveTrip(saved, activeTrip).maxHours }
    : saved;
  const origin = resolveOrigin({ airport: profile.home, country: profile.homeCountry, sub: profile.homeSub });
  const hasLength = !!profile.length && !!origin;
  const hasContinents = !allRegions(profile.continents ?? []);
  const hasLimit = !!profile.maxHours && !!origin;
  if (!hasLength && !hasContinents && !hasLimit) return null;
  const [coords, { settings }] = await Promise.all([getPlaceCoords(), loadMatchSettings()]);
  const regions = regionsForPlaces(coords);
  const adj = tripAdjust({ coords, regions, origin, length: profile.length, continents: profile.continents ?? [], settings });
  const hidden = new Set(adj.leftOut);
  if (hasLimit && origin) for (const [id, at] of Object.entries(coords)) if (estimateFlightHours(milesBetween(origin, at)) > profile.maxHours) hidden.add(id);
  return { placeFactors: adj.factors, hidden: [...hidden] };
}
