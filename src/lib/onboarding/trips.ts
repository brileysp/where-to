import { COMPANIONS, allBands, bandDims, type Bands, type CareState } from './care';
import { isTripLength, type TripLength } from './trip-length';
import { REGION_KEYS, allRegions, type RegionKey } from './regions';
import { isPeak } from './peak';

/**
 * Saved trips: a traveler can plan more than one at once. What stays the same across trips (interests, Travel DNA, where you live, and the
 * defaults for who, budget and what matters) lives in the travel profile. A trip adds what has to be set for each trip (month and year, how long,
 * continents) and any choices that differ from the profile's defaults (who, bands, what matters, peak or off peak).
 */

export const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The choices a trip can change from the profile's defaults. A field that is not here is inherited. */
export interface TripOverrides {
  who?: string[];
  bands?: Bands;
  care?: CareState;
  /** Peak or off peak, a step from 0 to 4 (see peak.ts). */
  peak?: number;
}

export interface Trip {
  id: string;
  name: string;
  /** True until the traveler types their own name: while true the name follows the month and year. */
  nameAuto: boolean;
  /** 0 to 11, or null when no month is chosen. */
  month: number | null;
  week: number;
  year: number | null;
  /** True until the traveler edits the year: while true the year follows the month (the next time that month comes round). */
  yearAuto: boolean;
  length: TripLength | null;
  /** The continents left in; empty = all. */
  continents: RegionKey[];
  overrides: TripOverrides;
}

/** The next time a month comes round: this year if it is this month or later, otherwise next year. `month` is 0 to 11. */
export function nextYearFor(month: number, now: Date = new Date()): number {
  return month >= now.getMonth() ? now.getFullYear() : now.getFullYear() + 1;
}

/** "Brendan's September 2027 trip"; without a first name "My September 2027 trip"; without a month "Brendan's trip". */
export function defaultTripName(first: string | null | undefined, month: number | null, year: number | null): string {
  const who = first && first.trim() ? `${first.trim()}’s` : 'My';
  if (month == null) return `${who} trip`;
  return `${who} ${MONTH_FULL[month]}${year != null ? ` ${year}` : ''} trip`;
}

export const MAX_TRIPS = 20;
export const MAX_TRIP_NAME = 60;

export function newTrip(args: { id: string; first: string | null; month: number | null; now?: Date; overrides?: TripOverrides; length?: TripLength | null; continents?: RegionKey[]; week?: number }): Trip {
  const year = args.month == null ? null : nextYearFor(args.month, args.now);
  return {
    id: args.id,
    name: defaultTripName(args.first, args.month, year),
    nameAuto: true,
    month: args.month,
    week: args.week ?? 0,
    year,
    yearAuto: true,
    length: args.length ?? null,
    continents: args.continents ?? [],
    overrides: args.overrides ?? {},
  };
}

/** Changes the month, keeping the year and the automatic name in step where the traveler has not set them. */
export function withMonth(t: Trip, month: number | null, first: string | null, now: Date = new Date()): Trip {
  const year = t.yearAuto ? (month == null ? null : nextYearFor(month, now)) : t.year;
  return { ...t, month, year, week: month == null ? 0 : t.week, name: t.nameAuto ? defaultTripName(first, month, year) : t.name };
}

/** Sets the year by hand; the year then stays put when the month changes. */
export function withYear(t: Trip, year: number, first: string | null): Trip {
  return { ...t, year, yearAuto: false, name: t.nameAuto ? defaultTripName(first, t.month, year) : t.name };
}

/** Renames by hand; the name then stays put. An empty name goes back to the automatic one. */
export function withName(t: Trip, name: string, first: string | null): Trip {
  const n = name.trim().slice(0, MAX_TRIP_NAME);
  if (!n) return { ...t, nameAuto: true, name: defaultTripName(first, t.month, t.year) };
  return { ...t, name: n, nameAuto: false };
}

/** What a trip works with: the profile's defaults, with the trip's own choices laid over them. */
export interface EffectiveTrip {
  who: string[];
  bands: Bands;
  care: CareState;
  peak: number;
}

export function effectiveTrip(profile: { who: string[]; bands: Bands; care: CareState; peak: number }, trip: Pick<Trip, 'overrides'>): EffectiveTrip {
  const o = trip.overrides;
  return {
    who: o.who ?? profile.who,
    bands: o.bands ?? profile.bands,
    care: { ...profile.care, ...(o.care ?? {}) },
    peak: o.peak ?? profile.peak,
  };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The overrides to save for a trip whose working choices are `current`: only what differs from the profile's defaults. */
export function overridesFor(profile: { who: string[]; bands: Bands; care: CareState; peak: number }, current: EffectiveTrip): TripOverrides {
  const out: TripOverrides = {};
  if (!sameJson(current.who, profile.who)) out.who = current.who;
  if (!sameJson(current.bands, profile.bands)) out.bands = current.bands;
  const care: CareState = {};
  for (const [k, v] of Object.entries(current.care)) if (!sameJson(v, profile.care[k])) care[k] = v;
  // An item the profile has but the trip cleared is an override too (an empty choice).
  for (const k of Object.keys(profile.care)) if (!current.care[k]) care[k] = { o: [], firm: false };
  if (Object.keys(care).length) out.care = care;
  if (current.peak !== profile.peak) out.peak = current.peak;
  return out;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Cleans anything claiming to be a saved trip: unknown values are dropped, never trusted. Null for garbage. */
export function parseTrip(raw: unknown): Trip | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw.id)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_TRIP_NAME) : '';
  const month = typeof raw.month === 'number' && Number.isInteger(raw.month) && raw.month >= 0 && raw.month <= 11 ? raw.month : null;
  const week = month != null && typeof raw.week === 'number' && Number.isInteger(raw.week) && raw.week >= 0 && raw.week <= 4 ? raw.week : 0;
  const year = typeof raw.year === 'number' && Number.isInteger(raw.year) && raw.year >= 2000 && raw.year <= 2100 ? raw.year : null;
  const continents = Array.isArray(raw.continents) ? REGION_KEYS.filter((k) => (raw.continents as unknown[]).includes(k)) : [];
  const o = isRecord(raw.overrides) ? raw.overrides : {};
  const overrides: TripOverrides = {};
  if (Array.isArray(o.who)) overrides.who = [...new Set(o.who.filter((x): x is string => typeof x === 'string' && COMPANIONS.some((c) => c.key === x)))];
  if (isRecord(o.bands)) {
    const bands = allBands();
    for (const d of bandDims()) {
      const picked = Array.isArray(o.bands[d.key]) ? (o.bands[d.key] as unknown[]).filter((b): b is string => typeof b === 'string' && d.bands.some((x) => x.key === b)) : [];
      if (picked.length) bands[d.key] = d.bands.map((x) => x.key).filter((x) => picked.includes(x));
    }
    overrides.bands = bands;
  }
  if (isRecord(o.care)) {
    const care: CareState = {};
    for (const [k, v] of Object.entries(o.care).slice(0, 24)) {
      if (k.length > 40 || !isRecord(v) || !Array.isArray(v.o)) continue;
      care[k] = { o: v.o.filter((x): x is string => typeof x === 'string' && x.length < 40).slice(0, 12), firm: v.firm === true };
    }
    overrides.care = care;
  }
  if (isPeak(o.peak)) overrides.peak = o.peak;
  const nameAuto = raw.nameAuto !== false;
  return {
    id: raw.id.toLowerCase(),
    name: name || defaultTripName(null, month, year),
    nameAuto: !name ? true : nameAuto,
    month,
    week,
    year,
    yearAuto: raw.yearAuto !== false,
    length: isTripLength(raw.length) ? raw.length : null,
    continents: allRegions(continents) ? [] : continents,
    overrides,
  };
}

/** A line for the trips list: "Sep 2027 · 1 week · Europe, Africa". */
export function tripSummary(t: Pick<Trip, 'month' | 'year' | 'length' | 'continents'>, lengthLabel: (l: TripLength) => string, regionLabel: (k: RegionKey) => string): string {
  const parts: string[] = [];
  if (t.month != null) parts.push(`${MONTH_FULL[t.month].slice(0, 3)}${t.year != null ? ` ${t.year}` : ''}`);
  if (t.length) parts.push(lengthLabel(t.length).toLowerCase());
  if (!allRegions(t.continents)) parts.push(REGION_KEYS.filter((k) => t.continents.includes(k)).map(regionLabel).join(', '));
  return parts.join(' · ') || 'Any time, anywhere';
}

/** A new trip's id. `crypto.randomUUID` only exists on secure pages (https or localhost), and a phone testing over the home network is neither, so this builds one from random bytes. */
export function makeTripId(): string {
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}
