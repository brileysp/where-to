import type { Slider, Persona, BandDimension } from './types';

// Ported verbatim from data.js:26-119 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/data.js).
// Kept as code, not DB rows — see schema.ts's comment on why.

export const SLIDERS: Slider[] = [
  // Nature & Wildlife
  { key: 'birding', label: 'Birding', icon: '🦜', group: 'Nature & Wildlife', formula: 'birding' },
  { key: 'wildlife', label: 'Wildlife Photography', icon: '📸', group: 'Nature & Wildlife', formula: 'wildlife' },
  { key: 'hiking', label: 'Hiking', icon: '🥾', group: 'Nature & Wildlife', formula: 'hiking' },
  { key: 'scenic', label: 'Scenic Landscapes', icon: '🏞️', group: 'Nature & Wildlife', formula: 'hiking' },
  { key: 'stargazing', label: 'Stargazing', icon: '✨', group: 'Nature & Wildlife', formula: 'culture' },
  { key: 'fishing', label: 'Fishing', icon: '🎣', group: 'Nature & Wildlife', formula: 'hiking' },
  // Water & Relaxation
  { key: 'sunbathing', label: 'Sunbathing', icon: '☀️', group: 'Water & Relaxation', formula: 'sun' },
  { key: 'swimming', label: 'Ocean Swimming', icon: '🌊', group: 'Water & Relaxation', formula: 'swim' },
  { key: 'diving', label: 'Diving & Snorkeling', icon: '🤿', group: 'Water & Relaxation', formula: 'swim' },
  { key: 'surfing', label: 'Surfing', icon: '🏄', group: 'Water & Relaxation', formula: 'swim' },
  { key: 'sailing', label: 'Sailing & Boating', icon: '⛵', group: 'Water & Relaxation', formula: 'swim' },
  { key: 'spa', label: 'Spa & Wellness', icon: '💆', group: 'Water & Relaxation', formula: 'food' },
  // Deliberately non-seasonal (formula 'luxury' has no case in
  // deriveDestinationScores, so it falls through to `default: v = base`)
  // — how deep/good a destination's top-end lodging scene is doesn't
  // meaningfully change month to month, only the price of staying there
  // does (see costRange). Graded on its own merits per destination, never
  // curved against the single most extreme example (Bora Bora doesn't set
  // the ceiling everyone else is measured against).
  { key: 'luxuryLodging', label: 'Luxury Lodging', icon: '🏨', group: 'Water & Relaxation', formula: 'luxury' },
  // Culture & Food
  { key: 'museums', label: 'Museums & Historic Sites', icon: '🏛️', group: 'Culture & Food', formula: 'culture' },
  { key: 'architecture', label: 'Architecture', icon: '🏰', group: 'Culture & Food', formula: 'culture' },
  { key: 'festivals', label: 'Festivals & Traditions', icon: '🎉', group: 'Culture & Food', formula: 'culture' },
  { key: 'finedining', label: 'Fine Dining', icon: '🍽️', group: 'Culture & Food', formula: 'food' },
  { key: 'streetfood', label: 'Street Food', icon: '🌮', group: 'Culture & Food', formula: 'food' },
  { key: 'nightlife', label: 'Nightlife', icon: '🍸', group: 'Culture & Food', formula: 'food' },
  { key: 'winetasting', label: 'Wine Tasting', icon: '🍷', group: 'Culture & Food', formula: 'food' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️', group: 'Culture & Food', formula: 'shopping' },
  // Active & Adventure
  { key: 'cycling', label: 'Cycling', icon: '🚴', group: 'Active & Adventure', formula: 'hiking' },
  { key: 'snowsports', label: 'Snow Sports', icon: '🎿', group: 'Active & Adventure', formula: 'snow' },
  { key: 'adventure', label: 'Adventure Sports', icon: '🪂', group: 'Active & Adventure', formula: 'hiking' },
  { key: 'roadtrip', label: 'Road-Tripping', icon: '🚗', group: 'Active & Adventure', formula: 'hiking' },
  { key: 'golf', label: 'Golf', icon: '⛳', group: 'Active & Adventure', formula: 'hiking' },
  // Value
  { key: 'deals', label: 'Low-Season Deals', icon: '💸', group: 'Value', formula: 'deals' },
  { key: 'crowds', label: 'Avoiding Crowds', icon: '🧘', group: 'Value', formula: 'crowds' },
];

export const SLIDER_GROUPS = [
  'Nature & Wildlife',
  'Water & Relaxation',
  'Culture & Food',
  'Active & Adventure',
  'Value',
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const NEUTRAL_WEIGHT = 2;
function buildWeights(primary: Record<string, number>): Record<string, number> {
  const w: Record<string, number> = {};
  SLIDERS.forEach((s) => (w[s.key] = NEUTRAL_WEIGHT));
  Object.assign(w, primary);
  return w;
}

/**
 * Every slider weighted equally — used to score a month's general timing
 * quality independent of any one user's picks, so "is April good in Japan"
 * and "is April a good match for you" can be answered separately. See
 * DestinationCard's timing/match split header.
 */
export const NEUTRAL_WEIGHTS: Record<string, number> = buildWeights({});

export const PERSONAS: Persona[] = [
  {
    id: 'naturalist', name: 'The Naturalist', icon: '🦜',
    blurb: 'Wildlife, birds, and wild places — timing matters more than anything else.',
    primary: ['birding', 'wildlife', 'hiking', 'scenic', 'stargazing', 'fishing', 'diving', 'crowds'],
    weights: buildWeights({ birding: 9, wildlife: 9, hiking: 6, scenic: 6, stargazing: 5, fishing: 4, diving: 4, crowds: 7, deals: 5 }),
  },
  {
    id: 'sunwater', name: 'Sun & Water', icon: '🏖️',
    blurb: 'Beaches, warm water, and slowing down.',
    primary: ['sunbathing', 'swimming', 'diving', 'surfing', 'sailing', 'spa', 'deals', 'crowds'],
    weights: buildWeights({ sunbathing: 9, swimming: 9, diving: 6, surfing: 6, sailing: 5, spa: 6, deals: 5, crowds: 4 }),
  },
  {
    id: 'connoisseur', name: 'The Connoisseur', icon: '🍽️',
    blurb: 'Museums, markets, and meals worth planning a trip around.',
    primary: ['museums', 'finedining', 'streetfood', 'architecture', 'festivals', 'nightlife', 'shopping', 'winetasting'],
    weights: buildWeights({ museums: 8, finedining: 9, streetfood: 7, architecture: 7, festivals: 6, nightlife: 7, shopping: 6, winetasting: 5 }),
  },
  {
    id: 'active', name: 'Active & Outdoors', icon: '🚵',
    blurb: 'Trails, adrenaline, and a reason to be outside all day.',
    primary: ['hiking', 'cycling', 'adventure', 'snowsports', 'roadtrip', 'scenic', 'fishing', 'crowds'],
    weights: buildWeights({ hiking: 9, cycling: 7, adventure: 8, snowsports: 5, roadtrip: 6, scenic: 7, fishing: 4, crowds: 5 }),
  },
];

/** No band constraint applied — every band selected means no penalty. */
export function allBandsSelected(): Record<string, string[]> {
  const sel: Record<string, string[]> = {};
  BAND_DIMENSIONS.forEach((dim) => (sel[dim.key] = dim.bands.map((b) => b.key)));
  return sel;
}

export const BAND_DIMENSIONS: BandDimension[] = [
  { key: 'budget', label: 'Budget & Comfort', icon: '💳', bands: [
    { key: 'basic', label: 'Basic / Budget' }, { key: 'comfortable', label: 'Comfortable' },
    { key: 'highend', label: 'High-End' }, { key: 'luxury', label: 'Luxury' }] },
  { key: 'weather', label: 'Weather', icon: '🌡️', bands: [
    { key: 'cold', label: 'Cold' }, { key: 'cool', label: 'Cool' },
    { key: 'warm', label: 'Warm' }, { key: 'hot', label: 'Hot' }] },
  { key: 'vibe', label: 'Social Vibe', icon: '🎭', bands: [
    { key: 'secluded', label: 'Secluded & Quiet' }, { key: 'easygoing', label: 'Easygoing & Low-Key' },
    { key: 'lively', label: 'Lively & Social' }, { key: 'highenergy', label: 'High-Energy & Nightlife' }] },
  { key: 'physical', label: 'Physical Demand', icon: '💪', bands: [
    { key: 'easy', label: 'Easy for Anyone' }, { key: 'moderate', label: 'Moderate' },
    { key: 'active', label: 'Active' }, { key: 'challenging', label: 'Challenging' }] },
];
