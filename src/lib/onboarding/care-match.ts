import type { MatchSettings } from '@/lib/scoring/matchSettings';
import { DEFAULT_MATCH_SETTINGS } from '@/lib/scoring/matchSettings';
import type { MatchReason } from '@/lib/scoring/personalMatch';
import type { CareState } from './care';
import type { PlaceNote } from './live-factors';
import type { TravelFacts, TravelPlaceFacts } from './travel-facts';

/**
 * What "What else matters when you choose?" does to every place (10 Nov 2026): kids and their ages, dietary needs, languages, mobility, and how the traveler likes
 * to travel, read from the place's traveler-needs ratings. Same rule as every other check (docs/matching-model.md): a place can only keep its score or lose some of it,
 * and a place with no data on a point is never marked down. An item the traveler marked as a must (a firm item) also sets places aside that are clearly poor on it.
 *
 *   fit    = the place's rating as a share of "a full match" (7 of 10), capped at 1; with several picks the traveler needs, the weakest pick decides
 *            (kids of three ages, three dietary needs), and with several picks the traveler would be happy with, the best one decides (languages, ways to travel)
 *   keep   = 1 - (1 - missKeep) * (1 - fit)     missKeep: a Lean (nice to have) keeps 85%, a firm item keeps 65%, the same numbers as a missed Lean or Limit answer
 *   result = the items multiply, never below the interest floor (30%)
 */

export interface CareEffect {
  /** What each place keeps of its whole score. Only places that lose something. */
  factors: Record<string, number>;
  /** Places set aside by a firm item, with the reason. */
  hidden: Record<string, string>;
  /** The place sheet's notes, under the key CARE_NOTE_KEY. */
  notes: Record<string, Record<string, PlaceNote>>;
}

export const CARE_NOTE_KEY = '_care';
/** A firm item sets a place aside when the weakest pick rates under this (the same bar for every item). */
export const CARE_MUST_MIN = 4;
/** A reason chip shows when the weakest pick rates under half of a full match: a nice-to-have costs at most 15%, so the usual 15% threshold would only ever fire on a rating of 0. */
export const CARE_REASON_FIT = 0.5;

interface ItemResult {
  /** Rating of the weakest or best pick, 0 to 10; null when the place has no data for it. */
  rating: number | null;
  fit: number;
  /** Rating under which a firm item sets the place aside. */
  mustMin: number;
  /** The words for a reason ("hard with under-5s") and for a match ("easy with under-5s"). */
  miss: string;
  hit: string;
}

const KIDS: Record<string, { key: keyof TravelPlaceFacts; miss: string; hit: string }> = {
  u5: { key: 'kidsUnder5', miss: 'Hard with under-5s', hit: 'easy with under-5s' },
  k: { key: 'kids5to12', miss: 'Less for kids 5 to 12', hit: 'good for kids 5 to 12' },
  t: { key: 'kidsTeens', miss: 'Less for teens', hit: 'good for teens' },
};
const FOOD: Record<string, { key: keyof TravelPlaceFacts; miss: string; hit: string }> = {
  veg: { key: 'dietVegetarian', miss: 'Few vegetarian options', hit: 'easy to eat vegetarian' },
  vegan: { key: 'dietVegan', miss: 'Few vegan options', hit: 'easy to eat vegan' },
  gf: { key: 'dietGlutenFree', miss: 'Gluten-free is hard', hit: 'easy to eat gluten-free' },
  halal: { key: 'dietHalal', miss: 'Few halal options', hit: 'easy to eat halal' },
  kosher: { key: 'dietKosher', miss: 'Few kosher options', hit: 'easy to keep kosher' },
};
const HOW: Record<string, { key: keyof TravelPlaceFacts; label: string }> = {
  road: { key: 'fmtRoad', label: 'a road trip' },
  tour: { key: 'fmtTour', label: 'a guided tour' },
  cruise: { key: 'fmtCruise', label: 'a cruise' },
  base: { key: 'fmtBase', label: 'one base with day trips' },
};
const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese', it: 'Italian', fr: 'French', de: 'German', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic' };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

function kidsItem(picks: string[], f: TravelPlaceFacts, full: number): ItemResult | null {
  const rated = picks.map((p) => ({ p, v: num(f[KIDS[p]?.key]) })).filter((x) => KIDS[x.p] && x.v !== null) as Array<{ p: string; v: number }>;
  if (!rated.length) return null;
  const worst = rated.reduce((a, b) => (b.v < a.v ? b : a));
  return { rating: worst.v, fit: Math.min(1, worst.v / full), mustMin: CARE_MUST_MIN, miss: KIDS[worst.p].miss, hit: rated.length > 1 ? 'good for all your children' : KIDS[worst.p].hit };
}
function foodItem(picks: string[], f: TravelPlaceFacts, full: number): ItemResult | null {
  const rated = picks.map((p) => ({ p, v: num(f[FOOD[p]?.key]) })).filter((x) => FOOD[x.p] && x.v !== null) as Array<{ p: string; v: number }>;
  if (!rated.length) return null;
  const worst = rated.reduce((a, b) => (b.v < a.v ? b : a));
  return { rating: worst.v, fit: Math.min(1, worst.v / full), mustMin: CARE_MUST_MIN, miss: FOOD[worst.p].miss, hit: rated.length > 1 ? 'easy to meet all your food needs' : FOOD[worst.p].hit };
}
function langItem(picks: string[], f: TravelPlaceFacts, full: number): ItemResult | null {
  const english = num(f.englishEase);
  // A place that has been filled in but lists no other language is an English-speaking place: it simply has none besides English.
  const local = f.localLanguages ?? (english !== null ? [] : null);
  if (english === null && !local) return null;
  const options = picks.map((p) => (p === 'en' ? { p, v: english } : { p, v: local ? (local.includes(p) ? 10 : 0) : null })).filter((x) => x.v !== null) as Array<{ p: string; v: number }>;
  if (!options.length) return null;
  const best = options.reduce((a, b) => (b.v > a.v ? b : a));
  const names = picks.map((p) => LANG_NAMES[p] ?? p);
  return { rating: best.v, fit: Math.min(1, best.v / full), mustMin: CARE_MUST_MIN, miss: names.length === 1 ? (picks[0] === 'en' ? 'English is hard to get by with' : `${names[0]} is not spoken here`) : `Hard to get by in ${joinList(names)}`, hit: names.length === 1 ? (picks[0] === 'en' ? 'English works easily' : `${names[0]} works here`) : 'easy to get by in your languages' };
}
function accessItem(picks: string[], f: TravelPlaceFacts, full: number): ItemResult | null {
  // Two levels, each with its own rating: a few steps and short walks, or a wheelchair or walker (the stricter one wins when both are picked).
  const chair = picks.includes('chair');
  const v = num(chair ? f.accessWheelchair : f.accessMobility);
  if (v === null) return null;
  return { rating: v, fit: Math.min(1, v / full), mustMin: CARE_MUST_MIN, miss: chair ? 'Hard to get around with a wheelchair or walker' : 'Many steps and long walks', hit: chair ? 'wheelchair and walker friendly' : 'easy to get around' };
}
function howItem(picks: string[], f: TravelPlaceFacts, full: number): ItemResult | null {
  const rated = picks.map((p) => ({ p, v: num(f[HOW[p]?.key]) })).filter((x) => HOW[x.p] && x.v !== null) as Array<{ p: string; v: number }>;
  if (!rated.length) return null;
  const best = rated.reduce((a, b) => (b.v > a.v ? b : a));
  const labels = picks.filter((p) => HOW[p]).map((p) => HOW[p].label);
  return { rating: best.v, fit: Math.min(1, best.v / full), mustMin: -1, miss: `Not much for ${joinList(labels)}`, hit: `good for ${HOW[best.p].label}` };
}

export function careMatch(args: { care: CareState; facts: TravelFacts; settings?: MatchSettings }): CareEffect {
  const s = args.settings ?? DEFAULT_MATCH_SETTINGS;
  const out: CareEffect = { factors: {}, hidden: {}, notes: {} };
  const items: Array<{ key: string; picks: string[]; firm: boolean; run: (f: TravelPlaceFacts) => ItemResult | null }> = [];
  const add = (key: string, run: (picks: string[], f: TravelPlaceFacts) => ItemResult | null) => {
    const c = args.care[key];
    if (c && c.o.length) items.push({ key, picks: c.o, firm: !!c.firm, run: (f) => run(c.o, f) });
  };
  add('kids', (p, f) => kidsItem(p, f, s.chipFullMatchRating));
  add('food', (p, f) => foodItem(p, f, s.chipFullMatchRating));
  add('lang', (p, f) => langItem(p, f, s.chipFullMatchRating));
  add('access', (p, f) => accessItem(p, f, s.chipFullMatchRating));
  add('how', (p, f) => howItem(p, f, s.chipFullMatchRating));
  if (!items.length) return out;

  for (const [placeId, f] of Object.entries(args.facts)) {
    let factor = 1;
    const reasons: MatchReason[] = [];
    const matches: string[] = [];
    for (const it of items) {
      const r = it.run(f);
      if (!r) continue;
      const missKeep = it.firm ? s.keepIfLimitMissed : s.keepIfLeanMissed;
      const keep = 1 - (1 - missKeep) * (1 - r.fit);
      factor *= keep;
      if (it.firm && it.picks.length && r.rating !== null && r.mustMin >= 0 && r.rating < r.mustMin && !out.hidden[placeId]) out.hidden[placeId] = r.miss;
      if (r.fit < CARE_REASON_FIT) reasons.push({ source: it.firm ? 'limit' : 'lean', message: r.miss, cost: 1 - keep });
      else if (r.rating !== null && r.rating >= s.chipFullMatchRating) matches.push(r.hit);
    }
    factor = Math.max(s.interestFloor, factor);
    if (factor < 0.999999) out.factors[placeId] = factor;
    reasons.sort((a, b) => b.cost - a.cost);
    if (factor < 0.999999 || matches.length) (out.notes[placeId] ??= {})[CARE_NOTE_KEY] = { factor, reasons: reasons.slice(0, s.maxReasons), matches };
  }
  return out;
}
