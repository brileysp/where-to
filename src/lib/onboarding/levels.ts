import { getOnboardingSettings, type InterestLevelId } from './settings';

/**
 * Interest levels during onboarding (docs/onboarding-v2/SPEC.md 4.4, 4.5, 8.1). Only Like and Top are set here; Curious, Love and Off
 * are chosen later on the Travel DNA page. Saved as 0 to 10 weights through the settings.
 */

export type Levels = Record<string, InterestLevelId>;

export const LEVEL_LABELS: Record<InterestLevelId, string> = { off: 'Off', cur: 'Curious', like: 'Like', love: 'Love', top: 'Top' };

export const weightOf = (level: InterestLevelId): number => getOnboardingSettings().levelWeights[level];

/** Tapping an interest box picks it (as Like) or drops it. */
export function togglePick(levels: Levels, key: string): Levels {
  const next = { ...levels };
  if (next[key]) delete next[key];
  else next[key] = 'like';
  return next;
}

export const topCount = (levels: Levels): number => Object.values(levels).filter((l) => l === 'top').length;

/**
 * Tapping a row on the Top interests screen. A top interest goes back to Like; anything else becomes Top, unless five are already Top,
 * in which case nothing changes and `blocked` says to show the popup.
 */
export function toggleTop(levels: Levels, key: string): { levels: Levels; blocked: boolean } {
  if (levels[key] === 'top') return { levels: { ...levels, [key]: 'like' }, blocked: false };
  if (topCount(levels) >= getOnboardingSettings().maxTopInterests) return { levels, blocked: true };
  return { levels: { ...levels, [key]: 'top' }, blocked: false };
}

/** Highest weight first; equal weights keep the order they were picked in. */
export function orderedByLevel(levels: Levels): string[] {
  return Object.keys(levels).sort((a, b) => weightOf(levels[b]) - weightOf(levels[a]));
}

/** Toggle one specific ("What kind?" chip) for an interest. */
export function toggleSpecific(subs: Record<string, string[]>, interest: string, chip: string): Record<string, string[]> {
  const cur = subs[interest] ?? [];
  const next = cur.includes(chip) ? cur.filter((c) => c !== chip) : [...cur, chip];
  return { ...subs, [interest]: next };
}

/** The five levels on the Travel DNA page, in order. */
export const LEVEL_ORDER: InterestLevelId[] = ['off', 'cur', 'like', 'love', 'top'];

/**
 * Setting a level on the Travel DNA page (spec 4.11). Off removes the interest. Top is refused (`blocked`) when five are already Top, unless
 * it already is one. Any change other than Off should open the interest's card; Off should close it.
 */
export function setLevel(levels: Levels, key: string, level: InterestLevelId): { levels: Levels; blocked: boolean; open: boolean } {
  if (level === 'off') {
    const next = { ...levels };
    delete next[key];
    return { levels: next, blocked: false, open: false };
  }
  if (level === 'top' && levels[key] !== 'top' && topCount(levels) >= getOnboardingSettings().maxTopInterests) return { levels, blocked: true, open: false };
  return { levels: { ...levels, [key]: level }, blocked: false, open: true };
}
