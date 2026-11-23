// 13 Nov 2026: THE list of active interests for every report, status check, to-do maker and audit. Why it exists: scripts kept building their own list (the raw SLIDERS array, a table
// read from the database, a hand-typed `key !== 'roadtrip'`) and retired interests leaked into counts and "missing" lists. The owner adds and retires interests from the admin
// (interest_meta.hidden), so the answer is code defaults PLUS those admin overrides, read fresh; nothing here lists a retired interest by name.
import { SLIDERS, VISIBLE_SLIDERS } from './constants';
import { applyOverrides, type Overrides } from './overrides';

export interface ActiveInterest { key: string; label: string; group: string }

/** Applies the given admin overrides to the shared interest list and returns the interests that are still active. Pure apart from that shared in-place update. */
export function activeInterestsWith(overrides: Overrides): ActiveInterest[] {
  applyOverrides(overrides);
  return VISIBLE_SLIDERS.map((s) => ({ key: s.key, label: s.label, group: s.group }));
}

/** The active interests right now: built-in list with the admin's overrides (hidden / unhidden, renamed, regrouped) from the database. Use this, not SLIDERS. */
export async function getActiveInterests(): Promise<ActiveInterest[]> {
  const { loadOverrides } = await import('./overridesServer');
  return activeInterestsWith(await loadOverrides());
}

export async function activeInterestKeys(): Promise<string[]> {
  return (await getActiveInterests()).map((i) => i.key);
}

/** Every interest the code knows, retired ones included, for the rare tool that must see stored data of retired interests. Name the reason where you call it. */
export function allKnownInterestKeys(): string[] {
  return SLIDERS.map((s) => s.key);
}
