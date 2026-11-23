import { SETTING_TAGS } from '@/lib/places/setting-tags';

/**
 * The kinds of place a traveler can say they want (owner, 22 Nov 2026). They are the places' own setting tags (src/lib/places/setting-tags.ts: what a place is LIKE,
 * 1 to 4 per place, already filled in for all 200), so the choice needs no new data. Everything is on to start; a kind turned off leaves out the places that
 * have none of the kinds still on. A place with no tags is never left out. "National parks" is not a kind: it is an interest.
 */
export interface PlaceTypeChoice {
  key: string;
  label: string;
  icon: string;
}

export const PLACE_TYPES: PlaceTypeChoice[] = SETTING_TAGS.map((t) => ({ key: t.slug, label: t.label, icon: t.emoji }));

export const ALL_PLACE_TYPES: string[] = PLACE_TYPES.map((t) => t.key);

/** Everything on (an empty list is how a saved choice says "all"). */
export const allPlaceTypes = (on: readonly string[] | null | undefined): boolean => !on || on.length === 0 || ALL_PLACE_TYPES.every((k) => on.includes(k));

/** The kinds as the pills show them: a saved "all" (empty list) becomes every kind. */
export const kindsOrAll = (saved: readonly string[] | null | undefined): string[] => (allPlaceTypes(saved) ? [...ALL_PLACE_TYPES] : [...saved!]);

/** The kinds as they are saved: everything on is an empty list. */
export const kindsToSave = (on: readonly string[]): string[] => (allPlaceTypes(on) ? [] : [...on]);

/** Tapping a kind turns it off (or back on). At least one stays on, so the list can never be empty. */
export function togglePlaceType(on: readonly string[], key: string): string[] {
  if (on.includes(key)) return on.length === 1 ? [...on] : on.filter((k) => k !== key);
  return ALL_PLACE_TYPES.filter((k) => on.includes(k) || k === key);
}

/** Whether a place with these tags stays: always when everything is on or the place has no tags, otherwise when at least one of its tags is on. */
export const placeTypeAllows = (on: readonly string[] | null | undefined, tags: readonly string[] | null | undefined): boolean =>
  allPlaceTypes(on) || !tags || tags.length === 0 || tags.some((t) => on!.includes(t));

/** The words for the row: "Any", or the kinds left in ("City, Island"), or "All except ..." when only a couple are off. */
export function placeTypesText(on: readonly string[] | null | undefined): string {
  if (allPlaceTypes(on)) return 'Any';
  const kept = PLACE_TYPES.filter((t) => on!.includes(t.key));
  const off = PLACE_TYPES.filter((t) => !on!.includes(t.key));
  return off.length <= 2 ? `All except ${off.map((t) => t.label).join(', ')}` : kept.map((t) => t.label).join(', ');
}
