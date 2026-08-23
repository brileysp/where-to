import type { DnaState, PreferenceProfile } from './types';

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
