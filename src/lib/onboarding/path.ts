import { getOnboardingSettings } from './settings';

/**
 * Which screens a person sees, and in what order (docs/onboarding-v2/SPEC.md, sections 2 and 4.1). Pure functions: the screens only draw
 * what these say.
 */

export type ScreenId =
  | 'door'
  | 'when'
  | 'logistics'
  | 'love'
  | 'rank'
  | 'essentials'
  | 'vibes'
  | 'results'
  | 'dnabasics'
  | 'cards'
  | 'dnasum'
  | 'saved'
  | 'welcome';

export type FlowMode = 'trip' | 'dna';

/** The first screen's two A-or-B questions. In each pair at most one is on. */
export interface Doors {
  love: boolean;
  open: boolean;
  window: boolean;
  flex: boolean;
}

export type DoorKey = keyof Doors;

export const emptyDoors = (): Doors => ({ love: false, open: false, window: false, flex: false });

/** Tapping a tile turns it on and turns its partner off. Tapping the one that is already on keeps it on. */
export function chooseDoor(doors: Doors, key: DoorKey): Doors {
  if (key === 'love' || key === 'open') return { ...doors, love: key === 'love', open: key === 'open' };
  return { ...doors, window: key === 'window', flex: key === 'flex' };
}

/** Continue needs an answer to both questions. */
export const canContinueFromDoor = (d: Doors): boolean => (d.love || d.open) && (d.window || d.flex);

/**
 * The person's own screens, in order.
 *  - Travel DNA path (the small link on the first screen): interests, top interests, basics, cards, the DNA page.
 *  - Something I love to do: interests and top interests come first, then the timing screens (When, and Getting there for a specific
 *    window), then the basics. Whatever the timing, interests lead.
 *  - A great trip with a specific time window: the timing screens first, because the window decides what can be ranked, then the basics and
 *    the photo picks.
 *  - A great trip with flexible timing: the basics and the photo picks first, then the month last.
 */
export function buildPath(mode: FlowMode, doors: Doors): ScreenId[] {
  if (mode === 'dna') return ['love', 'rank', 'dnabasics', 'cards', 'dnasum'];
  const timing: ScreenId[] = doors.window ? ['when', 'logistics'] : doors.flex ? ['when'] : [];
  if (doors.love) return ['door', 'love', 'rank', ...timing, 'essentials'];
  if (doors.window) return ['door', ...timing, 'essentials', 'vibes'];
  return ['door', 'essentials', 'vibes', ...timing];
}

/** Where Continue goes. At the end of a trip path it is the shortlist; the Travel DNA path ends on its own last screen. */
export function nextScreen(mode: FlowMode, doors: Doors, current: ScreenId): ScreenId | null {
  const p = buildPath(mode, doors);
  const i = p.indexOf(current);
  if (i >= 0 && i < p.length - 1) return p[i + 1];
  return mode === 'trip' ? 'results' : null;
}

export type BackTarget = { kind: 'screen'; screen: ScreenId } | { kind: 'restart' } | { kind: 'none' };

/** Where Back goes. Back from the first Travel DNA screen starts over at the first screen. */
export function backTarget(mode: FlowMode, doors: Doors, current: ScreenId): BackTarget {
  const p = buildPath(mode, doors);
  const i = p.indexOf(current);
  if (i > 0) return { kind: 'screen', screen: p[i - 1] };
  if (mode === 'dna') return { kind: 'restart' };
  return { kind: 'none' };
}

/** Percent of the progress bar. The first screen shows a fixed share, because the path is not known until it is answered. */
export function progressPercent(mode: FlowMode, doors: Doors, current: ScreenId): number {
  if (current === 'door') return getOnboardingSettings().doorProgressPercent;
  // The returning traveler's two questions: halfway.
  if (current === 'welcome') return 50;
  const p = buildPath(mode, doors);
  const i = p.indexOf(current);
  if (i < 0) return 100;
  return Math.round(((i + 1) / p.length) * 100);
}
