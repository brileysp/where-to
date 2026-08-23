import { applySwipeToProfile } from '@/lib/dna/profile';
import { applyDimensionSignalsFromSwipe, createInitialDimensionState } from '@/lib/dna/dimensions';
import { createInitialDNAState } from '@/lib/dna/state';
import type { DnaCard, DnaState, SwipeType } from '@/lib/dna/types';
import { cards, dimensions, legacy, mulberry32 } from './fixtures';

/** Fresh state pair — legacy's own createInitialDNAState() vs. the new port's, given identical dimensions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createStatePair(): { legacyState: any; newState: DnaState } {
  return {
    legacyState: legacy.createInitialDNAState(),
    newState: createInitialDNAState(dimensions),
  };
}

/**
 * Applies one swipe to BOTH engines' state identically, using each side's
 * own ported functions (not shared code) — this is the actual thing under
 * test. Mirrors the bookkeeping dna-ui.js's handleSwipe does around the
 * pure functions (swipeCount, answeredCardIds, swipes list).
 */
export function applySwipeBothSides(
  legacyState: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  newState: DnaState,
  cardId: string,
  swipeType: SwipeType,
  timestamp = 0,
) {
  // Both sides read the same adapted card object — it carries every field
  // (id, preferenceSignals, dimensionSignals) either applySwipeToProfile
  // implementation needs, legacy or new.
  const card = cards.find((c) => c.id === cardId) as DnaCard;

  const updatedLegacy = {
    ...legacyState,
    profile: legacy.applySwipeToProfile(legacyState.profile, card, swipeType),
    dimensionState: legacy.applyDimensionSignalsFromSwipe(legacyState.dimensionState, card, swipeType),
    swipes: [...legacyState.swipes, { cardId, type: swipeType, timestamp }],
    answeredCardIds: [...legacyState.answeredCardIds, cardId],
    swipeCount: legacyState.swipeCount + 1,
  };

  const updatedNew: DnaState = {
    ...newState,
    profile: applySwipeToProfile(newState.profile, card, swipeType),
    dimensionState: applyDimensionSignalsFromSwipe(newState.dimensionState, card, swipeType, dimensions),
    swipes: [...newState.swipes, { cardId, type: swipeType, timestamp }],
    answeredCardIds: [...newState.answeredCardIds, cardId],
    swipeCount: newState.swipeCount + 1,
  };

  return { legacyState: updatedLegacy, newState: updatedNew };
}

/**
 * Strips profile keys that only exist in the new engine (added for
 * Cycling's core-axis branch specialty subdimensions — see
 * DOMAIN_CORE_AXES in domains.ts) before an exact-diff comparison against
 * the legacy engine, which predates them and initializes none of them.
 * Restricting to legacy's own key set is equivalent to asserting every
 * new key is still exactly 0 unless a test deliberately swipes on one.
 */
export function withoutNewProfileAttributes(
  profile: Record<string, number>,
  legacyProfile: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  Object.keys(legacyProfile).forEach((k) => {
    result[k] = profile[k] ?? 0;
  });
  return result;
}

/** Deterministic (non-random) "realistic" swipe sequence: cycles through cards, varying swipe type by index. */
export function scriptedSwipeSequence(n: number, offset = 0): Array<{ cardId: string; swipeType: SwipeType }> {
  const types: SwipeType[] = ['yes', 'love', 'no', 'yes', 'yes', 'no', 'love', 'yes'];
  const seq: Array<{ cardId: string; swipeType: SwipeType }> = [];
  for (let i = 0; i < n; i++) {
    const card = cards[(i + offset) % cards.length];
    seq.push({ cardId: card.id, swipeType: types[i % types.length] });
  }
  return seq;
}

export { cards, dimensions, legacy, mulberry32 };
export { domains, tensions } from './fixtures';
export { createInitialDimensionState };
