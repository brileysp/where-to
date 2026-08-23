import type { PreferenceProfile } from './types';

// Ported verbatim from traveldna.js:1818-1920 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

/**
 * Maps each destination slider (data.js SLIDERS, 27 total) to the Travel
 * DNA attributes that predict it, with a weight for how strongly each
 * attribute should count. Some Travel DNA attributes (comfortFlexibility,
 * physicalChallenge's pure form, family) don't map cleanly onto a single
 * destination slider — they matter more to trip style than to which
 * destination scores well — intentionally left out of this table.
 */
export const SLIDER_ATTRIBUTE_MAP: Record<string, Array<[string, number]>> = {
  birding: [['birding', 0.7], ['rareEndemics', 0.4], ['pelagicBirding', 0.3], ['birdingFromHides', 0.2], ['listing', 0.2], ['casualBirding', -0.2]],
  wildlife: [['wildlife', 1], ['photography', 0.3]],
  hiking: [['hiking', 1], ['physicalChallenge', 0.2], ['hikingForTheShot', 0.2]],
  scenic: [['remoteWilderness', 0.5], ['photography', 0.2], ['uniqueness', 0.2], ['landscapePhotography', 0.4], ['dramaticWeather', 0.3], ['mountains', 0.2]],
  stargazing: [['photography', 0.2], ['remoteWilderness', 0.3], ['uniqueness', 0.2], ['astrophotography', 0.5], ['lateNightTolerance', 0.3]],
  fishing: [['fishing', 0.7], ['remoteWilderness', 0.1], ['relaxation', 0.1]],
  sunbathing: [['beach', 1], ['relaxation', 0.3]],
  swimming: [['oceanSwimming', 1]],
  diving: [['snorkeling', 1]],
  surfing: [['surfing', 0.6], ['oceanSwimming', 0.15], ['reefBreaks', 0.2], ['warmWater', 0.15], ['adrenaline', 0.1]],
  sailing: [['sailing', 0.6], ['oceanSwimming', 0.15], ['luxury', 0.15], ['relaxation', 0.1]],
  spa: [['wellness', 1], ['luxury', 0.3], ['relaxation', 0.3]],
  museums: [['museums', 0.6], ['culture', 0.3], ['famousLandmarks', 0.2]],
  architecture: [['architecture', 0.6], ['culture', 0.2], ['famousLandmarks', 0.3], ['cities', 0.1]],
  festivals: [['festivals', 0.6], ['culture', 0.3], ['authenticity', 0.2]],
  finedining: [['fineDining', 0.5], ['food', 0.4], ['luxury', 0.3]],
  streetfood: [['streetFood', 0.5], ['food', 0.4], ['authenticity', 0.3]],
  nightlife: [['nightlife', 1], ['cities', 0.2]],
  winetasting: [['wine', 1]],
  shopping: [['shopping', 1], ['cities', 0.2]],
  cycling: [['cycling', 0.6], ['hardClimbing', 0.25], ['scenicRoadCycling', 0.25], ['mountainBiking', 0.15], ['innToInn', 0.15], ['comfortAfterEffort', 0.1]],
  snowsports: [['snowsports', 0.6], ['physicalChallenge', 0.2], ['avoidingCrowds', 0.1], ['adrenaline', 0.2]],
  adventure: [['rusticAdventure', 0.3], ['physicalChallenge', 0.3], ['adrenaline', 0.35], ['mountainBiking', 0.15]],
  roadtrip: [['remoteWilderness', 0.25], ['authenticity', 0.15], ['adrenaline', 0.15], ['landscapePhotography', 0.3], ['deserts', 0.2], ['roadTrip', 0.2]],
  golf: [['golf', 0.6], ['relaxation', 0.3], ['luxury', 0.2], ['avoidingCrowds', 0.15]],
  deals: [['lowSeasonDeals', 1]],
  crowds: [['avoidingCrowds', 1]],
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
