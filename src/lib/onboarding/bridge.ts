import { NEUTRAL_WEIGHT, SLIDERS } from '@/lib/scoring/constants';
import { createEmptyPreferenceProfile, applySwipeToProfile } from '@/lib/dna/profile';
import { seedProfileFromBands, seedProfileFromCompanions, seedProfileFromInterests, interestByKey as dnaInterestByKey } from '@/lib/dna/interests';
import { convertTravelDNAToRecommendationWeights } from '@/lib/dna/weights';
import { createInitialDNAState } from '@/lib/dna/state';
import type { DimensionDef, DnaBands, DnaCard, DnaState, PreferenceProfile, SwipeType } from '@/lib/dna/types';
import { weightOf, type Levels } from './levels';
import { applyVibe, VIBES } from './vibes';
import type { Bands } from './care';

/**
 * Joins the new flow to the app's existing Travel DNA engine (docs/onboarding-v2/SPEC.md 10, items 2 and 4): the same profile seeds, the
 * same swipe maths and the same profile-to-weights conversion the app already uses. The only new piece is the translation of the 48
 * interests into the older, coarser interest list the engine's seeds understand.
 */

/** Which of the engine's twelve older interest picks each of the 48 interests counts toward. An interest with no entry adds no seed. */
export const INTEREST_TO_DNA_PICK: Record<string, string> = {
  beachesSwimming: 'beach', sunbathing: 'beach',
  surfing: 'water', diving: 'water', sailing: 'water', windSports: 'water', kayakingRafting: 'water',
  wildlifeViewing: 'wildlife', birding: 'wildlife', safari: 'wildlife', whaleWatching: 'wildlife',
  hiking: 'outdoors', campingBackcountry: 'outdoors', mountaineering: 'outdoors', trailRunning: 'outdoors', adventureSports: 'outdoors', horsebackRiding: 'outdoors', scenicLandscapes: 'outdoors',
  cyclingRoad: 'cycling', mountainBiking: 'cycling',
  landscapePhotography: 'photography',
  wineSpirits: 'wine',
  historyArchaeology: 'culture', museumsArt: 'culture', architecture: 'culture', cityExploration: 'culture', indigenousCultures: 'culture', religiousSites: 'culture', traditionalCrafts: 'culture', festivals: 'culture',
  spaWellness: 'wellness', hotSprings: 'wellness', yogaRetreats: 'wellness',
  nightlife: 'nightlife',
  golf: 'golf',
  skiingSnowboarding: 'snow',
};

/** The engine's own interest picks for these levels, each once. */
export function dnaPicksFor(levels: Levels): string[] {
  return [...new Set(Object.keys(levels).map((k) => INTEREST_TO_DNA_PICK[k]).filter((k): k is string => !!k && !!dnaInterestByKey(k)))];
}

export interface Answer {
  card: DnaCard;
  type: SwipeType;
}

export interface ProfileInput {
  levels: Levels;
  who: string[];
  bands: Bands;
  vibes: string[];
  /** Sharpen-question answers and taste-card swipes, in the order given. */
  answers: Answer[];
}

/** The traveler's preference profile: seeds from interests, companions and bands, then photo picks, then every answer. */
export function buildProfile(input: ProfileInput): PreferenceProfile {
  let p = createEmptyPreferenceProfile();
  p = seedProfileFromInterests(p, dnaPicksFor(input.levels));
  p = seedProfileFromCompanions(p, input.who);
  p = seedProfileFromBands(p, input.bands as unknown as DnaBands);
  for (const key of input.vibes) {
    const v = VIBES.find((x) => x.key === key);
    if (v) p = applyVibe(p, v);
  }
  for (const a of input.answers) p = applySwipeToProfile(p, a.card, a.type);
  return p;
}

/** The 0 to 10 weight for every interest, given an already-built profile: picked interests use their level's weight, the rest come from the profile. */
export function weightsFromProfile(profile: PreferenceProfile, levels: Levels): Record<string, number> {
  const derived = convertTravelDNAToRecommendationWeights(profile);
  const out: Record<string, number> = {};
  for (const s of SLIDERS) out[s.key] = derived[s.key] ?? NEUTRAL_WEIGHT;
  for (const [k, level] of Object.entries(levels)) out[k] = weightOf(level);
  return out;
}

/** Same, from the traveler's choices (a person with no picks is ranked entirely from the profile). */
export function weightsFor(input: ProfileInput): Record<string, number> {
  return weightsFromProfile(buildProfile(input), input.levels);
}

/** A Travel DNA state for the engine's card chooser and calibration, built from this flow's choices. */
export function dnaStateFor(input: ProfileInput, dimensions: DimensionDef[]): DnaState {
  const base = createInitialDNAState(dimensions);
  const swipes = input.answers.map((a, i) => ({ cardId: a.card.id, type: a.type, timestamp: i }));
  return {
    ...base,
    basicsCompleted: true,
    tutorialShown: true,
    companions: input.who,
    pickedInterests: dnaPicksFor(input.levels),
    bands: input.bands as unknown as DnaBands,
    profile: buildProfile(input),
    swipes,
    answeredCardIds: input.answers.map((a) => a.card.id),
    swipeCount: input.answers.length,
  };
}
