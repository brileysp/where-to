import type { DnaCard, PreferenceProfile, SwipeType } from './types';

// Ported verbatim from traveldna.js:18-161 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

export const PREFERENCE_ATTRIBUTES = [
  'wildlife', 'birding', 'photography', 'beach', 'oceanSwimming', 'snorkeling',
  'hiking', 'cycling', 'food', 'wine', 'culture', 'cities', 'remoteWilderness',
  'luxury', 'rusticAdventure', 'wellness', 'shopping', 'nightlife', 'family',
  'lowSeasonDeals', 'avoidingCrowds', 'comfortFlexibility', 'uniqueness',
  'physicalChallenge', 'relaxation', 'authenticity', 'famousLandmarks',
  'adrenaline',
  'golf', 'snowsports',
  'fishing',
  'sailing',
  'museums', 'architecture', 'festivals', 'fineDining', 'streetFood',
  'listing', 'viewQualityTolerance', 'comfortAfterEffort', 'innToInn',

  'surfing', 'landscapePhotography',

  // Birding subdimensions
  'rareEndemics', 'speciesCount', 'guidedBirding', 'independentBirding',
  'birdingFromHides', 'pelagicBirding', 'owling', 'migrationSpectacle',
  'rainforestBirding', 'wetlandsBirding', 'difficultTargetChasing', 'casualBirding',
  'comfortSacrifice', 'earlyMorningTolerance', 'patience', 'weatherTolerance',
  'intensity', 'specialistGuiding', 'casualTravel', 'rarity',

  // Surfing subdimensions
  'beginnerFriendly', 'reefBreaks', 'warmWater', 'uncrowded', 'surfCamp',
  'luxurySurf', 'longboarding', 'consistentSwell', 'surfPlusCulture',
  'surfPlusNightlife', 'surfPlusWellness', 'remoteSurf', 'travelForConditions',
  'basicLodgingTolerance', 'familyFriendlySurf', 'surfAsMainPurpose',
  'surfAsSideActivity', 'conditionsMatter', 'seriousSurfIntensity',
  'socialTravel', 'solitude', 'surfIntensity',

  // Cycling subdimensions
  'scenicRoadCycling', 'hardClimbing', 'fastDescents', 'gravelRiding',
  'mountainBiking', 'eBikeFriendly', 'bikeTouring', 'cafeToCafe',
  'luxuryInnToInn', 'performanceFocus', 'casualCycling', 'lowTrafficRoads',
  'famousRoutes', 'remoteLandscapes', 'supportVehiclePreference',
  'cyclingAsMainPurpose', 'cyclingAsSideActivity', 'longDayTolerance',
  'nightComfort', 'scenery', 'comfort', 'socialPace', 'riskTolerance',
  'planningComplexity',

  // Cycling core-axis branch specialty subdimensions (mountain biking)
  'xcEndurance', 'enduroRiding', 'bikeParkDownhill', 'mtbBikepacking',
  'epicAllMountainDay', 'technicalSkillsCoaching',
  // Cycling core-axis branch specialty subdimensions (gravel)
  'gravelRacing', 'gravelBikepacking', 'remoteGravelExploration', 'casualGravelWandering',

  // Landscape Photography subdimensions
  'goldenHour', 'iconicLandscapes', 'obscureLandscapes', 'mountains', 'deserts',
  'coastlines', 'forests', 'waterfalls', 'astrophotography', 'dramaticWeather',
  'gearHeavy', 'photoAsMainPurpose', 'photoAsSideActivity', 'hikingForTheShot',
  'roadTrip', 'droneFriendly', 'lateNightTolerance', 'crowds',

  // Landscape Photography core-axis branch specialty subdimensions (Night Sky)
  'milkyWayChasing', 'auroraChasing', 'starTrails', 'moonlitLandscapes',
];

export function createEmptyPreferenceProfile(): PreferenceProfile {
  const profile: PreferenceProfile = {};
  PREFERENCE_ATTRIBUTES.forEach((attr) => (profile[attr] = 0));
  return profile;
}

export const TRAVEL_COMPANIONS = [
  { key: 'solo', label: 'Solo' },
  { key: 'friends', label: 'With friends' },
  { key: 'partner', label: 'With a spouse or partner' },
  { key: 'kids', label: 'With my kids' },
];

export const SWIPE_WEIGHTS: Record<SwipeType, number> = { no: -1, yes: 1, love: 2.5 };

/**
 * Apply one swipe's preferenceSignals onto a profile and return a NEW
 * profile. Negative signals are never amplified by the Love multiplier —
 * loving a rustic experience (luxury: -1) mostly tells us the user is fine
 * trading luxury away for the payoff, not that they're newly averse to
 * luxury in general — so negative signals apply at normal (1x) strength
 * regardless of swipe magnitude, while positive signals get the full
 * weight including the 2.5x Love amplification.
 */
export function applySwipeToProfile(
  profile: PreferenceProfile,
  card: DnaCard,
  swipeType: SwipeType,
): PreferenceProfile {
  const weight = SWIPE_WEIGHTS[swipeType];
  if (weight === undefined) return { ...profile };
  const updated = { ...profile };
  Object.entries(card.preferenceSignals || {}).forEach(([attr, signal]) => {
    if (!(attr in updated)) updated[attr] = 0;
    let delta: number;
    if (swipeType === 'love' && signal < 0) {
      delta = signal * 1;
    } else {
      delta = signal * weight;
    }
    updated[attr] += delta;
  });
  return updated;
}
