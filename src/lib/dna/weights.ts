import type { PreferenceProfile } from './types';

// Ported verbatim from traveldna.js:1818-1920 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

/**
 * Maps each destination slider (scoring/constants.ts SLIDERS, 53 total —
 * 50-interest/4-domain taxonomy plus deals/crowds/roadtrip) to the Travel
 * DNA attributes that predict it, with a weight for how strongly each
 * attribute should count. Some Travel DNA attributes (comfortFlexibility,
 * physicalChallenge's pure form, family) don't map cleanly onto a single
 * destination slider — they matter more to trip style than to which
 * destination scores well — intentionally left out of this table.
 *
 * Renamed/split-primary keys below carry forward their original
 * hand-tuned attribute weights unchanged (only the key name moved). New
 * and split-secondary keys are reasoned defaults — seeded from the
 * closest existing sibling/formula family, reusing the existing
 * PreferenceProfile attribute vocabulary (see profile.ts) rather than
 * blank — real tuning for these is a later pass, not this migration.
 */
export const SLIDER_ATTRIBUTE_MAP: Record<string, Array<[string, number]>> = {
  // Nature & Wildlife
  wildlifeViewing: [['wildlife', 1], ['photography', 0.3]],
  birding: [['birding', 0.7], ['rareEndemics', 0.4], ['pelagicBirding', 0.3], ['birdingFromHides', 0.2], ['listing', 0.2], ['casualBirding', -0.2]],
  safari: [['wildlife', 0.8], ['photography', 0.3], ['remoteWilderness', 0.2], ['luxury', 0.2]],
  whaleWatching: [['wildlife', 0.7], ['photography', 0.2], ['remoteWilderness', 0.2]],
  scenicLandscapes: [['remoteWilderness', 0.5], ['photography', 0.2], ['uniqueness', 0.2], ['landscapePhotography', 0.4], ['dramaticWeather', 0.3], ['mountains', 0.2]],
  landscapePhotography: [['landscapePhotography', 0.7], ['photography', 0.5], ['goldenHour', 0.3], ['dramaticWeather', 0.2], ['uniqueness', 0.2]],
  nationalParks: [['remoteWilderness', 0.5], ['hiking', 0.3], ['wildlife', 0.2], ['uniqueness', 0.2]],
  campingBackcountry: [['rusticAdventure', 0.6], ['remoteWilderness', 0.4], ['hiking', 0.3], ['physicalChallenge', 0.2]],
  stargazing: [['photography', 0.2], ['remoteWilderness', 0.3], ['uniqueness', 0.2], ['astrophotography', 0.5], ['lateNightTolerance', 0.3]],
  auroraChasing: [['auroraChasing', 0.7], ['astrophotography', 0.4], ['remoteWilderness', 0.3], ['lateNightTolerance', 0.3], ['uniqueness', 0.2]],
  geologyVolcanoes: [['remoteWilderness', 0.4], ['uniqueness', 0.4], ['hiking', 0.2], ['photography', 0.2]],
  wildflowerBlooms: [['photography', 0.4], ['uniqueness', 0.3], ['remoteWilderness', 0.2], ['hiking', 0.2]],
  // Sports & Recreation
  hiking: [['hiking', 1], ['physicalChallenge', 0.2], ['hikingForTheShot', 0.2]],
  mountaineering: [['physicalChallenge', 0.7], ['hiking', 0.4], ['adrenaline', 0.3], ['remoteWilderness', 0.2]],
  cyclingRoad: [['cycling', 0.6], ['hardClimbing', 0.25], ['scenicRoadCycling', 0.25], ['mountainBiking', 0.15], ['innToInn', 0.15], ['comfortAfterEffort', 0.1]],
  mountainBiking: [['mountainBiking', 0.7], ['adrenaline', 0.3], ['physicalChallenge', 0.3], ['rusticAdventure', 0.2]],
  skiingSnowboarding: [['snowsports', 0.6], ['physicalChallenge', 0.2], ['avoidingCrowds', 0.1], ['adrenaline', 0.2]],
  surfing: [['surfing', 0.6], ['oceanSwimming', 0.15], ['reefBreaks', 0.2], ['warmWater', 0.15], ['adrenaline', 0.1]],
  diving: [['snorkeling', 1]],
  sailing: [['sailing', 0.6], ['oceanSwimming', 0.15], ['luxury', 0.15], ['relaxation', 0.1]],
  kayakingRafting: [['adrenaline', 0.4], ['oceanSwimming', 0.2], ['rusticAdventure', 0.3], ['remoteWilderness', 0.2]],
  adventureSports: [['rusticAdventure', 0.3], ['physicalChallenge', 0.3], ['adrenaline', 0.35], ['mountainBiking', 0.15]],
  golf: [['golf', 0.6], ['relaxation', 0.3], ['luxury', 0.2], ['avoidingCrowds', 0.15]],
  fishing: [['fishing', 0.7], ['remoteWilderness', 0.1], ['relaxation', 0.1]],
  horsebackRiding: [['rusticAdventure', 0.4], ['relaxation', 0.2], ['remoteWilderness', 0.2]],
  trailRunning: [['hiking', 0.5], ['physicalChallenge', 0.5], ['adrenaline', 0.2]],
  // Culture & Discovery
  historyArchaeology: [['museums', 0.4], ['culture', 0.5], ['famousLandmarks', 0.3], ['authenticity', 0.3]],
  museumsArt: [['museums', 0.6], ['culture', 0.3], ['famousLandmarks', 0.2]],
  architecture: [['architecture', 0.6], ['culture', 0.2], ['famousLandmarks', 0.3], ['cities', 0.1]],
  cityExploration: [['cities', 0.7], ['culture', 0.3], ['authenticity', 0.2]],
  indigenousCultures: [['culture', 0.6], ['authenticity', 0.6], ['uniqueness', 0.2]],
  religiousSites: [['culture', 0.5], ['famousLandmarks', 0.4], ['authenticity', 0.2]],
  festivals: [['festivals', 0.6], ['culture', 0.3], ['authenticity', 0.2]],
  traditionalCrafts: [['culture', 0.5], ['authenticity', 0.5], ['shopping', 0.2]],
  streetFood: [['streetFood', 0.5], ['food', 0.4], ['authenticity', 0.3]],
  fineDining: [['fineDining', 0.5], ['food', 0.4], ['luxury', 0.3]],
  wineSpirits: [['wine', 1]],
  coffeeTea: [['food', 0.5], ['culture', 0.2], ['authenticity', 0.2]],
  // Relaxation & Leisure
  beachesSwimming: [['oceanSwimming', 1]],
  sunbathing: [['beach', 1], ['relaxation', 0.3]],
  luxuryHotels: [['luxury', 1], ['relaxation', 0.2]],
  allInclusive: [['relaxation', 0.7], ['luxury', 0.5], ['beach', 0.3], ['family', 0.2]],
  spaWellness: [['wellness', 1], ['luxury', 0.3], ['relaxation', 0.3]],
  hotSprings: [['wellness', 0.6], ['relaxation', 0.5], ['remoteWilderness', 0.2]],
  yogaRetreats: [['wellness', 0.8], ['relaxation', 0.5]],
  themeParks: [['family', 0.7], ['adrenaline', 0.2]],
  nightlife: [['nightlife', 1], ['cities', 0.2]],
  shopping: [['shopping', 1], ['cities', 0.2]],
  familyFun: [['family', 1]],
  spectatorSports: [['nightlife', 0.2], ['cities', 0.3], ['adrenaline', 0.2]],
  // Value — unchanged
  deals: [['lowSeasonDeals', 1]],
  crowds: [['avoidingCrowds', 1]],
  roadtrip: [['remoteWilderness', 0.25], ['authenticity', 0.15], ['adrenaline', 0.15], ['landscapePhotography', 0.3], ['deserts', 0.2], ['roadTrip', 0.2]],
};

/** The attribute each slider is most defined by — e.g. 'golf' for the golf slider — used to detect a direct rejection even when secondary shared attributes (relaxation, luxury, ...) stay positive from unrelated swipes. */
function dominantAttr(attrPairs: Array<[string, number]>): string {
  return attrPairs.reduce((best, pair) => (Math.abs(pair[1]) > Math.abs(best[1]) ? pair : best))[0];
}

/**
 * Converts a Travel DNA profile into a 0-10 weight per destination
 * slider. Uses min-max normalization across the sliders themselves (not
 * a fixed scale) so the result always spans a meaningful 0-10 range
 * regardless of swipe count. A floor of ~2 keeps low-signal (i.e.
 * untested) sliders from collapsing to a hard 0.
 *
 * A rejected slider skips that floor and goes straight to 0. A slider
 * counts as rejected if EITHER its full weighted sum is net-negative, OR
 * its single dominant attribute (the thing the slider is actually named
 * after) is net-negative on its own — the second check matters because a
 * slider's weighted sum blends in secondary attributes shared with other
 * sliders (e.g. golf also weighs 'relaxation' and 'luxury'), so a real
 * rejection of golf specifically could otherwise get masked/rescued by
 * unrelated positive swipes on beach or spa cards that happen to touch
 * those same shared attributes.
 */
export function convertTravelDNAToRecommendationWeights(profile: PreferenceProfile): Record<string, number> {
  const raw: Record<string, number> = {};
  const rejected: Record<string, boolean> = {};
  Object.entries(SLIDER_ATTRIBUTE_MAP).forEach(([sliderKey, attrPairs]) => {
    raw[sliderKey] = attrPairs.reduce((sum, [attr, w]) => sum + w * (profile[attr] || 0), 0);
    rejected[sliderKey] = (profile[dominantAttr(attrPairs)] || 0) < 0;
  });
  const nonNegativeValues = Object.entries(raw)
    .filter(([sliderKey, v]) => v >= 0 && !rejected[sliderKey])
    .map(([, v]) => v);
  const max = Math.max(...nonNegativeValues, 1);
  const min = Math.min(...nonNegativeValues, 0);
  const range = Math.max(max - min, 1);

  const weights: Record<string, number> = {};
  Object.entries(raw).forEach(([sliderKey, v]) => {
    if (v < 0 || rejected[sliderKey]) {
      weights[sliderKey] = 0;
      return;
    }
    const normalized = ((v - min) / range) * 8 + 2;
    weights[sliderKey] = Math.round(Math.max(0, Math.min(10, normalized)));
  });
  return weights;
}
