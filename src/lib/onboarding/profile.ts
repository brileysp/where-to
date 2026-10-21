import type { DnaCard, SwipeType } from '@/lib/dna/types';
import { CARE_ITEMS, COMPANIONS, allBands, bandDims, type Bands, type CareState } from './care';
import { dnaRows, keepOn, type RowContext } from './dna-rows';
import { pickerInterests } from './interests';
import { type Levels } from './levels';
import { getOnboardingSettings, type InterestLevelId } from './settings';
import { VIBES } from './vibes';
import type { Answer } from './bridge';
import { isTripLength, type TripLength } from './trip-length';
import { REGION_KEYS, allRegions, type RegionKey } from './regions';
import { hasSubStep, subChoices } from './origin';
import { isCountryCode } from '@/lib/units/countries';

/**
 * What a traveler keeps from the new onboarding flow (docs/onboarding-v2/SPEC.md 6, 4.11). Only the rows whose "keep in my Travel DNA"
 * switch is on are saved. Pure functions; `parseTravelProfile` makes anything read from storage or received from a browser safe.
 */

/** The answers a traveler gave to an interest's own questions: interest key, then question key, then the positions of the answers picked. */
export type InterestAnswers = Record<string, Record<string, number[]>>;

export interface TravelProfile {
  v: 1;
  levels: Levels;
  subs: Record<string, string[]>;
  /**
   * Answers to the interests' own questions (docs/matching-model.md). Kept even while the chip that opens a question is unticked
   * (dormant); only the questions that are currently asked count toward the match.
   */
  qa: InterestAnswers;
  bands: Bands;
  care: CareState;
  who: string[];
  home: string | null;
  /** Where the traveler lives: a country, and for the US and Canada a state or province. Flights are estimated from here when no airport is set. */
  homeCountry: string | null;
  homeSub: string | null;
  vibes: string[];
  answers: Array<{ cardId: string; type: SwipeType }>;
  /** Only when the traveler chose to keep dates. */
  month: number | null;
  week: number;
  /** How long the trip is (kept with the dates), and the continents left in (empty = all). */
  length: TripLength | null;
  continents: RegionKey[];
  /** Only when the traveler chose to keep flight limits. */
  maxHours: number;
}

export interface FlowChoices {
  levels: Levels;
  subs: Record<string, string[]>;
  qa?: InterestAnswers;
  bands: Bands;
  care: CareState;
  who: string[];
  home: string | null;
  homeCountry?: string | null;
  homeSub?: string | null;
  vibes: string[];
  answers: Answer[];
  month: number | null;
  week: number;
  length?: TripLength | null;
  continents?: RegionKey[];
  maxHours: number;
}

/** Answers only for interests the traveler still has. */
function keptAnswers(qa: InterestAnswers, levels: Levels): InterestAnswers {
  return Object.fromEntries(Object.entries(qa).filter(([k, v]) => levels[k] && Object.keys(v).length));
}

/** Cleans saved answers: known interests only, short keys, at most three picks, each a small whole number. */
function parseAnswers(raw: unknown, levels: Levels): InterestAnswers {
  const out: InterestAnswers = {};
  if (!isRecord(raw)) return out;
  for (const [interest, qs] of Object.entries(raw)) {
    if (!levels[interest] || !isRecord(qs)) continue;
    const kept: Record<string, number[]> = {};
    for (const [q, picks] of Object.entries(qs).slice(0, 24)) {
      if (q.length > 40 || !Array.isArray(picks)) continue;
      const ok = [...new Set(picks.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 12))].slice(0, 3);
      if (ok.length) kept[q] = ok;
    }
    if (Object.keys(kept).length) out[interest] = kept;
  }
  return out;
}

/** The profile to save: everything the traveler keeps. Interests, levels and specifics are always kept; the rest follow the keep switches. */
export function toTravelProfile(c: FlowChoices, keep: Record<string, boolean>, dnaMode: boolean): TravelProfile {
  const ctx: RowContext = { dnaMode, bands: c.bands, care: c.care, who: c.who, home: c.home, homeCountry: c.homeCountry ?? null, homeSub: c.homeSub ?? null, vibes: c.vibes, answerCount: c.answers.length, month: c.month, week: c.week, length: c.length ?? null, continents: c.continents ?? [], maxHours: c.maxHours };
  const rows = dnaRows(ctx);
  const kept = (key: string) => {
    const r = rows.find((x) => x.key === key);
    return r ? keepOn(keep, key, r.def) : false;
  };
  const bands = allBands();
  for (const d of bandDims()) if (kept(`b_${d.key}`)) bands[d.key] = c.bands[d.key];
  const care: CareState = {};
  for (const item of CARE_ITEMS) if (c.care[item.key] && kept(`c_${item.key}`)) care[item.key] = c.care[item.key];
  const subs = Object.fromEntries(Object.entries(c.subs).filter(([k, v]) => c.levels[k] && v.length));
  return {
    v: 1,
    levels: c.levels,
    subs,
    qa: keptAnswers(c.qa ?? {}, c.levels),
    bands,
    care,
    who: kept('who') ? c.who : [],
    home: kept('origin') ? c.home : null,
    homeCountry: kept('origin') ? c.homeCountry ?? null : null,
    homeSub: kept('origin') ? c.homeSub ?? null : null,
    vibes: kept('vibes') ? c.vibes : [],
    answers: kept('ans') ? c.answers.map((a) => ({ cardId: a.card.id, type: a.type })) : [],
    month: kept('when') ? c.month : null,
    week: kept('when') ? c.week : 0,
    length: kept('when') ? c.length ?? null : null,
    continents: kept('when') && !allRegions(c.continents ?? []) ? (c.continents ?? []) : [],
    maxHours: kept('limits') ? c.maxHours : 0,
  };
}

/** The flow's choices back from a saved profile. Answers whose card no longer exists are dropped. */
export function fromTravelProfile(p: TravelProfile, cards: DnaCard[]): FlowChoices {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return {
    levels: p.levels,
    subs: p.subs,
    qa: p.qa ?? {},
    bands: p.bands,
    care: p.care,
    who: p.who,
    home: p.home,
    homeCountry: p.homeCountry ?? null,
    homeSub: p.homeSub ?? null,
    vibes: p.vibes,
    answers: p.answers.flatMap((a) => (byId.has(a.cardId) ? [{ card: byId.get(a.cardId)!, type: a.type }] : [])),
    month: p.month,
    week: p.week,
    length: p.length ?? null,
    continents: p.continents ?? [],
    maxHours: p.maxHours,
  };
}

const LEVEL_IDS: InterestLevelId[] = ['cur', 'like', 'love', 'top'];
const SWIPES: SwipeType[] = ['no', 'yes', 'love'];
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown, allowed?: Set<string>): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length < 80 && (!allowed || allowed.has(x))))] : []);

/** Cleans anything that claims to be a saved profile: unknown interests, options and values are dropped, never trusted. Returns null for garbage. */
export function parseTravelProfile(raw: unknown): TravelProfile | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const interestKeys = new Set(pickerInterests().map((i) => i.key));
  const levels: Levels = {};
  if (isRecord(raw.levels)) for (const [k, l] of Object.entries(raw.levels)) if (interestKeys.has(k) && LEVEL_IDS.includes(l as InterestLevelId)) levels[k] = l as InterestLevelId;
  // No more Top interests than allowed: extras fall back to Love.
  let tops = 0;
  for (const k of Object.keys(levels)) {
    if (levels[k] === 'top' && ++tops > getOnboardingSettings().maxTopInterests) levels[k] = 'love';
  }
  const subs: Record<string, string[]> = {};
  if (isRecord(raw.subs)) for (const [k, v] of Object.entries(raw.subs)) if (levels[k]) subs[k] = strings(v).slice(0, 12);
  const bands = allBands();
  if (isRecord(raw.bands)) for (const d of bandDims()) {
    const picked = strings((raw.bands as Record<string, unknown>)[d.key], new Set(d.bands.map((b) => b.key)));
    if (picked.length) bands[d.key] = d.bands.map((b) => b.key).filter((b) => picked.includes(b));
  }
  const care: CareState = {};
  if (isRecord(raw.care)) for (const item of CARE_ITEMS) {
    const v = (raw.care as Record<string, unknown>)[item.key];
    if (item.band || !isRecord(v)) continue;
    care[item.key] = { o: strings(v.o, new Set(item.options?.map((o) => o[0]))), firm: !!item.firm && v.firm === true };
  }
  const month = typeof raw.month === 'number' && Number.isInteger(raw.month) && raw.month >= 0 && raw.month <= 11 ? raw.month : null;
  const week = month != null && typeof raw.week === 'number' && Number.isInteger(raw.week) && raw.week >= 0 && raw.week <= 4 ? raw.week : 0;
  const maxHours = typeof raw.maxHours === 'number' && getOnboardingSettings().flightHourLimits.includes(raw.maxHours) ? raw.maxHours : 0;
  const answers = Array.isArray(raw.answers)
    ? raw.answers.flatMap((a) => (isRecord(a) && typeof a.cardId === 'string' && a.cardId.length < 120 && SWIPES.includes(a.type as SwipeType) ? [{ cardId: a.cardId, type: a.type as SwipeType }] : [])).slice(0, 200)
    : [];
  const homeRaw = typeof raw.home === 'string' ? raw.home.toUpperCase() : null;
  const countryRaw = typeof raw.homeCountry === 'string' ? raw.homeCountry.toUpperCase() : null;
  const homeCountry = countryRaw && isCountryCode(countryRaw) ? countryRaw : null;
  const subRaw = typeof raw.homeSub === 'string' ? raw.homeSub.toUpperCase() : null;
  const homeSub = homeCountry && hasSubStep(homeCountry) && subRaw && subChoices(homeCountry).some(([code]) => code === subRaw) ? subRaw : null;
  const continents = Array.isArray(raw.continents) ? REGION_KEYS.filter((k) => (raw.continents as unknown[]).includes(k)) : [];
  return {
    v: 1,
    levels,
    subs,
    qa: parseAnswers(raw.qa, levels),
    bands,
    care,
    who: strings(raw.who, new Set(COMPANIONS.map((c) => c.key))),
    home: homeRaw && /^[A-Z]{3}$/.test(homeRaw) ? homeRaw : null,
    homeCountry,
    homeSub,
    vibes: strings(raw.vibes, new Set(VIBES.map((v) => v.key))),
    answers,
    month,
    week,
    length: isTripLength(raw.length) ? raw.length : null,
    continents: allRegions(continents) ? [] : continents,
    maxHours,
  };
}
