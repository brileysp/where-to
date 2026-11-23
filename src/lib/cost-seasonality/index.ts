import cards from './cards.generated.json';

/**
 * The cost seasonality card on the Cost tab (owner approved 19 Nov 2026): one sentence, a one-word badge and 52 weekly bars.
 * The data is generated from the reviewed drafts by scripts/cost-seasonality/export_app_data.py (see that folder's README) and keyed by place key.
 * Places scored below Fair have no card and the Cost tab shows nothing for them.
 */
export type CostSeasonalityBadge = 'Flat' | 'Mild' | 'Moderate' | 'High' | 'Extreme';

export interface CostSeasonality {
  /** The sentence. */
  s: string;
  /** The one-word badge at the top right of the card. */
  b: CostSeasonalityBadge;
  /** 52 bars, each a percent of the tallest week; null is a week when most hotels are closed. */
  w: Array<number | null>;
  /** Weeks drawn faded because some (not most) hotels are closed. */
  p: number[];
  /** Where the dashed average-price line sits, as a percent of the tallest week. */
  a: number;
}

const CARDS = cards as unknown as Record<string, CostSeasonality>;

/** The card for one place (its key, e.g. p0001), or null when there is none. */
export function costSeasonalityFor(placeKey: string): CostSeasonality | null {
  return CARDS[placeKey] ?? null;
}

export function allCostSeasonalityKeys(): string[] {
  return Object.keys(CARDS);
}

export const COST_SEASONALITY_KEY =
  'Flat: under 1.1x. Mild: up to 1.3x. Moderate: up to 1.6x. High: up to 2x. Extreme: over 2x. This is how much more many hotels cost in the busy months than in the quiet ones.';

export const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
/** Where each month's letter sits under the 52 weeks, as a percent of the width (day of year at mid-month over 365). */
export const MONTH_LABEL_POSITIONS = [15.5, 45, 74.5, 105, 135.5, 166, 196.5, 227.5, 258, 288.5, 319, 349.5].map((d) => (d / 365) * 100);
