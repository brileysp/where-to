import type { DimensionDef, DimensionResult, DimensionState, DnaCard, DnaState, SwipeType } from './types';
import { SWIPE_WEIGHTS } from './profile';

// Ported verbatim from traveldna.js:163-289 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

export function createInitialDimensionState(dimensions: DimensionDef[]): DimensionState {
  const raw: Record<string, number> = {};
  dimensions.forEach((def) => {
    raw[def.keyA] = 0;
    raw[def.keyB] = 0;
  });
  const evidenceCardIds: Record<string, string[]> = {};
  dimensions.forEach((def) => {
    evidenceCardIds[def.id] = [];
  });
  return { raw, evidenceCardIds };
}

/**
 * Applies one swipe's dimensionSignals onto a dimensionState and returns a
 * NEW dimensionState. Mirrors applySwipeToProfile's negative-signal
 * damping — a card that deliberately trades away one pole shouldn't have
 * that trade-away amplified by a 2.5x Love multiplier into "actively
 * hates X" — it's only evidence the pole wasn't the point of THIS
 * experience.
 */
export function applyDimensionSignalsFromSwipe(
  dimensionState: DimensionState,
  card: DnaCard,
  swipeType: SwipeType,
  dimensions: DimensionDef[],
): DimensionState {
  const weight = SWIPE_WEIGHTS[swipeType];
  if (weight === undefined) {
    return { raw: { ...dimensionState.raw }, evidenceCardIds: { ...dimensionState.evidenceCardIds } };
  }
  const raw = { ...dimensionState.raw };
  const evidenceCardIds = { ...dimensionState.evidenceCardIds };
  const signals = card.dimensionSignals || {};

  Object.entries(signals).forEach(([key, signal]) => {
    if (!(key in raw)) raw[key] = 0;
    const delta = swipeType === 'love' && signal < 0 ? signal * 1 : signal * weight;
    raw[key] += delta;
  });

  dimensions.forEach((def) => {
    if (def.keyA in signals || def.keyB in signals) {
      const existing = evidenceCardIds[def.id] || [];
      if (!existing.includes(card.id)) {
        evidenceCardIds[def.id] = [...existing, card.id];
      }
    }
  });

  return { raw, evidenceCardIds };
}

/**
 * Deep-dive cards are domain-specific by design — a birding deep card
 * tells you HOW someone likes to bird, not their general travel
 * psychology. The general cross-domain Dimensions (Strongest Travel
 * Signals) are meant to reflect travel preferences at large, so only
 * broad cards get to move them; deep cards still feed the profile
 * (their own domain's slider) and that domain's recap, just not this.
 */
export function applyDimensionSignalsIfBroad(
  dimensionState: DimensionState,
  card: DnaCard,
  swipeType: SwipeType,
  dimensions: DimensionDef[],
): DimensionState {
  return card.stage === 'broad' ? applyDimensionSignalsFromSwipe(dimensionState, card, swipeType, dimensions) : dimensionState;
}

/**
 * How sure are we about a dimension's leading pole? Volume (enough
 * distinct cards tested it) AND skew (not a near-coin-flip split), each
 * alone a weak signal. Weighted 60/40 toward volume.
 */
export function calculateDimensionConfidence(evidenceCount: number, poleAScore: number): number {
  const volumeFactor = Math.min(1, evidenceCount / 8);
  const skewFactor = Math.abs(poleAScore - 50) / 50;
  return Math.round((volumeFactor * 0.6 + skewFactor * 0.4) * 100) / 100;
}

export function generateDimensionSummary(def: DimensionDef, leadingPole: string | null, status: string): string {
  if (status === 'unresolved' || !leadingPole) {
    return `Still building a read on ${def.label.toLowerCase()}.`;
  }
  return leadingPole === def.poleA ? def.summaryA : def.summaryB;
}

/**
 * Derives the full display-ready dimension array from raw state. Only the
 * POSITIVE portion of each pole's accumulator counts toward the
 * percentage split — a pole actively pushed negative pulls that pole's
 * share toward 0 rather than producing a negative percentage, while still
 * counting as real evidence the dimension was tested.
 */
export function calculateDimensionScores(dnaState: DnaState, dimensions: DimensionDef[]): DimensionResult[] {
  const state = dnaState.dimensionState || createInitialDimensionState(dimensions);
  return dimensions.map((def) => {
    const rawA = state.raw[def.keyA] || 0;
    const rawB = state.raw[def.keyB] || 0;
    const displayA = Math.max(0, rawA);
    const displayB = Math.max(0, rawB);
    const total = displayA + displayB;
    const poleAScore = total > 0 ? Math.round((100 * displayA) / total) : 50;
    const poleBScore = 100 - poleAScore;
    const evidenceCardIds = state.evidenceCardIds[def.id] || [];
    const confidence = calculateDimensionConfidence(evidenceCardIds.length, poleAScore);
    const leadingPole = poleAScore === poleBScore ? null : poleAScore > poleBScore ? def.poleA : def.poleB;
    const status: DimensionResult['status'] =
      confidence >= 0.6 && evidenceCardIds.length >= 4
        ? 'strong_signal'
        : confidence >= 0.35 && evidenceCardIds.length >= 2
          ? 'moderate_signal'
          : 'unresolved';
    return {
      id: def.id,
      label: def.label,
      poleA: def.poleA,
      poleB: def.poleB,
      poleAScore,
      poleBScore,
      leadingPole,
      confidence,
      evidenceCardIds,
      summary: generateDimensionSummary(def, leadingPole, status),
      status,
    };
  });
}

/** Top N resolved dimensions (moderate or strong), most confident first. */
export function getStrongestDimensions(dnaState: DnaState, dimensions: DimensionDef[], n = 5): DimensionResult[] {
  return calculateDimensionScores(dnaState, dimensions)
    .filter((d) => d.status !== 'unresolved')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, n);
}

/** Up to N unresolved dimensions, closest-to-resolving (most evidence) first. */
export function getUnresolvedDimensions(dnaState: DnaState, dimensions: DimensionDef[], n = 5): DimensionResult[] {
  return calculateDimensionScores(dnaState, dimensions)
    .filter((d) => d.status === 'unresolved')
    .sort((a, b) => b.evidenceCardIds.length - a.evidenceCardIds.length)
    .slice(0, n);
}
