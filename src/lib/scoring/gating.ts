import type { ScoringDestination } from './types';

/**
 * Specialist ("gated") places — see the "Specialist places" proposal. A gated place is scored like any other, but is left
 * out of a traveller's results list unless their own weight for at least one of the place's gated interests reaches this
 * number (weights run 1–10; an untouched interest sits at 2). Searching for a gated place by name always finds it.
 */
export const GATE_MIN_WEIGHT = 7;

type Gateable = Pick<ScoringDestination, 'gated' | 'gatedInterests'>;

/** Interests that currently unlock this place for these weights (empty for an ungated place). */
export function unlockingInterests(d: Gateable, weights: Record<string, number>): string[] {
  if (!d.gated) return [];
  return (d.gatedInterests ?? []).filter((k) => (weights[k] ?? 0) >= GATE_MIN_WEIGHT);
}

/**
 * Whether the place belongs in this traveller's list. A place marked gated with no interests picked yet is not hidden:
 * the interest column is what makes the gate real, so a half-finished setting can never make a place vanish for everyone.
 */
export function isVisibleForWeights(d: Gateable, weights: Record<string, number>): boolean {
  if (!d.gated || !d.gatedInterests?.length) return true;
  return unlockingInterests(d, weights).length > 0;
}
