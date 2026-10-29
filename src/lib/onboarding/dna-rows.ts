import { airportByCode } from './airports';
import { CARE_ITEMS, COMPANIONS, bandTitle, careRowSummary, isNarrowed, bandDims, type Bands, type CareState } from './care';
import { VIBES } from './vibes';
import { originLabel } from './origin';
import { allRegions, REGION_KEYS, REGION_LABELS, type RegionKey } from './regions';
import { TRIP_LENGTHS, type TripLength } from './trip-length';

/**
 * The cards on the Travel DNA page other than interests (docs/onboarding-v2/SPEC.md 4.11 and 6). Each row says where it is listed (`sec`),
 * whether it is kept in the Travel DNA by default (`def`), and its summary line. Pure functions over the flow's choices.
 */

export type RowSection = 'open' | 'care' | 'who' | 'taste' | 'trip';

export interface DnaRow {
  /** "b_<band>", "c_<care item>", "who", "origin", "vibes", "ans", "when" or "limits". */
  key: string;
  sec: RowSection;
  /** Kept in the Travel DNA by default. A row that is not shows under "This trip only". */
  def: boolean;
  icon: string;
  title: string;
  summary: string;
}

export interface RowContext {
  dnaMode: boolean;
  bands: Bands;
  care: CareState;
  who: string[];
  home: string | null;
  homeCountry?: string | null;
  homeSub?: string | null;
  vibes: string[];
  /** Taste-card swipes plus sharpen answers. */
  answerCount: number;
  month: number | null;
  week: number;
  length?: TripLength | null;
  continents?: readonly RegionKey[];
  maxHours: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const bandLabel = (dim: string, band: string) => bandDims().find((d) => d.key === dim)?.bands.find((b) => b.key === band)?.label ?? band;

/** "Mar · week 2 · 1 week · Europe, Africa": the dates, how long, and the continents left in. */
export function tripSummary(c: { month: number | null; week: number; length?: TripLength | null; continents?: readonly RegionKey[] }): string {
  const parts: string[] = [];
  if (c.month != null) parts.push(MONTH_NAMES[c.month] + (c.week ? ` · week ${c.week}` : ''));
  const len = TRIP_LENGTHS.find((l) => l.key === c.length);
  if (len) parts.push(len.label.toLowerCase());
  const on = c.continents ?? [];
  if (!allRegions(on)) parts.push(REGION_KEYS.filter((k) => on.includes(k)).map((k) => REGION_LABELS[k]).join(', '));
  return parts.join(' · ') || 'Any time, anywhere';
}

export const homeLabel = (code: string | null): string => {
  const a = airportByCode(code);
  return a ? `${a.city} (${a.code})` : 'Not set';
};

export function dnaRows(c: RowContext): DnaRow[] {
  const rows: DnaRow[] = [];
  // Budget and weather stay under "Open to". Social vibe and physical demand are "What matters" items, so they read and edit like the rest.
  for (const d of bandDims()) {
    const care = d.key === 'vibe' || d.key === 'physical';
    rows.push({
      key: `b_${d.key}`,
      sec: care ? 'care' : 'open',
      // Weather is a Travel DNA default only in the Travel DNA path; in a trip it stays with the trip.
      def: d.key === 'weather' ? c.dnaMode : true,
      icon: d.icon,
      title: bandTitle(d),
      summary: isNarrowed(c.bands, d.key) ? c.bands[d.key].map((b) => bandLabel(d.key, b)).join(', ') : 'No preference',
    });
  }
  // Every "What else matters" item is always listed, "No preference" until something is picked. Lasting ones are kept by default; the rest
  // sit under "This trip only".
  for (const item of CARE_ITEMS) {
    if (item.band) continue;
    rows.push({
      key: `c_${item.key}`,
      sec: item.lasting ? 'care' : 'trip',
      def: !!item.lasting,
      icon: item.icon,
      title: item.name,
      summary: careRowSummary(item, c.care, c.bands),
    });
  }
  rows.push({
    key: 'who',
    sec: 'who',
    def: c.dnaMode,
    icon: '👥',
    title: c.dnaMode ? 'Who you usually travel with' : 'Who is going this time',
    summary: c.who.length ? c.who.map((k) => COMPANIONS.find((x) => x.key === k)?.label ?? k).join(', ') : 'Not set',
  });
  rows.push({ key: 'origin', sec: 'who', def: true, icon: '🏠', title: 'Where you live', summary: originLabel({ airport: c.home, country: c.homeCountry, sub: c.homeSub }) });
  if (c.vibes.length) rows.push({ key: 'vibes', sec: 'taste', def: true, icon: '🖼️', title: 'Photo picks', summary: c.vibes.map((v) => VIBES.find((x) => x.key === v)?.label ?? v).join(', ') });
  if (c.answerCount > 0) rows.push({ key: 'ans', sec: 'taste', def: true, icon: '🎚️', title: 'Your answers and swipes', summary: `${c.answerCount} answers saved` });
  if (c.month != null || c.length || !allRegions(c.continents ?? [])) rows.push({ key: 'when', sec: 'trip', def: false, icon: '🗓️', title: 'Dates, length and places', summary: tripSummary(c) });
  if (c.maxHours) rows.push({ key: 'limits', sec: 'trip', def: false, icon: '✈️', title: 'Flight limits', summary: `From ${c.home ?? 'home'} · under ${c.maxHours}h` });
  return rows;
}

/** Whether a switch is on: the person's choice if they made one, else the row's default. */
export const keepOn = (keep: Record<string, boolean>, key: string, def: boolean): boolean => (keep[key] === undefined ? def : keep[key]);

/** Whether a card has choices in it already, which is what makes it open when the page is first shown. */
export function rowHasChoices(key: string, c: RowContext & { subs: Record<string, string[]> }): boolean {
  if (key.startsWith('i:')) return (c.subs[key.slice(2)] ?? []).length > 0;
  if (key.startsWith('b_')) return isNarrowed(c.bands, key.slice(2));
  if (key.startsWith('c_')) return !!c.care[key.slice(2)]?.o.length;
  if (key === 'who') return c.who.length > 0;
  if (key === 'origin') return !!c.home || !!c.homeCountry;
  if (key === 'vibes') return c.vibes.length > 0;
  if (key === 'when') return c.month != null || !!c.length || !allRegions(c.continents ?? []);
  if (key === 'limits') return c.maxHours > 0;
  return false;
}

/**
 * The short tags that describe a saved Travel DNA (spec 4.13): the narrowed bands, up to three photo picks, up to seven interests (Top ones
 * first, with their specifics), how many more there are, and the lasting "what matters" items.
 */
export function dnaTags(c: {
  bands: Bands;
  care: CareState;
  vibes: string[];
  levels: Record<string, string>;
  subs: Record<string, string[]>;
  chips: Record<string, Array<{ key: string; label: string }>>;
  interestOrder: string[];
  interestName: (key: string) => { icon: string; label: string };
}): string[] {
  const out: string[] = [];
  for (const d of bandDims()) if (isNarrowed(c.bands, d.key)) out.push(`${d.icon} ${c.bands[d.key].map((b) => bandLabel(d.key, b)).join(' / ')}`);
  c.vibes.slice(0, 3).forEach((v) => out.push(VIBES.find((x) => x.key === v)?.label ?? v));
  c.interestOrder.slice(0, 7).forEach((k) => {
    const i = c.interestName(k);
    const picked = (c.subs[k] ?? []).map((s) => c.chips[k]?.find((x) => x.key === s)?.label ?? s);
    out.push(`${i.icon} ${i.label}${picked.length ? ` · ${picked.join(', ')}` : ''}${c.levels[k] === 'top' ? ' · top interest' : ''}`);
  });
  if (c.interestOrder.length > 7) out.push(`+${c.interestOrder.length - 7} more interests`);
  for (const item of CARE_ITEMS.filter((x) => x.lasting)) {
    const v = c.care[item.key];
    if (!v || !v.o.length) continue;
    out.push(`${item.icon} ${item.name}${v.o.length ? `: ${v.o.map((o) => item.options?.find((x) => x[0] === o)?.[1] ?? o).join(', ')}` : ''}${v.firm ? ' · must' : ''}`);
  }
  return out.length ? out : ['Open to anything so far'];
}
