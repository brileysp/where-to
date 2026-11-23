import { getMatchFits, getMatchSetups } from '@/lib/db/queries/match-data';
import { loadMatchSettings } from '@/lib/scoring/matchSettingsServer';
import { liveMatch, type LiveMatch } from './live-factors';
import { getPlaceCoords, getPlaceSettingTags } from '@/lib/db/queries/onboarding-chips';
import { allPlaceTypes } from './place-types';
import { regionsForPlaces } from './regions';
import { resolveOrigin } from './origin';
import { tripAdjust } from './trip-adjust';
import { allRegions } from './regions';
import { estimateFlightHours, milesBetween } from './airports';
import type { TravelProfile } from './profile';
import type { CareState } from './care';
import { effectiveTrip, type Trip } from './trips';
import { peakGain } from './peak';
import { careMatch } from './care-match';
import { getTravelFacts } from '@/lib/db/queries/travel-needs';

/**
 * What a saved traveler's chips and answers do to every place, worked out on the server so the full results page ranks the same way the
 * onboarding shortlist did. Null when the profile has no chips or answers (nothing to apply), so travelers who never used the new flow see
 * no change at all.
 */
export async function liveMatchForProfile(profile: TravelProfile | null, activeTrip?: Trip | null): Promise<LiveMatch | null> {
  if (!profile) return null;
  const hasPicks = Object.keys(profile.qa ?? {}).length > 0 || Object.values(profile.subs).some((v) => v.length > 0);
  const care = careFor(profile, activeTrip);
  const hasCare = careHasPicks(care);
  if (!hasPicks && !hasCare) return null;
  let m: LiveMatch = { factors: {}, notes: {} };
  if (hasPicks) {
    const setups = await getMatchSetups();
    const interests = Object.keys(profile.levels).filter((k) => setups[k]);
    if (interests.length) {
      const [fits, { settings }] = await Promise.all([getMatchFits(interests), loadMatchSettings()]);
      m = liveMatch({ interests, setups, fits, ticked: profile.subs, qa: profile.qa ?? {}, month: activeTrip ? activeTrip.month : profile.month, settings });
    }
  }
  // What else matters (kids, food, language, mobility, how you travel): its reasons join the place sheet's notes; its score effect rides with the trip effect.
  if (hasCare) {
    const [facts, { settings }] = await Promise.all([getTravelFacts(), loadMatchSettings()]);
    for (const [placeId, n] of Object.entries(careMatch({ care, facts, settings }).notes)) m.notes[placeId] = { ...(m.notes[placeId] ?? {}), ...n };
  }
  return Object.keys(m.factors).length || Object.keys(m.notes).length ? m : null;
}

/** The care picks in force: the active trip's own choices where it has set any, otherwise the profile's. */
const careFor = (p: TravelProfile, trip?: Trip | null): CareState => (trip ? effectiveTrip(p, trip).care : p.care) ?? {};
const careHasPicks = (care: CareState): boolean => CARE_KEYS.some((k) => (care[k]?.o.length ?? 0) > 0);
const CARE_KEYS = ['kids', 'food', 'lang', 'access', 'how'];

export interface TripEffect {
  /** What each place keeps of its score for the trip length. */
  placeFactors: Record<string, number>;
  /** Places left out: in a continent turned off, or further than the longest flight. */
  hidden: string[];
  /** Crowds & prices: points a score moves per point of season difference (0 = neutral). */
  peakGain: number;
}

/**
 * What the trip settings in a saved profile (trip length, continents, where you live, peak or off peak) do to every place, for the full results
 * page. When the traveler has saved trips, the active one supplies trip length and continents, and its own peak or off peak step if it set one;
 * otherwise the profile's own values are used. Null for a traveler with no saved profile, so everyone else sees no change.
 */
export async function tripEffectForProfile(saved: TravelProfile | null, activeTrip?: Trip | null): Promise<TripEffect | null> {
  if (!saved) return null;
  const profile: TravelProfile = activeTrip
    ? { ...saved, length: activeTrip.length, continents: activeTrip.continents }
    : saved;
  const origin = resolveOrigin({ airport: profile.home, country: profile.homeCountry, sub: profile.homeSub });
  const hasLength = !!profile.length && !!origin;
  const hasContinents = !allRegions(profile.continents ?? []);
  const hasLimit = !!profile.maxHours && !!origin;
  const kinds = activeTrip ? effectiveTrip(saved, activeTrip).placeTypes : (saved.placeTypes ?? []);
  const hasKinds = !allPlaceTypes(kinds);
  const step = activeTrip ? effectiveTrip(saved, activeTrip).peak : saved.peak;
  const [coords, { settings }] = await Promise.all([getPlaceCoords(), loadMatchSettings()]);
  const gain = peakGain(step, settings);
  const careIn = careFor(saved, activeTrip);
  const hasCare = careHasPicks(careIn);
  if (!hasLength && !hasContinents && !hasKinds && !hasLimit && gain === 0 && !hasCare) return null;
  const regions = regionsForPlaces(coords);
  const adj = tripAdjust({ coords, regions, origin, length: profile.length, continents: profile.continents ?? [], settingTags: hasKinds ? await getPlaceSettingTags() : undefined, placeTypes: kinds, settings });
  const hidden = new Set(adj.leftOut);
  if (hasLimit && origin) for (const [id, at] of Object.entries(coords)) if (estimateFlightHours(milesBetween(origin, at)) > profile.maxHours) hidden.add(id);
  const placeFactors: Record<string, number> = { ...adj.factors };
  if (hasCare) {
    const care = careMatch({ care: careIn, facts: await getTravelFacts(), settings });
    for (const [id, f] of Object.entries(care.factors)) placeFactors[id] = (placeFactors[id] ?? 1) * f;
    for (const id of Object.keys(care.hidden)) hidden.add(id);
  }
  return { placeFactors, hidden: [...hidden], peakGain: gain };
}
