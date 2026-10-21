import { SLIDER_GROUPS, VISIBLE_SLIDERS, sliderState } from '@/lib/scoring/constants';
import { RELATED_INTERESTS } from './related-interests';
import { getOnboardingSettings } from './settings';

/**
 * The interest picker's data (docs/onboarding-v2/SPEC.md 4.4, 4.2.1 and 8). The interests are the app's own visible ones outside the
 * Value group, read at call time because admin overrides edit the shared arrays in place.
 */

export interface PickerGroup {
  name: string;
  icon: string;
}

const GROUP_ICONS: Record<string, string> = {
  'Nature & Wildlife': '🌿',
  'Sports & Recreation': '🥾',
  'Culture & Discovery': '🏛️',
  'Relaxation & Leisure': '🏖️',
};

/** The four categories, in tab order. */
export function pickerGroups(): PickerGroup[] {
  return SLIDER_GROUPS.filter((g) => g !== 'Value').map((name) => ({ name, icon: GROUP_ICONS[name] ?? '•' }));
}

export interface PickerInterest {
  key: string;
  label: string;
  icon: string;
  group: string;
  tier: string;
  /** Position in the app's own list, the final tiebreak. */
  index: number;
}

/** Shorter names for three long labels (SPEC 8.2). */
const DISPLAY_LABELS: Record<string, string> = {
  yogaRetreats: 'Yoga & Wellness',
  wildflowerBlooms: 'Blooms & Colors',
  mountaineering: 'Climbing & Mountaineering',
};

const TIER_ORDER: Record<string, number> = { iconic: 0, popular: 1, enthusiast: 2, specialist: 3 };

let cache: { version: number; list: PickerInterest[] } | null = null;

/** Every pickable interest, in the app's order. */
export function pickerInterests(): PickerInterest[] {
  if (cache && cache.version === sliderState.version) return cache.list;
  const list = VISIBLE_SLIDERS.filter((s) => s.group !== 'Value').map((s, index) => ({
    key: s.key,
    label: DISPLAY_LABELS[s.key] ?? s.label,
    icon: s.icon,
    group: s.group,
    tier: s.audienceTier ?? 'enthusiast',
    index,
  }));
  cache = { version: sliderState.version, list };
  return list;
}

export function interestByKey(key: string): PickerInterest | undefined {
  return pickerInterests().find((i) => i.key === key);
}

/** One category's interests: the fixed first eight, then the rest by audience tier and then the app's own order. */
export function interestsInGroup(group: string): PickerInterest[] {
  const all = pickerInterests().filter((i) => i.group === group);
  const primary = (getOnboardingSettings().primaryInterests[group] ?? [])
    .map((k) => all.find((i) => i.key === k))
    .filter((i): i is PickerInterest => !!i);
  const rest = all.filter((i) => !primary.includes(i)).sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.index - b.index);
  return [...primary, ...rest];
}

/**
 * "People who pick these often add": each picked interest scores its neighbours 5, 4, 3 ... by rank; the strongest not-yet-picked ones
 * win. Neighbours that are not in the picker are skipped.
 */
export function relatedFor(picked: string[]): PickerInterest[] {
  const have = new Set(picked);
  const score = new Map<string, number>();
  for (const k of picked) {
    (RELATED_INTERESTS[k] ?? []).forEach((o, ix) => {
      if (!have.has(o) && interestByKey(o)) score.set(o, (score.get(o) ?? 0) + (6 - ix));
    });
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, getOnboardingSettings().relatedSuggestions)
    .map(([k]) => interestByKey(k)!);
}

/**
 * The category named by the "Continue to ..." button: the first one, in tab order after the current one, that has never been opened.
 * Null once every category has been opened.
 */
export function nextUnseenGroup(order: string[], current: string, seen: Record<string, boolean>): string | null {
  const i = order.indexOf(current);
  const ring = [...order.slice(i + 1), ...order.slice(0, Math.max(i, 0))];
  return ring.find((g) => !seen[g]) ?? null;
}
