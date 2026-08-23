import { BAND_DIMENSIONS } from '../scoring/constants';
import type { DnaBands, DnaState, PreferenceProfile } from './types';

// Ported verbatim from interests.js (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/interests.js).

export interface InterestEmoji {
  key: string;
  emoji: string;
  label: string;
  categories: string[];
  attributes: string[];
  correlates: Array<{ key: string; weight: number }>;
}

export const INTEREST_EMOJIS: InterestEmoji[] = [
  { key: 'beach', emoji: '🏖️', label: 'Beach & Sun',
    categories: ['Beach'],
    attributes: ['beach'],
    correlates: [{ key: 'wellness', weight: 0.5 }] },
  { key: 'water', emoji: '🌊', label: 'Water & Ocean',
    categories: ['Ocean Swimming', 'Snorkeling & Diving', 'Surfing', 'Sailing & Yachting'],
    attributes: ['oceanSwimming', 'snorkeling', 'surfing'],
    correlates: [{ key: 'beach', weight: 0.5 }, { key: 'wildlife', weight: 0.4 }] },
  { key: 'wildlife', emoji: '🦁', label: 'Wildlife & Safari',
    categories: ['Wildlife', 'Birding', 'Remote Wilderness'],
    attributes: ['wildlife', 'birding', 'remoteWilderness'],
    correlates: [{ key: 'photography', weight: 0.5 }, { key: 'outdoors', weight: 0.4 }] },
  { key: 'outdoors', emoji: '🏔️', label: 'Outdoors & Adventure',
    categories: ['Hiking', 'Scenic Touring & Rentals', 'Adventure Sports', 'Rustic Adventure'],
    attributes: ['hiking', 'rusticAdventure', 'adrenaline'],
    correlates: [{ key: 'cycling', weight: 0.5 }, { key: 'photography', weight: 0.4 }] },
  { key: 'cycling', emoji: '🚴', label: 'Cycling',
    categories: ['Cycling'],
    attributes: ['cycling'],
    correlates: [{ key: 'outdoors', weight: 0.5 }, { key: 'wine', weight: 0.4 }] },
  { key: 'photography', emoji: '📸', label: 'Photography',
    categories: ['Photography'],
    attributes: ['photography', 'landscapePhotography'],
    correlates: [{ key: 'wildlife', weight: 0.5 }, { key: 'outdoors', weight: 0.4 }] },
  { key: 'wine', emoji: '🍷', label: 'Wine & Drink',
    categories: ['Wine & Spirits'],
    attributes: ['wine'],
    correlates: [{ key: 'culture', weight: 0.4 }, { key: 'nightlife', weight: 0.4 }, { key: 'cycling', weight: 0.3 }] },
  { key: 'culture', emoji: '🏛️', label: 'Culture & History',
    categories: ['Culture'],
    attributes: ['culture', 'authenticity'],
    correlates: [{ key: 'wine', weight: 0.4 }] },
  { key: 'wellness', emoji: '🧘', label: 'Spa & Wellness',
    categories: ['Wellness'],
    attributes: ['wellness', 'relaxation'],
    correlates: [{ key: 'beach', weight: 0.4 }, { key: 'golf', weight: 0.3 }] },
  { key: 'nightlife', emoji: '🍸', label: 'Nightlife',
    categories: ['Nightlife'],
    attributes: ['nightlife'],
    correlates: [{ key: 'wine', weight: 0.4 }] },
  { key: 'golf', emoji: '⛳', label: 'Golf',
    categories: ['Golf'],
    attributes: ['golf'],
    correlates: [{ key: 'beach', weight: 0.4 }, { key: 'cycling', weight: 0.3 }, { key: 'wellness', weight: 0.3 }] },
  { key: 'snow', emoji: '🎿', label: 'Snow Sports',
    categories: ['Snow Sports'],
    attributes: ['snowsports'],
    correlates: [{ key: 'outdoors', weight: 0.4 }, { key: 'wellness', weight: 0.3 }] },
];

export function interestByKey(key: string): InterestEmoji | undefined {
  return INTEREST_EMOJIS.find((e) => e.key === key);
}

export type CategoryInterestTier = 'unrestricted' | 'tier1' | 'unlocked' | 'correlated' | 'locked';

/**
 * How eligible a card category is to appear in the swipe deck, given what
 * the user picked in the interest picker. Deliberately NOT a hard
 * eligibility exclude (see isCardEligible) — this only informs selection
 * PROBABILITY in chooseNextCard, so a 'locked' category can still show up
 * occasionally, just rarely.
 */
export function categoryInterestTier(category: string, dnaState: DnaState | null | undefined): CategoryInterestTier {
  const picked = new Set(dnaState?.pickedInterests || []);
  if (!picked.size) return 'unrestricted';
  const covering = INTEREST_EMOJIS.filter((e) => e.categories.includes(category));
  if (!covering.length) return 'tier1';
  if (covering.some((e) => picked.has(e.key))) return 'unlocked';
  const correlated = covering.some((e) => (e.correlates || []).some((c) => picked.has(c.key)));
  return correlated ? 'correlated' : 'locked';
}

/**
 * Nudges a Travel DNA profile with a crude starting bias from interest
 * picks — DIRECT PICKS ONLY. Correlation never touches the profile or
 * sliders, only which cards get a better chance of being shown during
 * swiping.
 */
export function seedProfileFromInterests(profile: PreferenceProfile, pickedKeys: string[]): PreferenceProfile {
  const updated = { ...profile };
  const picked = new Set(pickedKeys || []);
  const PRIMARY_NUDGE = 8;

  picked.forEach((key) => {
    const def = interestByKey(key);
    if (!def) return;
    (def.attributes || []).forEach((attr) => {
      if (!(attr in updated)) return;
      updated[attr] = (updated[attr] || 0) + PRIMARY_NUDGE;
    });
  });

  return updated;
}

/**
 * What each "Open To" band option says about the traveler, expressed as
 * signed nudges to existing PreferenceProfile attributes (never new ones —
 * these ride the same SLIDER_ATTRIBUTE_MAP fan-out that swipes and interest
 * picks already use, e.g. 'luxury' already feeds luxuryLodging/spa/
 * finedining/sailing/golf). Options with no real opinion (e.g. 'comfortable',
 * 'moderate') are simply omitted — they contribute nothing.
 */
const BAND_ATTRIBUTE_CONTRIBUTIONS: Record<string, Record<string, Record<string, number>>> = {
  budget: {
    basic: { luxury: -1, lowSeasonDeals: 1 },
    highend: { luxury: 0.6 },
    luxury: { luxury: 1 },
  },
  weather: {
    cold: { snowsports: 1, beach: -1, oceanSwimming: -1, snorkeling: -1 },
    cool: { snowsports: 0.3, beach: -0.3, oceanSwimming: -0.3, snorkeling: -0.3 },
    warm: { beach: 0.3, oceanSwimming: 0.3, snorkeling: 0.3, snowsports: -0.3 },
    hot: { beach: 1, oceanSwimming: 1, snorkeling: 1, snowsports: -1 },
  },
  vibe: {
    secluded: { avoidingCrowds: 1, nightlife: -0.6 },
    easygoing: { avoidingCrowds: 0.3, nightlife: -0.2 },
    lively: { nightlife: 0.5 },
    highenergy: { nightlife: 1, avoidingCrowds: -0.3 },
  },
  physical: {
    easy: { physicalChallenge: -1, adrenaline: -0.5 },
    active: { physicalChallenge: 0.5, adrenaline: 0.3 },
    challenging: { physicalChallenge: 1, adrenaline: 0.7 },
  },
};

/**
 * Nudges a Travel DNA profile from the onboarding "Open To" band picks
 * (Budget & Comfort, Weather, Social Vibe, Physical Demand). Only picks
 * narrow enough to say something real move the profile — selecting every
 * option in a dimension already means "no preference" everywhere else in
 * the app (see bandPenalty), so it's treated as zero signal here too.
 * Specificity scales linearly: picking 1 of 4 options is a strong, full-
 * strength signal; 3 of 4 is barely a signal; 4 of 4 is none at all.
 * Contradictory picks within a dimension (e.g. both 'basic' and 'luxury')
 * average out toward zero rather than double up.
 */
export function seedProfileFromBands(profile: PreferenceProfile, bands: DnaBands): PreferenceProfile {
  const updated = { ...profile };
  const BAND_NUDGE_BASE = 8;

  BAND_DIMENSIONS.forEach((dim) => {
    const dimKey = dim.key as keyof DnaBands;
    const selected = bands?.[dimKey] || [];
    const totalOptions = dim.bands.length;
    if (!selected.length || selected.length >= totalOptions) return; // unset or "no preference"

    const contributionsForDim = BAND_ATTRIBUTE_CONTRIBUTIONS[dim.key];
    if (!contributionsForDim) return;

    const specificity = (totalOptions - selected.length) / (totalOptions - 1);
    const attrTotals: Record<string, number> = {};
    selected.forEach((optionKey) => {
      const contribution = contributionsForDim[optionKey];
      if (!contribution) return;
      Object.entries(contribution).forEach(([attr, weight]) => {
        attrTotals[attr] = (attrTotals[attr] || 0) + weight;
      });
    });

    Object.entries(attrTotals).forEach(([attr, total]) => {
      if (!(attr in updated)) return;
      const averageContribution = total / selected.length;
      updated[attr] = (updated[attr] || 0) + BAND_NUDGE_BASE * specificity * averageContribution;
    });
  });

  return updated;
}
