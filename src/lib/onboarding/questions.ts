import { applySwipeToProfile } from '@/lib/dna/profile';
import { interestByKey as dnaInterestByKey } from '@/lib/dna/interests';
import type { DnaCard, PreferenceProfile, SwipeType } from '@/lib/dna/types';
import type { ScoredDestination } from '@/lib/scoring/types';
import { buildProfile, INTEREST_TO_DNA_PICK, weightsFromProfile, type ProfileInput } from './bridge';
import { changedPositions, rankPlaces, topIds } from './shortlist';
import { orderedByLevel } from './levels';
import { getOnboardingSettings } from './settings';

/**
 * The sharpen questions (docs/onboarding-v2/SPEC.md 4.8): the app's own experience cards, asked as No / Yes / Love. An interest the
 * traveler picked gets its own cards first (the "expert lane": Top interests before the rest); after that the card that would change the
 * top five most is asked next. The effect of an answer is the app's own swipe maths, and the hint is the real count of top places it
 * would move.
 *
 * The first questions are asked in groups, one interest after another, never mixed: the unlock count is split across the traveler's top
 * interests (see questionQuotas), the first interest's share is asked, then the next's, and so on.
 */

export interface Question {
  card: DnaCard;
  /** True when the card belongs to one of the traveler's interests (the expert lane). */
  lane: boolean;
  /** Average number of the top five that an answer would move. */
  impact: number;
  /** The interest this question was asked for, and its place in that interest's group ("2 of 3"), while the grouped questions run. */
  interest?: string;
  position?: { n: number; of: number };
}

const TYPES: SwipeType[] = ['no', 'yes', 'love'];
const MAX_CANDIDATES = 12;

/** The experience-card categories that belong to each interest, most specific first. An interest not listed falls back to the engine's coarser category list for it. */
export const INTEREST_CARD_CATEGORIES: Record<string, string[]> = {
  wildlifeViewing: ['Wildlife'], safari: ['Wildlife'], whaleWatching: ['Wildlife'], birding: ['Birding'],
  scenicLandscapes: ['Scenic Touring & Rentals', 'Photography'], landscapePhotography: ['Photography'], campingBackcountry: ['Rustic Adventure', 'Remote Wilderness'],
  hiking: ['Hiking'], mountaineering: ['Hiking', 'Adventure Sports'], trailRunning: ['Hiking'], cyclingRoad: ['Cycling'], mountainBiking: ['Cycling'],
  skiingSnowboarding: ['Snow Sports'], surfing: ['Surfing'], diving: ['Snorkeling & Diving'], windSports: ['Ocean Swimming'], sailing: ['Sailing & Yachting'], kayakingRafting: ['Adventure Sports'], adventureSports: ['Adventure Sports'],
  golf: ['Golf'], fishing: ['Fishing'],
  historyArchaeology: ['Culture'], museumsArt: ['Culture'], architecture: ['Culture'], cityExploration: ['Cities'], indigenousCultures: ['Culture'], religiousSites: ['Culture'], festivals: ['Culture'], traditionalCrafts: ['Culture'],
  streetFood: ['Food'], fineDining: ['Food'], wineSpirits: ['Wine & Spirits'],
  beachesSwimming: ['Beach', 'Ocean Swimming'], sunbathing: ['Beach'], luxuryHotels: ['Luxury Lodging'], allInclusive: ['Luxury Lodging'], spaWellness: ['Wellness'], hotSprings: ['Wellness'], yogaRetreats: ['Wellness'], themeParks: ['Theme Parks & Resorts'], nightlife: ['Nightlife'], shopping: ['Shopping'],
};

/** The card categories that belong to an interest. */
export function categoriesForInterest(interestKey: string): string[] {
  const own = INTEREST_CARD_CATEGORIES[interestKey];
  if (own) return own;
  const pick = INTEREST_TO_DNA_PICK[interestKey];
  return (pick && dnaInterestByKey(pick)?.categories) || [];
}

function laneCategories(levels: ProfileInput['levels'], level: 'top' | 'any'): Set<string> {
  const out = new Set<string>();
  for (const [k, l] of Object.entries(levels)) if (level === 'any' || l === 'top') categoriesForInterest(k).forEach((c) => out.add(c));
  return out;
}

/** First unanswered card of each category in turn, so a generic question is never stuck in one category. */
function spread(cards: DnaCard[], limit: number): DnaCard[] {
  const byCat = new Map<string, DnaCard[]>();
  for (const c of cards) (byCat.get(c.category) ?? byCat.set(c.category, []).get(c.category)!).push(c);
  const lists = [...byCat.values()];
  const out: DnaCard[] = [];
  for (let round = 0; out.length < limit && lists.some((l) => l.length > round); round++) {
    for (const l of lists) if (l[round] && out.length < limit) out.push(l[round]);
  }
  return out;
}

/**
 * The interests the grouped questions are asked about, in order: the Top interests; with none, the Love ones; then Like; then Curious.
 * At most the number of Top interests allowed.
 */
export function laneInterests(levels: ProfileInput['levels']): string[] {
  const ordered = orderedByLevel(levels);
  for (const tier of ['top', 'love', 'like', 'cur'] as const) {
    const ks = ordered.filter((k) => levels[k] === tier);
    if (ks.length) return ks.slice(0, getOnboardingSettings().maxTopInterests);
  }
  return [];
}

/**
 * How many of the questions each interest gets. The total is shared out evenly, and the interests listed first get the extra one when it
 * does not divide: 5 interests get 2 each; 4 get 3, 3, 2, 2; 3 get 4, 3, 3; 2 get 5 each; 1 gets all 10.
 */
export function questionQuotas(interests: number, total: number): number[] {
  if (interests <= 0) return [];
  const base = Math.floor(total / interests);
  const extra = total % interests;
  return Array.from({ length: interests }, (_, i) => base + (i < extra ? 1 : 0));
}

export interface QuestionContext {
  input: ProfileInput;
  cards: DnaCard[];
  /** Cards already asked or skipped, in addition to those in input.answers. */
  seenCardIds: string[];
  /**
   * Every card asked in this step so far (answered or skipped), which is what the grouped quotas count. Left out, the questions are not grouped.
   */
  askedCardIds?: string[];
  destinations: ScoredDestination[];
  month: number | null;
}

/** Average number of the current top five moved by the three possible answers to a card. */
export function impactOf(card: DnaCard, ctx: QuestionContext, baseProfile: PreferenceProfile, baseTop: string[]): number {
  let total = 0;
  for (const t of TYPES) {
    const w = weightsFromProfile(applySwipeToProfile(baseProfile, card, t), ctx.input.levels);
    total += changedPositions(baseTop, topIds(rankPlaces(ctx.destinations, w, ctx.month, ctx.input.bands)));
  }
  return total / TYPES.length;
}

/**
 * The interest whose group of questions is still running: the first one, in order, that has not yet been asked its share and still has
 * cards left. Asked cards are counted toward the first interest they fit, up to its share, so a card that fits two interests is only used once.
 */
function nextGroup(ctx: QuestionContext, open: DnaCard[]): { interest: string; pool: DnaCard[]; position: { n: number; of: number } } | null {
  if (!ctx.askedCardIds) return null;
  const lane = laneInterests(ctx.input.levels);
  if (!lane.length) return null;
  const quotas = questionQuotas(lane.length, getOnboardingSettings().unlockQuestions);
  const byId = new Map(ctx.cards.map((c) => [c.id, c]));
  const unattributed = [...ctx.askedCardIds];
  for (let i = 0; i < lane.length; i++) {
    const cats = categoriesForInterest(lane[i]);
    let got = 0;
    for (let j = 0; j < unattributed.length && got < quotas[i]; ) {
      const c = byId.get(unattributed[j]);
      if (c && cats.includes(c.category)) {
        unattributed.splice(j, 1);
        got++;
      } else j++;
    }
    if (got >= quotas[i]) continue;
    const pool = open.filter((c) => cats.includes(c.category));
    if (pool.length) return { interest: lane[i], pool, position: { n: got + 1, of: quotas[i] } };
  }
  return null;
}

/** The next question, or null when there is nothing left to ask. */
export function pickQuestion(ctx: QuestionContext): Question | null {
  const seen = new Set([...ctx.seenCardIds, ...ctx.input.answers.map((a) => a.card.id)]);
  const open = ctx.cards.filter((c) => c.stage === 'broad' && !seen.has(c.id)).sort((a, b) => a.id.localeCompare(b.id));
  if (!open.length) return null;
  const baseProfile = buildProfile(ctx.input);
  const baseTop = topIds(rankPlaces(ctx.destinations, weightsFromProfile(baseProfile, ctx.input.levels), ctx.month, ctx.input.bands));
  const group = nextGroup(ctx, open);
  if (group) {
    let best: Question | null = null;
    for (const card of group.pool.slice(0, MAX_CANDIDATES)) {
      const impact = impactOf(card, ctx, baseProfile, baseTop);
      if (!best || impact > best.impact) best = { card, lane: true, impact, interest: group.interest, position: group.position };
    }
    if (best) return best;
  }
  const top = laneCategories(ctx.input.levels, 'top');
  const any = laneCategories(ctx.input.levels, 'any');
  const laneTop = open.filter((c) => top.has(c.category));
  const laneAny = open.filter((c) => any.has(c.category));
  const pool = laneTop.length ? laneTop : laneAny.length ? laneAny : open;
  const lane = pool !== open;
  const candidates = lane ? pool.slice(0, MAX_CANDIDATES) : spread(pool, MAX_CANDIDATES);
  let best: Question | null = null;
  for (const card of candidates) {
    const impact = impactOf(card, ctx, baseProfile, baseTop);
    if (!best || impact > best.impact) best = { card, lane, impact };
  }
  return best;
}

/** The hint under a question (spec 4.8). */
export function questionHint(q: Question): string {
  if (q.impact >= 0.5) return `Your answer would reshuffle about ${Math.max(1, Math.round(q.impact))} of your top ${getOnboardingSettings().shortlistPlaces}.`;
  return q.lane ? 'Goes into your Travel DNA. Sharpens future trips.' : 'Small effect on this list, saved for later.';
}
