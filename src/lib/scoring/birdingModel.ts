/**
 * The birding score model, as a pure function — the same arithmetic as
 * scripts/audit-birding-model.ts (which keeps its own copy because it is a
 * standalone audit script). Used by the Birding page's "Try it" calculator.
 * Not read by the live scoring engine.
 *
 *   base  = 0.50 × species-count curve + 0.25 × endemism + 0.25 × charisma
 *   score = base × (1 + 0.25 × spectacle/10) × (1 + 0.25 × lineage/10), capped at 10
 */
export const BIRDING_N_MIN = 40;
export const BIRDING_N_MAX = 1600;

export interface BirdingModelInput {
  /** approximate species total for the destination's own scope */
  species: number;
  /** endemism at species level, 0-10 */
  endemism: number;
  /** how spectacular the birds are to look at, 0-10 */
  charisma: number;
  /** mass concentration: colonies, migration bottlenecks, roosts, 0-10 */
  spectacle: number;
  /** family-level endemism, 0-10 */
  lineage: number;
}

/** Species richness on a log curve between 40 and 1,600 species, 0-10. */
export function birdingCountScore(species: number): number {
  const v = (10 * (Math.log(species) - Math.log(BIRDING_N_MIN))) / (Math.log(BIRDING_N_MAX) - Math.log(BIRDING_N_MIN));
  return Math.max(0, Math.min(10, v));
}

export function birdingModel(input: BirdingModelInput) {
  const count = birdingCountScore(input.species);
  const base = 0.5 * count + 0.25 * input.endemism + 0.25 * input.charisma;
  const spectacleBoost = 1 + 0.25 * (input.spectacle / 10);
  const lineageBoost = 1 + 0.25 * (input.lineage / 10);
  const raw = base * spectacleBoost * lineageBoost;
  return { count, base, spectacleBoost, lineageBoost, raw, score: Math.min(10, raw), capped: raw > 10 };
}
