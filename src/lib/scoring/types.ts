/**
 * Shapes match the legacy vanilla-JS app (data.js) field-for-field so the
 * ported scoring functions in destinations.ts/blurb.ts/rank.ts can be
 * near-verbatim ports rather than rewrites. `toScoringDestination` in
 * db.ts is the (separate, simple, auditable) adapter from a Postgres row
 * to this shape.
 */

export interface Slider {
  key: string;
  label: string;
  icon: string;
  group: string;
  formula: string;
}

export interface Persona {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  primary: string[];
  weights: Record<string, number>;
}

export interface Band {
  key: string;
  label: string;
}

export interface BandDimension {
  key: string;
  label: string;
  icon: string;
  bands: Band[];
}

export type PeakIntensity = 'mild' | 'moderate' | 'extreme';

export interface SpecialSeason {
  months: number[];
  text: string;
}

/**
 * A named seasonal driver behind a slider's score — e.g. wildlife at a
 * narrow-window destination might have separate "Polar bears" (weight 7,
 * full swing) and "Beluga whales" (weight 3.5, half swing) events, each
 * with its own month-by-month intensity (0-1, sparse — an absent month is
 * 0). `weight` is a direct point value (not a 0-1 fraction) so different
 * events can carry different maximum swings without a shared global scale.
 */
export interface SliderEvent {
  label: string;
  weight: number;
  months: Partial<Record<number, number>>;
}

export interface ScoringDestination {
  id: string;
  name: string;
  region: string;
  emoji: string;
  climate: string;
  about: string;
  // One-sentence evergreen "why go here" pitch — null for destinations not
  // yet backfilled, in which case the UI falls back to `about`.
  overview: string | null;
  // Regional cost floor/ceiling, $–$$$$$ — null means not yet authored;
  // the UI hides the cost pill/tab rather than showing a fake range.
  costRange: { min: string; max: string } | null;
  // One-sentence texture on what costs are like here — shown on the Cost
  // tab above the price list. Distinct from `overview` (why go), not the
  // $–$$$$$ range itself (that's costRange) or an itemized price (costItems).
  costOverview: string | null;
  // Real one-time/per-day prices, author-sorted low to high. Empty for
  // destinations not yet backfilled.
  costItems: { label: string; price: number; unit: string }[];
  base: Record<string, number>;
  budgetBands: string[];
  vibeBands: string[];
  physicalBands: string[];
  dry: number[];
  wet: number[];
  hot: number[];
  cold: number[];
  peak: number[];
  low: number[];
  peakIntensity: PeakIntensity | null;
  wildlifePeak: number[];
  wildlifeClosed: number[];
  birdingPeak: number[];
  hikingBest: number[];
  hikingWorst: number[];
  inaccessible: number[];
  swimHazard: number[];
  // Months with no real snow on the ground — distinct from `cold`/`hot`,
  // which are generic weather flags an author may never think to set for
  // a destination whose *winter* is the whole point (a ski town's summer
  // months often have no `hot`/`dry` flag at all, since summer there is
  // still mild, not hot/dry by the destination's own climate norms — see
  // the snowsports case in destinations.ts for why that silently left
  // Aspen/Whistler-style destinations at their peak score year-round).
  noSnow: number[];
  // Sparse per-slider ceiling, e.g. { wildlife: 4 } — a destination whose
  // peak-month score would otherwise overstate how genuinely good it is
  // for that interest (see the `cap` comment in destinations.ts). Absent
  // key = no cap, the formula's own math is the ceiling as before.
  sliderCaps: Record<string, number>;
  // Sparse per-slider list of named seasonal drivers — lets one slider
  // express real multi-tier seasonality (peak/shoulder/off, plus
  // independently-weighted secondary draws like whales alongside bears)
  // instead of a single flat peak-month bonus. Absent/empty key = the
  // slider falls back to its legacy single-peak-flag formula, unchanged.
  sliderEvents: Record<string, SliderEvent[]>;
  shopClosures: boolean;
  specialSeasons: SpecialSeason[];
  monthlyWeather: (string | null)[] | null;
  naSliders: string[];
  searchAliases: string[];
  // Per-slider sub-style quality — see the schema.ts column comment for
  // the full rationale. Sparse: a slider or style absent here is treated
  // as if every style were 'none' once a caller actually asks for it.
  activityStyleTiers: Record<string, Record<string, 'signature' | 'strong' | 'casual' | 'none'>>;
}

export interface Badge {
  label: string;
  tone: 'good' | 'warn' | 'bad';
}

export interface DerivedScores {
  monthly: Record<string, number[]>; // 12-entry array per slider key
  badges: Badge[][]; // 12 entries, each an array of badges for that month
  weatherBand: string[]; // 12 entries: 'cold' | 'cool' | 'warm' | 'hot'
}

/** A destination with its derived per-month scores attached — the
 * TypeScript equivalent of the legacy app's `DESTINATIONS` (vs. `RAW_DESTINATIONS`). */
export type ScoredDestination = ScoringDestination & DerivedScores;
