import { shortenForInline } from './evidence';
import { isDomainUnlocked } from './domains';
import type { DnaCard, DnaState, Insight, InsightRecord, InsightTemplate, PreferenceProfile } from './types';

// Ported verbatim from traveldna.js:1313-1747 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

export function countPositiveSwipesForAttributes(dnaState: DnaState, allCards: DnaCard[], attrs: string[]): number {
  return (dnaState.swipes || []).filter((sw) => {
    if (sw.type === 'no') return false;
    const card = allCards.find((c) => c.id === sw.cardId);
    if (!card) return false;
    return attrs.some((attr) => (card.preferenceSignals || {})[attr] > 0);
  }).length;
}

export function isTopAttribute(profile: PreferenceProfile, attr: string, topN: number): boolean {
  const sorted = Object.entries(profile).sort((a, b) => b[1] - a[1]);
  const idx = sorted.findIndex(([k]) => k === attr);
  return idx >= 0 && idx < topN;
}

/**
 * Finds up to `n` real swiped card titles that actually contributed
 * positive signal to the given attributes — most recent first.
 */
export function pickEvidenceCardTitles(dnaState: DnaState, allCards: DnaCard[], attrs: string[], n: number): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  const swipes = [...(dnaState.swipes || [])].reverse();
  for (const sw of swipes) {
    if (sw.type === 'no') continue;
    const card = allCards.find((c) => c.id === sw.cardId);
    if (!card || seen.has(card.id)) continue;
    if (!attrs.some((a) => (card.preferenceSignals || {})[a] > 0)) continue;
    seen.add(card.id);
    titles.push(`<em>${card.short || shortenForInline(card.title)}</em>`);
    if (titles.length >= n) break;
  }
  return titles;
}

// tier: 'broad' templates test one flat threshold and read generic almost
// by construction. 'narrow' templates are compound, comparative, or
// domain-gated — they say something a much smaller slice of profiles
// would actually match. generateInsightCheck() prefers 'narrow' ones so
// broad, easy-to-clear templates don't dominate every session.
export const INSIGHT_TEMPLATES: InsightTemplate[] = [
  { id: 'wildlife_over_comfort', minEvidence: 3, tier: 'broad',
    text: 'You seem willing to trade some comfort for rare wildlife or photography opportunities.',
    relatedAttributes: ['wildlife', 'photography', 'remoteWilderness', 'rusticAdventure', 'luxury'],
    evidenceAttributes: ['wildlife', 'photography', 'remoteWilderness'],
    test: (p) => p.wildlife >= 5 && p.comfortFlexibility >= 3 },
  { id: 'crowd_sensitive_insight', minEvidence: 3, tier: 'broad',
    text: 'You seem crowd-sensitive, even when the destination itself is a strong fit.',
    relatedAttributes: ['avoidingCrowds'],
    evidenceAttributes: ['avoidingCrowds'],
    test: (p) => p.avoidingCrowds >= 6 },
  { id: 'rare_over_sightseeing', minEvidence: 3, tier: 'broad',
    text: 'You seem more motivated by rare encounters than classic sightseeing.',
    relatedAttributes: ['uniqueness', 'famousLandmarks'],
    evidenceAttributes: ['uniqueness'],
    test: (p) => p.uniqueness >= 9 && p.famousLandmarks <= 0 },
  { id: 'food_wine_bonus', minEvidence: 3, tier: 'broad',
    text: 'Food and wine seem like bonuses for you, not the main reason to choose a trip.',
    relatedAttributes: ['food', 'wine'],
    evidenceAttributes: ['food', 'wine'],
    test: (p) => (p.food > 0 || p.wine > 0) && p.food < 6 && p.wine < 6 },
  { id: 'sense_of_place', minEvidence: 3, tier: 'broad',
    text: 'You may prefer trips with a strong sense of place over polished resort experiences.',
    relatedAttributes: ['authenticity', 'luxury'],
    evidenceAttributes: ['authenticity'],
    test: (p) => p.authenticity >= 5 && p.luxury <= 0 },
  { id: 'nature_not_hardship', minEvidence: 3, tier: 'broad',
    text: 'You seem drawn to nature, but not necessarily to hardship for hardship’s sake.',
    relatedAttributes: ['wildlife', 'remoteWilderness', 'rusticAdventure', 'physicalChallenge'],
    evidenceAttributes: ['wildlife', 'remoteWilderness'],
    test: (p) => (p.wildlife >= 4 || p.remoteWilderness >= 4) && p.rusticAdventure <= 2 && p.physicalChallenge <= 2 },
  { id: 'timing_over_landmarks', minEvidence: 3, tier: 'broad',
    text: 'You appear more interested in timing-sensitive experiences than bucket-list landmarks.',
    relatedAttributes: ['lowSeasonDeals', 'avoidingCrowds', 'famousLandmarks'],
    evidenceAttributes: ['lowSeasonDeals', 'avoidingCrowds'],
    test: (p) => (p.lowSeasonDeals >= 6 || p.avoidingCrowds >= 6) && p.famousLandmarks <= 0 },
  { id: 'timing_over_luxury', minEvidence: 3, tier: 'broad',
    text: 'Good timing seems to matter more to you than luxury accommodations.',
    relatedAttributes: ['avoidingCrowds', 'lowSeasonDeals', 'luxury'],
    evidenceAttributes: ['avoidingCrowds', 'lowSeasonDeals'],
    test: (p) => (p.avoidingCrowds >= 6 || p.lowSeasonDeals >= 6) && p.luxury <= 0 },
  { id: 'comfort_flexible_payoff', minEvidence: 3, tier: 'broad',
    text: 'You seem comfort-flexible as long as the payoff feels worth it.',
    relatedAttributes: ['comfortFlexibility', 'wildlife', 'remoteWilderness', 'physicalChallenge'],
    evidenceAttributes: ['comfortFlexibility'],
    test: (p) => p.comfortFlexibility >= 5 && (p.wildlife >= 4 || p.remoteWilderness >= 4 || p.physicalChallenge >= 4) },
  { id: 'remote_high_reward', minEvidence: 3, tier: 'broad',
    text: 'You seem drawn to remote, high-reward experiences over easily accessible ones.',
    relatedAttributes: ['remoteWilderness', 'uniqueness'],
    evidenceAttributes: ['remoteWilderness', 'uniqueness'],
    test: (p) => p.remoteWilderness >= 8 && p.uniqueness >= 7 },
  { id: 'warm_water_secondary', minEvidence: 3, tier: 'narrow',
    text: 'Warm water and beach time seem to matter to you, but not enough to carry a whole trip on their own.',
    relatedAttributes: ['beach', 'oceanSwimming'],
    evidenceAttributes: ['beach', 'oceanSwimming'],
    test: (p) =>
      (p.oceanSwimming > 0 || p.beach > 0) &&
      !isTopAttribute(p, 'beach', 5) &&
      !isTopAttribute(p, 'oceanSwimming', 5) &&
      p.beach + p.oceanSwimming < p.wildlife + p.remoteWilderness },
  { id: 'fewer_better_experiences', minEvidence: 3, tier: 'broad',
    text: 'Fewer, better experiences may matter more to you than a packed itinerary.',
    relatedAttributes: ['avoidingCrowds', 'relaxation', 'nightlife', 'shopping'],
    evidenceAttributes: ['avoidingCrowds', 'relaxation'],
    test: (p) => p.avoidingCrowds >= 5 && p.relaxation >= 3 && p.nightlife <= 1 && p.shopping <= 1 },
  { id: 'thrill_over_calm', minEvidence: 3, tier: 'broad',
    text: 'You seem drawn to adrenaline and physical thrill more than quiet, contemplative moments.',
    relatedAttributes: ['adrenaline', 'physicalChallenge', 'relaxation'],
    evidenceAttributes: ['adrenaline'],
    test: (p) => p.adrenaline >= 6 && p.relaxation <= 2 },

  // ---- Deeper, subdimension-aware insights (require an unlocked domain) ----
  { id: 'rare_target_birder', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: 'You seem interested in birding when it produces rare or photographic encounters, not just casual bird walks.',
    relatedAttributes: ['rareEndemics', 'photography', 'casualBirding'],
    evidenceAttributes: ['rareEndemics', 'photography'],
    test: (p) => (p.rareEndemics >= 4 || p.photography >= 4) && p.casualBirding <= 1 },
  { id: 'early_morning_payoff', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: 'You seem willing to tolerate early mornings if the wildlife or photography payoff is strong.',
    relatedAttributes: ['earlyMorningTolerance', 'wildlife', 'photography'],
    evidenceAttributes: ['earlyMorningTolerance'],
    test: (p) => p.earlyMorningTolerance >= 4 && (p.wildlife >= 4 || p.photography >= 4) },
  { id: 'ocean_not_passive', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: 'You like the ocean, but passive beach time may not be enough to drive a trip on its own.',
    relatedAttributes: ['oceanSwimming', 'beach', 'relaxation'],
    evidenceAttributes: ['oceanSwimming'],
    test: (p) => p.oceanSwimming >= 4 && p.relaxation <= 1 },
  { id: 'landscape_timing_driver', minEvidence: 3, requiresDomain: 'Landscape Photography', tier: 'narrow',
    text: 'Landscape photography may be a real trip driver for you, especially when timing and light matter.',
    relatedAttributes: ['landscapePhotography', 'goldenHour', 'dramaticWeather'],
    evidenceAttributes: ['landscapePhotography'],
    test: (p) => p.landscapePhotography >= 6 },
  { id: 'dramatic_not_famous', minEvidence: 3, requiresDomain: 'Landscape Photography', tier: 'narrow',
    text: 'You seem drawn to dramatic landscapes, but not necessarily the most famous viewpoints.',
    relatedAttributes: ['dramaticWeather', 'iconicLandscapes', 'solitude'],
    evidenceAttributes: ['dramaticWeather'],
    test: (p) => p.dramaticWeather >= 3 && p.iconicLandscapes <= 1 },
  { id: 'rough_conditions_for_access', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: 'You may be willing to accept rougher conditions for better access to light, wildlife, or solitude.',
    relatedAttributes: ['comfortFlexibility', 'remoteWilderness', 'solitude'],
    evidenceAttributes: ['comfortFlexibility'],
    test: (p) => p.comfortFlexibility >= 5 && (p.remoteWilderness >= 4 || p.solitude >= 3) },

  { id: 'birding_pelagic_specialist', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: "Rough pelagic trips and hard-to-reach targets don't scare you off — that's a real commitment level, not casual interest.",
    relatedAttributes: ['pelagicBirding', 'difficultTargetChasing'],
    evidenceAttributes: ['pelagicBirding', 'difficultTargetChasing'],
    test: (p) => p.pelagicBirding >= 3 || p.difficultTargetChasing >= 4 },
  { id: 'birding_casual_addon', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: "Birding reads as a relaxed add-on for you, not something you'd plan a whole trip around.",
    relatedAttributes: ['casualBirding'],
    evidenceAttributes: ['casualBirding'],
    test: (p) => p.casualBirding >= 3 && p.rareEndemics < 2 },
  { id: 'birding_hide_patience', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: 'Sitting still in a hide for hours to get one shot or sighting genuinely doesn\'t bother you.',
    relatedAttributes: ['birdingFromHides', 'patience'],
    evidenceAttributes: ['birdingFromHides'],
    test: (p) => p.birdingFromHides >= 3 && p.patience >= 2 },
  { id: 'surf_serious_uncrowded', minEvidence: 3, requiresDomain: 'Surfing', tier: 'narrow',
    text: 'You want serious, uncrowded breaks, not polished beginner-friendly ones.',
    relatedAttributes: ['reefBreaks', 'uncrowded'],
    evidenceAttributes: ['reefBreaks', 'uncrowded'],
    test: (p) => p.reefBreaks >= 3 || p.uncrowded >= 3 },
  { id: 'surf_warmwater_addon', minEvidence: 3, requiresDomain: 'Surfing', tier: 'narrow',
    text: 'Surfing looks like a warm-water, easygoing part of the trip for you, not the main event.',
    relatedAttributes: ['warmWater', 'seriousSurfIntensity'],
    evidenceAttributes: ['warmWater'],
    test: (p) => p.warmWater >= 3 && p.seriousSurfIntensity <= 0 },
  { id: 'surf_social_scene', minEvidence: 3, requiresDomain: 'Surfing', tier: 'narrow',
    text: 'The social scene around a surf trip matters to you almost as much as the waves themselves.',
    relatedAttributes: ['surfCamp'],
    evidenceAttributes: ['surfCamp'],
    test: (p) => p.surfCamp >= 3 },
  { id: 'cycle_challenge_seeker', minEvidence: 3, requiresDomain: 'Cycling', tier: 'narrow',
    text: "You're riding for the physical challenge, not the scenery — climbs and technical terrain are the draw.",
    relatedAttributes: ['hardClimbing', 'mountainBiking'],
    evidenceAttributes: ['hardClimbing', 'mountainBiking'],
    test: (p) => p.hardClimbing >= 3 || p.mountainBiking >= 3 },
  { id: 'cycle_scenery_first', minEvidence: 3, requiresDomain: 'Cycling', tier: 'narrow',
    text: 'You want cycling that supports the scenery and the place, not pure athletic performance.',
    relatedAttributes: ['scenicRoadCycling', 'scenery', 'hardClimbing'],
    evidenceAttributes: ['scenicRoadCycling', 'scenery'],
    test: (p) => (p.scenicRoadCycling >= 3 || p.scenery >= 3) && p.hardClimbing <= 1 },
  { id: 'cycle_comfort_matters', minEvidence: 3, requiresDomain: 'Cycling', tier: 'narrow',
    text: "A comfortable bed and some support at the end of the ride matter to you — this isn't about suffering for its own sake.",
    relatedAttributes: ['luxuryInnToInn', 'supportVehiclePreference'],
    evidenceAttributes: ['luxuryInnToInn', 'supportVehiclePreference'],
    test: (p) => p.luxuryInnToInn >= 3 || p.supportVehiclePreference >= 2 },
  { id: 'photo_astro_night', minEvidence: 3, requiresDomain: 'Landscape Photography', tier: 'narrow',
    text: 'Night skies and dark-location photography are a real draw for you, not just daytime scenery.',
    relatedAttributes: ['astrophotography', 'lateNightTolerance'],
    evidenceAttributes: ['astrophotography'],
    test: (p) => p.astrophotography >= 3 },
  { id: 'photo_gear_committed', minEvidence: 3, requiresDomain: 'Landscape Photography', tier: 'narrow',
    text: "You'll haul extra gear or hike well out of the way if it means getting the right shot.",
    relatedAttributes: ['gearHeavy', 'hikingForTheShot'],
    evidenceAttributes: ['gearHeavy', 'hikingForTheShot'],
    test: (p) => p.gearHeavy >= 3 || p.hikingForTheShot >= 3 },

  { id: 'mission_driven_travel', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: "Trips feel more meaningful to you when there's a specific target — a species, a summit, a shot — not just a destination.",
    relatedAttributes: ['surfAsMainPurpose', 'cyclingAsMainPurpose', 'photoAsMainPurpose', 'difficultTargetChasing'],
    evidenceAttributes: ['surfAsMainPurpose', 'cyclingAsMainPurpose', 'photoAsMainPurpose', 'difficultTargetChasing'],
    test: (p) =>
      (p.surfAsMainPurpose >= 2 && p.surfAsSideActivity <= 0) ||
      (p.cyclingAsMainPurpose >= 2 && p.cyclingAsSideActivity <= 0) ||
      (p.photoAsMainPurpose >= 2 && p.photoAsSideActivity <= 0) ||
      (p.difficultTargetChasing >= 2 && p.casualBirding <= 0) },
  { id: 'earned_solitude', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: "Quiet feels more valuable to you when it's earned — through effort, remoteness, or good timing — not just handed to you.",
    relatedAttributes: ['physicalChallenge', 'remoteWilderness', 'avoidingCrowds'],
    evidenceAttributes: ['remoteWilderness', 'avoidingCrowds'],
    test: (p) => (p.physicalChallenge >= 6 || p.remoteWilderness >= 6) && p.avoidingCrowds >= 6 },
  { id: 'selective_immersion', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'You seem to want real, local texture — without needing to rough it to get there.',
    relatedAttributes: ['authenticity', 'rusticAdventure', 'physicalChallenge'],
    evidenceAttributes: ['authenticity'],
    test: (p) => p.authenticity >= 6 && p.rusticAdventure <= 0 && p.physicalChallenge <= 2 },
  { id: 'drawn_to_contrast', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'Big swings in pace or setting seem to energize you more than staying in one register the whole trip.',
    relatedAttributes: ['adrenaline', 'relaxation', 'cities', 'remoteWilderness', 'nightlife', 'solitude'],
    evidenceAttributes: ['adrenaline', 'relaxation', 'cities', 'remoteWilderness', 'nightlife', 'solitude'],
    test: (p) =>
      (p.adrenaline >= 6 && p.relaxation >= 6) ||
      (p.cities >= 6 && p.remoteWilderness >= 6) ||
      (p.nightlife >= 6 && p.solitude >= 3) },
  { id: 'participation_over_observation', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'You seem to remember what you did more than what you saw — doing the thing beats watching it happen.',
    relatedAttributes: ['physicalChallenge', 'adrenaline', 'cycling', 'surfing', 'famousLandmarks', 'photography'],
    evidenceAttributes: ['physicalChallenge', 'adrenaline', 'cycling', 'surfing'],
    test: (p) =>
      (p.physicalChallenge >= 6 || p.adrenaline >= 6 || p.cycling >= 6 || p.surfing >= 6) &&
      p.famousLandmarks <= 0 &&
      p.photography <= 1 },
  { id: 'birding_specialist_expertise', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: 'Access to someone who really knows the birds seems to matter more to you than how nice the lodge is.',
    relatedAttributes: ['specialistGuiding', 'guidedBirding', 'luxury'],
    evidenceAttributes: ['specialistGuiding', 'guidedBirding'],
    test: (p) => (p.specialistGuiding >= 2 || p.guidedBirding >= 2) && p.luxury <= 0 },
  { id: 'single_dimension_maximizer', minEvidence: 4, requiresDomain: null, tier: 'broad',
    text: "One interest seems to matter a lot more to you than everything else — you'd trade off nearly anything to get more of it.",
    relatedAttributes: ['wildlife', 'birding', 'cycling', 'surfing', 'landscapePhotography', 'food', 'adrenaline', 'culture', 'remoteWilderness', 'cities', 'beach', 'wellness', 'golf', 'snowsports', 'fishing', 'sailing'],
    evidenceAttributes: ['wildlife', 'birding', 'cycling', 'surfing', 'landscapePhotography', 'food', 'adrenaline', 'culture', 'remoteWilderness', 'cities', 'beach', 'wellness', 'golf', 'snowsports', 'fishing', 'sailing'],
    test: (p) => {
      const headline = ['wildlife', 'birding', 'cycling', 'surfing', 'landscapePhotography', 'food', 'adrenaline', 'culture', 'remoteWilderness', 'cities', 'beach', 'wellness', 'golf', 'snowsports', 'fishing', 'sailing'];
      const vals = headline.map((k) => p[k] || 0).filter((v) => v > 0).sort((a, b) => b - a);
      if (vals.length < 3) return false;
      return vals[0] >= 10 && vals[0] >= vals[1] * 2;
    } },

  { id: 'wild_without_sacrifice', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'You want real wildness — but not without a genuinely good bed waiting at the end of the day.',
    relatedAttributes: ['remoteWilderness', 'wildlife', 'luxury'],
    evidenceAttributes: ['remoteWilderness', 'wildlife'],
    test: (p) => p.remoteWilderness >= 6 && p.wildlife >= 4 && p.luxury >= 6 },
  { id: 'food_wine_as_driver', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'Food or wine alone could be reason enough for you to book a trip.',
    relatedAttributes: ['food', 'wine'],
    evidenceAttributes: ['food', 'wine'],
    test: (p) => p.food >= 8 || p.wine >= 8 },
  { id: 'curated_nightlife', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'You want nights that feel curated and alive, not touristy and packed.',
    relatedAttributes: ['nightlife', 'avoidingCrowds'],
    evidenceAttributes: ['nightlife', 'avoidingCrowds'],
    test: (p) => p.nightlife >= 6 && p.avoidingCrowds >= 6 },
  { id: 'family_adventure', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: "Adventure doesn't seem to stop just because the kids are along.",
    relatedAttributes: ['family', 'physicalChallenge', 'adrenaline'],
    evidenceAttributes: ['family', 'physicalChallenge', 'adrenaline'],
    test: (p) => p.family >= 6 && (p.physicalChallenge >= 6 || p.adrenaline >= 6) },
  { id: 'street_food_over_fine_dining', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: "You'd rather eat off a cart than sit through a tasting menu.",
    relatedAttributes: ['streetFood', 'fineDining'],
    evidenceAttributes: ['streetFood'],
    test: (p) => p.streetFood >= 3 && p.fineDining <= 0 },
];

export function computeInsightConfidence(profile: PreferenceProfile, template: InsightTemplate): number {
  const relevantSum = template.relatedAttributes.reduce((sum, attr) => sum + Math.max(0, profile[attr] || 0), 0);
  const raw = 0.5 + Math.min(relevantSum / 30, 0.4);
  return Math.round(raw * 100) / 100;
}

/**
 * Turns a template's fixed base claim into the actual sentence shown —
 * grounded in THIS user's data. Two people who both clear the same
 * template read different text depending on how hard they cleared it and
 * what they specifically swiped yes/love on.
 */
export function composeInsightText(
  template: InsightTemplate,
  dnaState: DnaState,
  allCards: DnaCard[],
  confidence: number,
): string {
  const tierPhrase =
    confidence >= 0.8 ? 'a strong, consistent pattern' : confidence >= 0.65 ? 'a pattern across several swipes' : 'an early read so far';
  const cards = pickEvidenceCardTitles(dnaState, allCards, template.evidenceAttributes, 1);
  const evidenceClause = cards.length ? `, e.g. "${cards[0]}"` : '';
  return `${template.text} (${tierPhrase}${evidenceClause})`;
}

/**
 * Returns a new insight to show, or null. Gating: no checks before 12
 * swipes, at most one every 6-8 swipes, only when a template's threshold
 * is met AND it has at least 3 distinct contributing positive swipes, and
 * only for a pattern not already shown.
 */
export function generateInsightCheck(dnaState: DnaState, allCards: DnaCard[]): Insight | null {
  const swipeCount = dnaState.swipeCount || 0;
  if (swipeCount < 12) return null;

  const lastShown = dnaState.lastInsightCheckSwipeCount || 0;
  if (lastShown > 0 && swipeCount - lastShown < 6) return null;

  const alreadyShown = new Set(
    [...(dnaState.confirmedInsights || []), ...(dnaState.rejectedInsights || []), ...(dnaState.unsureInsights || [])].map(
      (i) => i.templateId,
    ),
  );

  const candidates = INSIGHT_TEMPLATES.filter((t) => {
    if (alreadyShown.has(t.id)) return false;
    if (t.requiresDomain && !isDomainUnlocked(dnaState, t.requiresDomain)) return false;
    if (!t.test(dnaState.profile)) return false;
    const evidence = countPositiveSwipesForAttributes(dnaState, allCards, t.evidenceAttributes);
    return evidence >= (t.minEvidence || 3);
  });
  if (!candidates.length) return null;

  // Prefer narrow/specific candidates over broad ones when both qualify.
  const narrow = candidates.filter((t) => t.tier === 'narrow');
  const pool = narrow.length && Math.random() < 0.8 ? narrow : candidates;
  const template = pool[Math.floor(Math.random() * pool.length)];
  const confidence = computeInsightConfidence(dnaState.profile, template);
  return {
    id: `${template.id}_${swipeCount}`,
    templateId: template.id,
    text: composeInsightText(template, dnaState, allCards, confidence),
    relatedAttributes: template.relatedAttributes,
    evidenceTags: template.evidenceAttributes,
    confidence,
    status: 'pending',
    shownAtSwipeCount: swipeCount,
  };
}

type Feedback = 'confirmed' | 'rejected' | 'unsure';

/**
 * Confirming nudges related attributes up slightly (independent
 * validation, not a full swipe-equivalent). Rejecting halves related
 * attributes toward neutral. "Not sure" changes nothing but is recorded.
 */
export function applyInsightFeedback(dnaState: DnaState, insight: Insight, feedback: Feedback): DnaState {
  const updated: DnaState = { ...dnaState };
  const record: InsightRecord = { ...insight, status: feedback };
  const profile = { ...dnaState.profile };

  if (feedback === 'confirmed') {
    insight.relatedAttributes.forEach((attr) => {
      if ((profile[attr] || 0) >= 0) profile[attr] = (profile[attr] || 0) + 1;
    });
    updated.confirmedInsights = [...(dnaState.confirmedInsights || []), record];
  } else if (feedback === 'rejected') {
    insight.relatedAttributes.forEach((attr) => {
      profile[attr] = (profile[attr] || 0) * 0.5;
    });
    updated.rejectedInsights = [...(dnaState.rejectedInsights || []), record];
  } else {
    updated.unsureInsights = [...(dnaState.unsureInsights || []), record];
  }

  updated.profile = profile;
  updated.lastInsightCheckSwipeCount = dnaState.swipeCount;
  updated.pendingInsight = null;
  return updated;
}
