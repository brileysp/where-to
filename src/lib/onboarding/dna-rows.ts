import { airportByCode } from './airports';
import { CARE_ITEMS, COMPANIONS, careItemsFor, isNarrowed, bandDims, type Bands, type CareState } from './care';
import { VIBES } from './vibes';

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
  vibes: string[];
  /** Taste-card swipes plus sharpen answers. */
  answerCount: number;
  month: number | null;
  week: number;
  maxHours: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const bandLabel = (dim: string, band: string) => bandDims().find((d) => d.key === dim)?.bands.find((b) => b.key === band)?.label ?? band;

export const homeLabel = (code: string | null): string => {
  const a = airportByCode(code);
  return a ? `${a.city} (${a.code})` : 'Not set';
};

export function dnaRows(c: RowContext): DnaRow[] {
  const rows: DnaRow[] = [];
  for (const d of bandDims()) {
    rows.push({
      key: `b_${d.key}`,
      sec: 'open',
      // Weather is a Travel DNA default only in the Travel DNA path; in a trip it stays with the trip.
      def: d.key === 'weather' ? c.dnaMode : true,
      icon: d.icon,
      title: d.label,
      summary: isNarrowed(c.bands, d.key) ? c.bands[d.key].map((b) => bandLabel(d.key, b)).join(', ') : 'No preference',
    });
  }
  for (const item of CARE_ITEMS) {
    if (item.band) continue;
    const v = c.care[item.key];
    if (!v) continue;
    rows.push({
      key: `c_${item.key}`,
      sec: 'care',
      def: !!item.lasting,
      icon: item.icon,
      title: item.name,
      summary: v.o.length ? `${v.o.map((o) => item.options?.find((x) => x[0] === o)?.[1] ?? o).join(', ')}${v.firm ? ' · must' : ''}` : 'Nothing picked yet',
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
  rows.push({ key: 'origin', sec: 'who', def: true, icon: '🏠', title: 'Home airport', summary: homeLabel(c.home) });
  if (c.vibes.length) rows.push({ key: 'vibes', sec: 'taste', def: true, icon: '🖼️', title: 'Photo picks', summary: c.vibes.map((v) => VIBES.find((x) => x.key === v)?.label ?? v).join(', ') });
  if (c.answerCount > 0) rows.push({ key: 'ans', sec: 'taste', def: true, icon: '🎚️', title: 'Your answers and swipes', summary: `${c.answerCount} answers saved` });
  if (c.month != null) rows.push({ key: 'when', sec: 'trip', def: false, icon: '🗓️', title: 'Dates', summary: MONTH_NAMES[c.month] + (c.week ? ` · week ${c.week}` : '') });
  if (c.maxHours) rows.push({ key: 'limits', sec: 'trip', def: false, icon: '✈️', title: 'Flight limits', summary: `From ${c.home ?? 'home'} · under ${c.maxHours}h` });
  return rows;
}

/** Whether a switch is on: the person's choice if they made one, else the row's default. */
export const keepOn = (keep: Record<string, boolean>, key: string, def: boolean): boolean => (keep[key] === undefined ? def : keep[key]);

/** The lasting "what matters" items the person has not set yet, offered as "+ <item>" chips. */
export const unsetLastingCare = (care: CareState) => careItemsFor('dna').filter((c) => !care[c.key]);

/** Whether a card has choices in it already, which is what makes it open when the page is first shown. */
export function rowHasChoices(key: string, c: RowContext & { subs: Record<string, string[]> }): boolean {
  if (key.startsWith('i:')) return (c.subs[key.slice(2)] ?? []).length > 0;
  if (key.startsWith('b_')) return isNarrowed(c.bands, key.slice(2));
  if (key.startsWith('c_')) return !!c.care[key.slice(2)]?.o.length;
  if (key === 'who') return c.who.length > 0;
  if (key === 'origin') return !!c.home;
  if (key === 'vibes') return c.vibes.length > 0;
  if (key === 'when') return c.month != null;
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
  for (const item of careItemsFor('dna')) {
    const v = c.care[item.key];
    if (!v) continue;
    out.push(`${item.icon} ${item.name}${v.o.length ? `: ${v.o.map((o) => item.options?.find((x) => x[0] === o)?.[1] ?? o).join(', ')}` : ''}${v.firm ? ' · must' : ''}`);
  }
  return out.length ? out : ['Open to anything so far'];
}
