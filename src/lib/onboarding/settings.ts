/**
 * Every number and list that decides how the new onboarding flow behaves, in one place (docs/onboarding-v2/SPEC.md, section 13).
 * Screens and logic read from here and never hard-code these. A future master admin screen will save overrides in the
 * database and this file will read them first; until then the defaults below are the whole story.
 */

export type InterestLevelId = 'off' | 'cur' | 'like' | 'love' | 'top';

export interface OnboardingSettings {
  /** 0 to 10 interest weight each level is saved as. */
  levelWeights: Record<InterestLevelId, number>;
  /** An interest at or above this weight opens specialist places (see src/lib/scoring/gating.ts, which owns the rule). */
  specialistUnlockWeight: number;
  /** Most interests a person can mark Top. */
  maxTopInterests: number;
  /** Sharpen questions that must be answered before the shortlist unlocks. */
  unlockQuestions: number;
  /**
   * How many interest questions each top interest is asked, by how many top interests there are (index 0 = one interest ... index 4 = five).
   * The first interests get the larger share. A share is cut down to the questions that apply (see question-rules.ts).
   */
  questionShares: number[][];
  /** Interests shown in a category before "Show more". */
  interestsPerCategory: number;
  /** "People who pick these often add" suggestions shown. */
  relatedSuggestions: number;
  /** Places on the shortlist before "See all". */
  shortlistPlaces: number;
  /** Airport matches shown while typing, and the letters needed before any show. */
  airportMatches: number;
  airportMinLetters: number;
  /** The interests shown first in each category, in order (docs/onboarding-v2/SPEC.md 8.2). The rest follow by audience tier. */
  primaryInterests: Record<string, string[]>;
  /** The choices for "Longest flight I would take" in hours; 0 means no limit. */
  flightHourLimits: number[];
  /** Share of the progress bar the first screen shows, since the person's path is not known yet. */
  doorProgressPercent: number;
}

export const DEFAULT_ONBOARDING_SETTINGS: OnboardingSettings = {
  levelWeights: { off: 0, cur: 3, like: 5, love: 7, top: 9.5 },
  specialistUnlockWeight: 7,
  maxTopInterests: 5,
  unlockQuestions: 10,
  questionShares: [[10], [4, 4], [3, 3, 3], [3, 3, 2, 2], [2, 2, 2, 2, 2]],
  interestsPerCategory: 8,
  relatedSuggestions: 4,
  shortlistPlaces: 5,
  airportMatches: 6,
  airportMinLetters: 2,
  primaryInterests: {
    'Nature & Wildlife': ['scenicLandscapes', 'wildlifeViewing', 'safari', 'whaleWatching', 'campingBackcountry', 'stargazing', 'birding', 'landscapePhotography'],
    'Sports & Recreation': ['hiking', 'skiingSnowboarding', 'cyclingRoad', 'surfing', 'diving', 'golf', 'fishing', 'sailing'],
    'Culture & Discovery': ['historyArchaeology', 'architecture', 'cityExploration', 'streetFood', 'museumsArt', 'fineDining', 'festivals', 'wineSpirits'],
    'Relaxation & Leisure': ['beachesSwimming', 'sunbathing', 'luxuryHotels', 'nightlife', 'shopping', 'spaWellness', 'hotSprings', 'yogaRetreats'],
  },
  flightHourLimits: [0, 4, 8, 12],
  doorProgressPercent: 25,
};

/** The one way to read the settings. Overrides from the database will be merged in here later. */
export function getOnboardingSettings(): OnboardingSettings {
  return DEFAULT_ONBOARDING_SETTINGS;
}
