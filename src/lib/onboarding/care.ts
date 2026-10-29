import { BAND_DIMENSIONS } from '@/lib/scoring/constants';

/**
 * Who is going, the "Open to" bands, and "What else matters when you choose" (docs/onboarding-v2/SPEC.md 5.1 to 5.3). Pure functions over
 * plain state objects. The bands are the app's own four (BAND_DIMENSIONS); everything selected means no preference.
 */

export interface Companion {
  key: string;
  label: string;
}
export const COMPANIONS: Companion[] = [
  { key: 'solo', label: 'Solo' },
  { key: 'friends', label: 'With friends' },
  { key: 'partner', label: 'With a spouse or partner' },
  { key: 'kids', label: 'With my kids' },
];

export const toggleInList = (list: string[], key: string): string[] => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);

// ---- bands ----

export type Bands = Record<string, string[]>;
export const bandDims = () => BAND_DIMENSIONS;

/** The names the trip screens show for the band groups: weather is called Climate there, and budget is Budget & comfort. */
const BAND_TITLES: Record<string, string> = { budget: 'Budget & comfort', weather: 'Climate' };
export const bandTitle = (d: { key: string; label: string }): string => BAND_TITLES[d.key] ?? d.label;
const bandKeys = (dim: string): string[] => BAND_DIMENSIONS.find((d) => d.key === dim)?.bands.map((b) => b.key) ?? [];

/** Nothing narrowed: every band of the dimension is selected. */
export const allBands = (): Bands => Object.fromEntries(BAND_DIMENSIONS.map((d) => [d.key, d.bands.map((b) => b.key)]));
export const isNarrowed = (bands: Bands, dim: string): boolean => (bands[dim] ?? []).length < bandKeys(dim).length;

const inBandOrder = (dim: string, set: string[]) => [...set].sort((a, b) => bandKeys(dim).indexOf(a) - bandKeys(dim).indexOf(b));

/** The "Open to" pills: all start selected; tapping switches one off or on, and the last one cannot be switched off. */
export function toggleBandPill(bands: Bands, dim: string, band: string): Bands {
  const set = bands[dim] ?? bandKeys(dim);
  if (set.includes(band)) return set.length > 1 ? { ...bands, [dim]: set.filter((x) => x !== band) } : bands;
  return { ...bands, [dim]: inBandOrder(dim, [...set, band]) };
}

/** The "What else matters" editor for a band: it starts with none selected (no preference). Clearing the last one goes back to all. */
export function toggleBandChoice(bands: Bands, dim: string, band: string): Bands {
  const cur = isNarrowed(bands, dim) ? bands[dim] : [];
  const next = cur.includes(band) ? cur.filter((x) => x !== band) : [...cur, band];
  return { ...bands, [dim]: next.length ? inBandOrder(dim, next) : bandKeys(dim) };
}

export const resetBand = (bands: Bands, dim: string): Bands => ({ ...bands, [dim]: bandKeys(dim) });

// ---- what else matters ----

export interface CareItem {
  key: string;
  icon: string;
  name: string;
  detail: string;
  /** A band item reads and writes the bands above instead of its own choices. */
  band?: boolean;
  question?: string;
  options?: Array<[string, string]>;
  multi?: boolean;
  /** Wording of the must-have switch, where a firm rule makes sense. */
  firm?: string;
  /** Kept in the Travel DNA by default (and the only items asked in the Travel DNA path). */
  lasting?: boolean;
  /** Stays with this trip by default. */
  trip?: boolean;
}

export const CARE_ITEMS: CareItem[] = [
  { key: 'vibe', icon: '🎭', name: 'Social vibe', detail: 'Quiet to nightlife', band: true, trip: true },
  { key: 'physical', icon: '💪', name: 'Physical demand', detail: 'Easy to challenging', band: true, trip: true },
  { key: 'kids', icon: '👶', name: 'Kid-friendly', detail: 'Easy with children', question: 'Ages', options: [['u5', 'Under 5'], ['k', '5 to 12'], ['t', 'Teens']], multi: true, firm: 'Must be geared to families', trip: true },
  { key: 'food', icon: '🥗', name: 'Food needs', detail: 'Vegetarian, halal, gluten-free', question: 'Needs', options: [['veg', 'Vegetarian'], ['vegan', 'Vegan'], ['gf', 'Gluten-free'], ['halal', 'Halal'], ['kosher', 'Kosher']], multi: true, firm: 'Rule out places with few options', lasting: true },
  { key: 'lang', icon: '🗣️', name: 'Language', detail: 'How easy it is to get by', question: 'I need', options: [['en', 'English to work'], ['es', 'Spanish'], ['pt', 'Portuguese'], ['it', 'Italian'], ['ja', 'Japanese']], multi: true, firm: 'Rule out places where English is hard', lasting: true },
  { key: 'how', icon: '🧭', name: 'How you travel', detail: 'Road trip, tour, cruise', question: 'I like', options: [['road', 'Road trip'], ['tour', 'Guided tour'], ['cruise', 'Cruise'], ['base', 'One base, day trips']], multi: true, lasting: true },
];

export type CareState = Record<string, { o: string[]; firm: boolean }>;

/** The items shown: all of them for a trip, only the lasting ones in the Travel DNA path. */
export const careItemsFor = (scope: 'trip' | 'dna'): CareItem[] => CARE_ITEMS.filter((c) => (scope === 'dna' ? c.lasting : true));

export function careHas(c: CareItem, care: CareState, bands: Bands): boolean {
  if (c.band) return isNarrowed(bands, c.key);
  const v = care[c.key];
  return !!(v && v.o.length);
}

export const careCount = (care: CareState, bands: Bands): number => CARE_ITEMS.filter((c) => careHas(c, care, bands)).length;

const bandLabel = (dim: string, band: string) => BAND_DIMENSIONS.find((d) => d.key === dim)?.bands.find((b) => b.key === band)?.label ?? band;
const optLabel = (c: CareItem, o: string) => c.options?.find((x) => x[0] === o)?.[1] ?? o;

/** The collapsed line's text, e.g. "Social vibe: Lively & Social · Food needs: Vegan (must)". */
export function careSummary(care: CareState, bands: Bands): string[] {
  const out: string[] = [];
  for (const c of CARE_ITEMS) {
    if (c.band) {
      if (isNarrowed(bands, c.key)) out.push(`${c.name}: ${bands[c.key].map((b) => bandLabel(c.key, b)).join(', ')}`);
      continue;
    }
    const v = care[c.key];
    if (!v || !v.o.length) continue;
    out.push(`${c.name}: ${v.o.map((o) => optLabel(c, o)).join(', ')}${v.firm ? ' (must)' : ''}`);
  }
  return out;
}

export interface CarePick {
  item: CareItem;
  option: string;
  label: string;
}

/** Every selection as a removable chip ("Your picks"). */
export function carePicks(care: CareState, bands: Bands, scope: 'trip' | 'dna'): CarePick[] {
  const out: CarePick[] = [];
  for (const c of careItemsFor(scope)) {
    if (c.band) {
      if (isNarrowed(bands, c.key)) bands[c.key].forEach((b) => out.push({ item: c, option: b, label: bandLabel(c.key, b) }));
      continue;
    }
    care[c.key]?.o.forEach((o) => out.push({ item: c, option: o, label: optLabel(c, o) }));
  }
  return out;
}

/**
 * Pick or drop an option. A single-choice item holds one option; dropping the last one removes the item, except on the Travel DNA page
 * (`keepEmpty`), where the card stays so it can be filled in again.
 */
export function toggleCareOption(care: CareState, c: CareItem, option: string, keepEmpty = false): CareState {
  const cur = care[c.key] ?? { o: [], firm: false };
  const has = cur.o.includes(option);
  const o = has ? cur.o.filter((x) => x !== option) : c.multi ? [...cur.o, option] : [option];
  const next = { ...care };
  if (o.length || keepEmpty) next[c.key] = { ...cur, o };
  else delete next[c.key];
  return next;
}

export function setCareFirm(care: CareState, key: string, firm: boolean): CareState {
  return care[key] ? { ...care, [key]: { ...care[key], firm } } : care;
}

export function clearCare(care: CareState, key: string): CareState {
  const next = { ...care };
  delete next[key];
  return next;
}

/** Removing one chip from "Your picks". */
export function removePick(care: CareState, bands: Bands, pick: CarePick): { care: CareState; bands: Bands } {
  if (pick.item.band) {
    const rest = bands[pick.item.key].filter((x) => x !== pick.option);
    return { care, bands: { ...bands, [pick.item.key]: rest.length ? rest : bandKeys(pick.item.key) } };
  }
  return { care: toggleCareOption(care, pick.item, pick.option), bands };
}


/**
 * The one short chip a closed "What else matters" row shows, always one line: "No preference", the one thing picked, or "2 of 5 selected".
 * It never lists several choices, so a row does not grow as the traveler ticks more.
 */
export function careRowSummary(c: CareItem, care: CareState, bands: Bands): string {
  if (c.band) {
    if (!isNarrowed(bands, c.key)) return 'No preference';
    const set = bands[c.key];
    return set.length === 1 ? bandLabel(c.key, set[0]) : `${set.length} of ${bandKeys(c.key).length} selected`;
  }
  const v = care[c.key];
  if (!v || !v.o.length) return 'No preference';
  if (v.o.length > 1) return `${v.o.length} of ${c.options?.length ?? v.o.length} selected`;
  return `${optLabel(c, v.o[0])}${v.firm ? ' · must' : ''}`;
}
