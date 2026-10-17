import type { InterestChipDriver, InterestFactValue } from '@/lib/db/schema';
import { bestOdds, LIKELIHOODS, type FactDef } from './config';

/**
 * Sub-interest chips (Day hikes, Wrecks, Orcas...). A chip is a traveler's word; its drivers are the research columns that say how well a
 * place fits it. The fit is worked out here whenever it is needed and is never stored.
 *
 *   rating column   the rating as it is (0 to 10)
 *   count column    the count, reaching 10 at the number you set (fullAt)
 *   sighting grid   guaranteed 10, likely 8, possible 5, unlikely 2, not present 0
 *   animals text    the best odds named in the cell, scored the same way
 *   tick column     10 when ticked, 0 when not
 *   choice / multi  10 when the chosen option is there, 0 when it is not
 *
 * A chip's fit for a place is its best driver. No data for any driver means no fit (null), never a zero.
 */

export const MAX_LIVE_CHIPS = 5;
export const MAX_DRIVERS = 4;

const ODDS_FIT: Record<number, number> = { 4: 10, 3: 8, 2: 5, 1: 2 };
const LIKELIHOOD_FIT: Record<string, number> = { guaranteed: 10, likely: 8, possible: 5, unlikely: 2, notPresent: 0 };

/** Which columns can drive a chip. Notes, lists, the draw and the source-checked tick cannot. */
export function canDrive(def: FactDef): boolean {
  if (def.hidden) return false;
  if (def.key === 'drawSourceChecked') return false;
  switch (def.type) {
    case 'rating':
    case 'int':
    case 'likelihood':
    case 'bool':
    case 'choice':
    case 'multi':
      return true;
    case 'text':
      return !!def.animals;
    default:
      return false;
  }
}

export const needsOption = (def: FactDef) => def.type === 'choice' || def.type === 'multi';

/** A driver that is complete and points at a real column (an option where one is needed, a full-at number for counts). */
export function driverProblem(d: InterestChipDriver, defs: FactDef[]): string | null {
  const def = defs.find((x) => x.key === d.column);
  if (!def) return 'That column no longer exists.';
  if (!canDrive(def)) return `${def.label} cannot drive a chip.`;
  if (needsOption(def) && !(def.options ?? []).some((o) => o.value === d.option)) return `Pick which option of ${def.label} counts.`;
  if (def.type === 'int' && !(typeof d.fullAt === 'number' && d.fullAt > 0)) return `Set the number at which ${def.label} counts as 10.`;
  return null;
}

/** Facts that count as the place having been looked at: any value at all in the interest's columns. */
const hasAnyFact = (facts: Record<string, InterestFactValue>) => Object.keys(facts).length > 0;

export function driverFit(d: InterestChipDriver, defs: FactDef[], facts: Record<string, InterestFactValue>): number | null {
  const def = defs.find((x) => x.key === d.column);
  if (!def || !hasAnyFact(facts)) return null;
  const v = facts[d.column];
  switch (def.type) {
    case 'rating':
      return typeof v === 'number' ? Math.max(0, Math.min(10, v)) : null;
    case 'int':
      return typeof v === 'number' && d.fullAt ? Math.min(10, (v / d.fullAt) * 10) : null;
    case 'likelihood':
      return typeof v === 'string' && v in LIKELIHOOD_FIT ? LIKELIHOOD_FIT[v] : null;
    case 'text': {
      // "Animal (likelihood, months)" cells. An empty cell means the animal is not a feature here; a cell with no odds in it says nothing.
      if (typeof v !== 'string' || v.trim() === '') return 0;
      const odds = bestOdds(v);
      return odds < 0 ? null : ODDS_FIT[odds];
    }
    case 'bool':
      // Only a tick is ever stored for the whale and wildlife ticks, so a missing one reads as not ticked.
      return v === true ? 10 : 0;
    case 'choice':
      return typeof v === 'string' && v !== '' ? (v === d.option ? 10 : 0) : null;
    case 'multi':
      return Array.isArray(v) && v.length > 0 ? (v.includes(d.option ?? '') ? 10 : 0) : null;
    default:
      return null;
  }
}

/** The best driver wins; null when no driver has data. */
export function chipFit(drivers: InterestChipDriver[], defs: FactDef[], facts: Record<string, InterestFactValue>): number | null {
  const fits = drivers.map((d) => driverFit(d, defs, facts)).filter((x): x is number => x !== null);
  return fits.length ? Math.max(...fits) : null;
}

export const roundFit = (n: number) => Math.round(n * 10) / 10;

/** One short line saying where a place's number came from, for the places list. */
export function fitBasis(drivers: InterestChipDriver[], defs: FactDef[], facts: Record<string, InterestFactValue>): string {
  const scored = drivers
    .map((d) => ({ d, f: driverFit(d, defs, facts) }))
    .filter((x): x is { d: InterestChipDriver; f: number } => x.f !== null)
    .sort((a, b) => b.f - a.f)[0];
  if (!scored) return 'No value yet';
  const def = defs.find((x) => x.key === scored.d.column)!;
  const v = facts[def.key];
  const optLabel = (def.options ?? []).find((o) => o.value === scored.d.option)?.label ?? scored.d.option ?? '';
  switch (def.type) {
    case 'rating':
    case 'int':
      return `${def.label} ${v}`;
    case 'likelihood':
      return `${def.label}: ${LIKELIHOODS.find((l) => l.value === v)?.label ?? v}`;
    case 'text':
      return typeof v === 'string' && v.trim() ? `${def.label}: ${v}` : `${def.label}: none recorded`;
    case 'bool':
      return `${def.label}: ${v === true ? 'yes' : 'not ticked'}`;
    case 'multi':
      return `${def.label}: ${scored.f === 10 ? 'includes' : 'does not include'} "${optLabel}"`;
    default:
      return `${def.label}: ${(def.options ?? []).find((o) => o.value === v)?.label ?? v}`;
  }
}

/** The words shown for a driver in the list ("What you can do: Easy walks", "Day-hike rating"). */
export function driverLabel(d: InterestChipDriver, defs: FactDef[]): string {
  const def = defs.find((x) => x.key === d.column);
  if (!def) return d.column;
  if (needsOption(def)) return `${def.label}: ${(def.options ?? []).find((o) => o.value === d.option)?.label ?? d.option ?? '?'}`;
  return def.label;
}

/** Stable key made from the label; the caller adds a number when it is already taken. */
export function chipKeyFor(label: string, taken: Set<string>): string {
  const base = label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'chip';
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}
