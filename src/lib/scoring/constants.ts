import type { Slider, Persona, BandDimension } from './types';

// Ported verbatim from data.js:26-119 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/data.js).
// Kept as code, not DB rows — see schema.ts's comment on why.

// 50-interest / 4-domain taxonomy, migrated from the original 27-slider /
// 5-group system per the "Interest Taxonomy Migration Plan" (see plan file
// history). Renamed/split-primary sliders keep their old `formula` so
// existing destination data (base scores, month-flags, sliderCaps,
// sliderEvents, signatureTier) carries over untouched; brand-new and
// split-secondary keys get a reasoned-default formula from the closest
// existing family — real scoring tuning for those is Phase 2/3, not this
// migration. `deals`/`crowds`/`roadtrip` are practical/logistical trip
// constraints, not domain interests — they don't appear in the new
// 4-domain list at all and are carried over completely unchanged (key,
// formula, icon); only their `group` moves to 'Value' since their old
// group ('Active & Adventure') no longer exists in this shape. Their
// eventual replacement (crowd-tolerance tiers, travel modes, budget/climate
// bands) is separate, later onboarding-flow work.
export const SLIDERS: Slider[] = [
  // Nature & Wildlife
  { key: 'wildlifeViewing', label: 'Wildlife Viewing', icon: '🦁', group: 'Nature & Wildlife', formula: 'wildlife', audienceTier: 'popular' },
  { key: 'birding', label: 'Birding', icon: '🦜', group: 'Nature & Wildlife', formula: 'birding', audienceTier: 'specialist' },
  { key: 'safari', label: 'Safari', icon: '🐘', group: 'Nature & Wildlife', formula: 'wildlife', audienceTier: 'enthusiast' },
  { key: 'whaleWatching', label: 'Whale Watching', icon: '🐋', group: 'Nature & Wildlife', formula: 'wildlife', audienceTier: 'enthusiast' },
  { key: 'scenicLandscapes', label: 'Scenic Landscapes', icon: '🏞️', group: 'Nature & Wildlife', formula: 'hiking', audienceTier: 'iconic' },
  { key: 'landscapePhotography', label: 'Landscape Photography', icon: '📸', group: 'Nature & Wildlife', formula: 'hiking', audienceTier: 'specialist' },
  { key: 'nationalParks', label: 'National Parks', icon: '🌲', group: 'Nature & Wildlife', formula: 'hiking', audienceTier: 'iconic' },
  { key: 'campingBackcountry', label: 'Camping & Backcountry', icon: '🏕️', group: 'Nature & Wildlife', formula: 'hiking', audienceTier: 'enthusiast' },
  { key: 'stargazing', label: 'Stargazing', icon: '✨', group: 'Nature & Wildlife', formula: 'culture', audienceTier: 'enthusiast' },
  // Enthusiast, not specialist. Tromso and Icelandic winter tourism are
  // built on the aurora; it has outgrown the 0.15 bucket it shared with
  // birding and trail running.
  { key: 'auroraChasing', label: 'Northern Lights / Aurora', icon: '🌌', group: 'Nature & Wildlife', formula: 'culture', audienceTier: 'enthusiast' },
  { key: 'geologyVolcanoes', label: 'Geology & Volcanoes', icon: '🌋', group: 'Nature & Wildlife', formula: 'hiking', audienceTier: 'enthusiast' },
  { key: 'wildflowerBlooms', label: 'Wildflowers & Seasonal Blooms', icon: '🌸', group: 'Nature & Wildlife', formula: 'wildlife', audienceTier: 'specialist' },
  // Sports & Recreation
  { key: 'hiking', label: 'Hiking & Trekking', icon: '🥾', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'popular' },
  { key: 'mountaineering', label: 'Mountaineering & Rock Climbing', icon: '🧗', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'specialist' },
  { key: 'cyclingRoad', label: 'Cycling - Road & Gravel Biking', icon: '🚴', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'enthusiast' },
  { key: 'mountainBiking', label: 'Mountain Biking', icon: '🚵', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'enthusiast' },
  // Popular, not enthusiast. There is a global industry of destination
  // resorts — Chamonix, Aspen, Niseko, Whistler. Seasonal is not niche, and
  // at 0.4 it was tied with golf and fishing.
  { key: 'skiingSnowboarding', label: 'Skiing & Snowboarding', icon: '⛷️', group: 'Sports & Recreation', formula: 'snow', audienceTier: 'popular' },
  { key: 'surfing', label: 'Surfing', icon: '🏄', group: 'Sports & Recreation', formula: 'swim', audienceTier: 'enthusiast' },
  { key: 'diving', label: 'Diving, Snorkeling & Freediving', icon: '🤿', group: 'Sports & Recreation', formula: 'swim', audienceTier: 'enthusiast' },
  // Deliberately separate from 'surfing' — wind-driven (a good wind day,
  // not a good swell day) rather than wave-driven, and drew on a distinct
  // set of destinations when surfing's own base scores/events were
  // reviewed (Aruba's was corrected for exactly this — see
  // fix-surfing-windsurfing-conflation.ts). Unauthored for now: no base
  // scores or content yet, same starting state every other interest had
  // before its authoring pass.
  { key: 'windSports', label: 'Windsurfing & Kitesurfing', icon: '🪁', group: 'Sports & Recreation', formula: 'swim', audienceTier: 'enthusiast' },
  { key: 'sailing', label: 'Sailing & Boating', icon: '⛵', group: 'Sports & Recreation', formula: 'swim', audienceTier: 'specialist' },
  { key: 'kayakingRafting', label: 'Kayaking & Rafting', icon: '🛶', group: 'Sports & Recreation', formula: 'swim', audienceTier: 'enthusiast' },
  { key: 'adventureSports', label: 'Adventure Sports', icon: '🪂', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'enthusiast' },
  { key: 'golf', label: 'Golf', icon: '⛳', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'enthusiast' },
  { key: 'fishing', label: 'Fishing', icon: '🎣', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'enthusiast' },
  { key: 'horsebackRiding', label: 'Horseback Riding', icon: '🐴', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'specialist' },
  { key: 'trailRunning', label: 'Trail Running', icon: '🏃', group: 'Sports & Recreation', formula: 'hiking', audienceTier: 'specialist' },
  // Culture & Discovery
  { key: 'historyArchaeology', label: 'History & Archaeology', icon: '🏺', group: 'Culture & Discovery', formula: 'culture', audienceTier: 'iconic' },
  { key: 'museumsArt', label: 'Museums & Art', icon: '🖼️', group: 'Culture & Discovery', formula: 'culture', audienceTier: 'popular' },
  // Iconic, not popular. Architecture sat one tier below historyArchaeology
  // and cityExploration, which capped every destination whose single
  // largest draw is its built environment — Prague ranked 99th and Vienna
  // 101st on the default list, and Venice, whose top draw is a 10 for
  // architecture, could not clear a temple plain scored on history. Against
  // the tier's own test ("how many people decide where to travel based, at
  // least partly, on this?") Barcelona, Rome, Venice and Chicago answer it.
  { key: 'architecture', label: 'Architecture', icon: '🏛️', group: 'Culture & Discovery', formula: 'culture', audienceTier: 'iconic' },
  { key: 'cityExploration', label: 'Local Culture & City Exploration', icon: '🚶', group: 'Culture & Discovery', formula: 'culture', audienceTier: 'iconic' },
  { key: 'indigenousCultures', label: 'Indigenous Cultures', icon: '🪶', group: 'Culture & Discovery', formula: 'culture', audienceTier: 'specialist' },
  { key: 'religiousSites', label: 'Religious & Spiritual Sites', icon: '🕌', group: 'Culture & Discovery', formula: 'culture', audienceTier: 'popular' },
  { key: 'festivals', label: 'Festivals & Live Events', icon: '🎉', group: 'Culture & Discovery', formula: 'culture', audienceTier: 'enthusiast' },
  { key: 'traditionalCrafts', label: 'Traditional Arts & Crafts', icon: '🧵', group: 'Culture & Discovery', formula: 'culture', audienceTier: 'specialist' },
  { key: 'streetFood', label: 'Street Food & Markets', icon: '🥘', group: 'Culture & Discovery', formula: 'food', audienceTier: 'iconic' },
  // Popular, not enthusiast. streetFood is iconic and this was enthusiast —
  // a 2.5x gap between two halves of the same motivation. San Sebastian,
  // Copenhagen, Lyon and Modena are destinations BECAUSE of the restaurants.
  { key: 'fineDining', label: 'Fine Dining', icon: '🍽️', group: 'Culture & Discovery', formula: 'food', audienceTier: 'popular' },
  { key: 'wineSpirits', label: 'Wine & Spirits Tasting', icon: '🍷', group: 'Culture & Discovery', formula: 'food', audienceTier: 'enthusiast' },
  { key: 'coffeeTea', label: 'Specialty Coffee & Tea', icon: '☕', group: 'Culture & Discovery', formula: 'food', audienceTier: 'specialist' },
  // Relaxation & Leisure
  { key: 'beachesSwimming', label: 'Beaches & Swimming', icon: '🏖️', group: 'Relaxation & Leisure', formula: 'swim', audienceTier: 'iconic' },
  { key: 'sunbathing', label: 'Sunbathing', icon: '☀️', group: 'Relaxation & Leisure', formula: 'sun', audienceTier: 'popular' },
  // Deliberately non-seasonal (formula 'luxury' has no case in
  // deriveDestinationScores, so it falls through to `default: v = base`)
  // — how deep/good a destination's top-end lodging scene is doesn't
  // meaningfully change month to month, only the price of staying there
  // does (see costRange). Graded on its own merits per destination, never
  // curved against the single most extreme example (Bora Bora doesn't set
  // the ceiling everyone else is measured against).
  // Popular, not enthusiast. The Maldives and Bora Bora barely exist as
  // destinations apart from their hotels; "where can we stay" is upstream of
  // "where should we go" for a large share of travellers. At 0.4 this was
  // worth less than shopping.
  { key: 'luxuryHotels', label: 'Luxury Hotels', icon: '🏨', group: 'Relaxation & Leisure', formula: 'luxury', audienceTier: 'popular' },
  { key: 'allInclusive', label: 'All-inclusive Resorts', icon: '🏝️', group: 'Relaxation & Leisure', formula: 'luxury', audienceTier: 'popular' },
  { key: 'spaWellness', label: 'Spa & Wellness', icon: '💆', group: 'Relaxation & Leisure', formula: 'food', audienceTier: 'enthusiast' },
  { key: 'hotSprings', label: 'Hot Springs', icon: '♨️', group: 'Relaxation & Leisure', formula: 'swim', audienceTier: 'enthusiast' },
  { key: 'yogaRetreats', label: 'Yoga & Wellness Retreats', icon: '🧘', group: 'Relaxation & Leisure', formula: 'food', audienceTier: 'specialist' },
  { key: 'themeParks', label: 'Theme Parks & Attractions', icon: '🎢', group: 'Relaxation & Leisure', formula: 'luxury', audienceTier: 'popular' },
  { key: 'nightlife', label: 'Nightlife', icon: '🍸', group: 'Relaxation & Leisure', formula: 'food', audienceTier: 'popular' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️', group: 'Relaxation & Leisure', formula: 'shopping', audienceTier: 'popular' },
  // Hidden, not deleted: pulled from every admin/app screen that lists or
  // picks interests (see VISIBLE_SLIDERS below), but scoring, stored data,
  // and audience-tier weighting are untouched.
  { key: 'familyFun', label: 'Family Fun', icon: '👨‍👩‍👧', group: 'Relaxation & Leisure', formula: 'culture', audienceTier: 'popular', hidden: true },
  { key: 'spectatorSports', label: 'Spectator Sporting Events', icon: '🏟️', group: 'Relaxation & Leisure', formula: 'culture', audienceTier: 'specialist', hidden: true },
  // Value — practical/logistical, not domain interests (see comment above)
  { key: 'deals', label: 'Low-Season Deals', icon: '💸', group: 'Value', formula: 'deals', audienceTier: 'specialist' },
  { key: 'crowds', label: 'Avoiding Crowds', icon: '🧘', group: 'Value', formula: 'crowds', audienceTier: 'specialist' },
  { key: 'roadtrip', label: 'Road-Tripping', icon: '🚗', group: 'Value', formula: 'hiking', audienceTier: 'enthusiast' },
];

// The list every admin/app screen that lists or lets someone pick an
// interest should render from — SLIDERS itself stays the source of truth
// for scoring (rank.ts, destinations.ts, fitCurve.ts, curveScoring.ts all
// deliberately keep importing SLIDERS directly, not this, so a hidden
// interest's stored data and weighting are completely unaffected).
export const VISIBLE_SLIDERS = SLIDERS.filter((s) => !s.hidden);

export const SLIDER_GROUPS = [
  'Nature & Wildlife',
  'Sports & Recreation',
  'Culture & Discovery',
  'Relaxation & Leisure',
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
 * THE RULE THESE FOLLOW: put the high weights on GENERIC interests and the
 * low weights on SPECIFIC forms of them.
 *
 * A generic interest lets every destination answer with its own version.
 * `wildlifeViewing` at 9 is satisfied by orangutans, gorillas, jaguars or
 * big cats alike, so a jungle is not punished for failing to be a savanna.
 * `safari` at 9 would hard-code the savanna and penalise Borneo for what it
 * isn't. Same shape everywhere: `cityExploration` over `nightlife`,
 * `hiking` over `cyclingRoad`, `beachesSwimming` over `surfing`.
 *
 * This matters far more than it used to. The specialist read now weights an
 * interest by (weight / topWeight) ** PRIORITY_FALLOFF, so a 9 carries
 * roughly nine times the say of a 3 — a specific interest parked near the
 * top is now genuinely punishing, and an omitted one is nearly invisible
 * (an unlisted interest sits at NEUTRAL_WEIGHT 2, worth about 5% of a 9).
 *
 * So what a persona LEAVES OUT matters as much as what it emphasises, and
 * the previous set left out the very umbrella each one is about: the
 * Connoisseur had no cityExploration and no historyArchaeology while
 * putting fineDining top; the Active profile had no nationalParks,
 * campingBackcountry or trailRunning while weighting road cycling at 7.
 *
 * `crowds` and `deals` are trip logistics, not reasons to pick a place —
 * they are kept deliberately low here (the Naturalist previously carried
 * crowds at 7, its third-highest weight, which let calendar quietness
 * outrank actual wildlife).
 */
export const PERSONAS: Persona[] = [
  {
    id: 'naturalist', name: 'The Naturalist', icon: '🦜',
    blurb: 'Wildlife, birds, and wild places — timing matters more than anything else.',
    primary: ['wildlifeViewing', 'scenicLandscapes', 'nationalParks', 'hiking', 'birding', 'campingBackcountry', 'stargazing', 'crowds'],
    // wildlifeViewing leads because every wild place can answer it. birding
    // drops from 9 to 5: it was tied for top, which judged reefs and
    // rainforests on their bird lists.
    weights: buildWeights({
      wildlifeViewing: 9, scenicLandscapes: 8, nationalParks: 7, hiking: 6,
      birding: 5, campingBackcountry: 5, stargazing: 4, landscapePhotography: 4,
      safari: 3, whaleWatching: 3, geologyVolcanoes: 3, wildflowerBlooms: 3,
      diving: 3, fishing: 3, crowds: 4, deals: 3,
    }),
  },
  {
    id: 'sunwater', name: 'Sun & Water', icon: '🏖️',
    blurb: 'Beaches, warm water, and slowing down.',
    primary: ['beachesSwimming', 'sunbathing', 'spaWellness', 'luxuryHotels', 'diving', 'allInclusive', 'deals', 'crowds'],
    // surfing and sailing fall to 3: a beach traveller who doesn't surf
    // should not have every non-surf coast marked down.
    weights: buildWeights({
      beachesSwimming: 9, sunbathing: 9, spaWellness: 6, luxuryHotels: 5,
      allInclusive: 5, diving: 4, familyFun: 4, streetFood: 4,
      surfing: 3, sailing: 3, kayakingRafting: 3,
      crowds: 4, deals: 4,
    }),
  },
  {
    id: 'connoisseur', name: 'The Connoisseur', icon: '🍽️',
    blurb: 'Museums, markets, and meals worth planning a trip around.',
    primary: ['cityExploration', 'streetFood', 'museumsArt', 'architecture', 'historyArchaeology', 'fineDining', 'festivals', 'nightlife'],
    // cityExploration leads — it is the umbrella this traveller is actually
    // describing, and it was previously unweighted. fineDining drops from 9
    // (the old top) to 6: loving food is generic, loving tasting menus is not.
    weights: buildWeights({
      cityExploration: 9, streetFood: 8, museumsArt: 8, architecture: 8,
      historyArchaeology: 7, fineDining: 6, festivals: 5, nightlife: 5,
      religiousSites: 4, wineSpirits: 4, shopping: 4, traditionalCrafts: 3,
      coffeeTea: 3, crowds: 3, deals: 3,
    }),
  },
  {
    id: 'active', name: 'Active & Outdoors', icon: '🚵',
    blurb: 'Trails, adrenaline, and a reason to be outside all day.',
    primary: ['hiking', 'scenicLandscapes', 'adventureSports', 'nationalParks', 'campingBackcountry', 'trailRunning', 'cyclingRoad', 'roadtrip'],
    // cyclingRoad drops 7 -> 5 and skiing 5 -> 4, joining the other specific
    // disciplines. nationalParks, campingBackcountry and trailRunning were
    // all sitting at neutral despite being core to this profile.
    weights: buildWeights({
      hiking: 9, scenicLandscapes: 8, adventureSports: 7, nationalParks: 7,
      campingBackcountry: 6, trailRunning: 5, cyclingRoad: 5, roadtrip: 5,
      mountainBiking: 5, kayakingRafting: 5, mountaineering: 4,
      skiingSnowboarding: 4, fishing: 3, crowds: 4, deals: 3,
    }),
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
