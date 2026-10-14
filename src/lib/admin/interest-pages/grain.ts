/**
 * Place grain: is a place the right size to choose between? The same scale used for the 200-place Place Grain Review
 * (the four tests: the decision test, the sibling test, the honest-score test and the visit-once test).
 * -2 or lower = too specific, -1 = slightly specific, 0 = just right, 1 = slightly broad, 2 or higher = too broad.
 */
export const GRAIN_VALUES = [-2, -1, 0, 1, 2] as const;

export function grainLabel(s: number): { label: string; tone: 'spec' | 'ok' | 'broad' } {
  if (s <= -2) return { label: 'Too specific', tone: 'spec' };
  if (s === -1) return { label: 'Slightly specific', tone: 'spec' };
  if (s === 0) return { label: 'Just right', tone: 'ok' };
  if (s === 1) return { label: 'Slightly broad', tone: 'broad' };
  return { label: 'Too broad', tone: 'broad' };
}
