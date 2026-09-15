/**
 * Shapes match the legacy vanilla-JS app (data.js) field-for-field so the
 * ported scoring functions in destinations.ts/blurb.ts/rank.ts can be
 * near-verbatim ports rather than rewrites. `toScoringDestination` in
 * db.ts is the (separate, simple, auditable) adapter from a Postgres row
 * to this shape.
 */

/**
 * How much of the travelling public picks a destination at least partly
 * because of this interest — a property of the INTEREST itself, constant
 * across destinations (unlike signatureTier, which is per-destination).
 * Beaches are iconic; golf is enthusiast. Used to weight a destination's
 * own strengths in the default, no-stated-preference view: being superb at
 * something few people travel for shouldn't read as broad appeal.
 */
export type AudienceTier = 'iconic' | 'popular' | 'enthusiast' | 'specialist';

export interface Slider {
  key: string;
  label: string;
  icon: string;
  group: string;
  formula: string;
  audienceTier: AudienceTier;
  // True for an interest still scored/stored like any other (never touches
  // scoring math — see VISIBLE_SLIDERS in constants.ts), but pulled from
  // every admin and public-app screen that lists/picks interests. Data
  // stays intact; this is a display-only retirement, not a delete.
  hidden?: boolean;
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
export type CrowdBaseline = 'low' | 'high';

export interface SpecialSeason {
  months: number[];
  text: string;
}

// How bad a hot/cold/wet month or hazard genuinely is — the missing
// gradient that let e.g. Andalucía's 40°C+ August and Kruger's light,
// birding-boosting rain both read as an undifferentiated flag with no way
// to tell "mildly notable" from "a real reason to avoid this month."
// Absent (null) means "not yet classified" and behaves exactly like
// 'moderate' did before this field existed — a zero-regression default
// until a destination is hand-reviewed, matching peakIntensity's own
// absent-is-moderate convention.
export type Severity = 'mild' | 'moderate' | 'severe';

export type HazardCategory = 'storm' | 'airQuality' | 'insects' | 'seaweed' | 'other';

/**
 * A named seasonal downside that isn't temperature or rain — hurricane
 * season, smog, biting insects, sargassum — none of which the legacy
 * hot/cold/wet/dry flags can express. Unlike those blanket flags, a hazard
 * only penalizes the specific sliders it actually affects (a hurricane
 * risk hits swimming/sailing, not museums), so a destination can have a
 * real, badge-worthy hazard without every interest reading as worse.
 */
export interface SeasonalHazard {
  category: HazardCategory;
  label: string;
  months: number[];
  severity: Severity;
  affectedSliders: string[];
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
  crowdBaseline: CrowdBaseline | null;
  // How severe this destination's hot/cold/wet flags genuinely are, in the
  // months they're set — see the Severity doc comment. Null = not yet
  // classified, treated as 'moderate' (today's flat behavior) everywhere.
  hotSeverity: Severity | null;
  coldSeverity: Severity | null;
  wetSeverity: Severity | null;
  // Named downsides the legacy weather flags can't express (hurricanes,
  // smog, insects, seaweed) — see the SeasonalHazard doc comment.
  seasonalHazards: SeasonalHazard[];
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
  // Destination-level identity prominence per slider — see the schema.ts
  // column comment. Read by isTimingExceptionSlider (rank.ts) to decide
  // whether a slider can lift a month's score above the weather-comfort
  // baseline — authoritative where authored, falling back to the old
  // formula-based heuristic where it isn't (see that function's own
  // comment for which sliders still aren't backfilled).
  signatureTier: Record<string, 'signature' | 'strong' | 'casual' | 'none'>;
  // An admin-set exact score for one slider in one specific month —
  // highest precedence in deriveDestinationScores's monthly computation,
  // above both sliderEvents and the base formula. Sparse: { wildlifeViewing:
  // { 9: 10 } } means "October (index 9) is exactly a 10"; every other
  // month/slider combination is computed normally. Written from the admin
  // Place Profile screen, not authored content.
  scoreOverrides: Record<string, Record<number, number>>;
  // Curve-based scoring (docs/scoring-v2-proposal.html) — a fitted anchor
  // set per slider, Phase 2's output. Raw/unvalidated shape: a caller must
  // run each entry through scoring/curve.ts's parseSliderCurve before
  // treating it as a trusted SliderCurve. Absent key = that slider was N/A
  // when this was fitted (fitCurve.ts skips N/A sliders entirely, the same
  // sparse convention as sliderCaps/sliderEvents above). `deals`/`crowds`
  // are never present here — see curveScoring.ts.
  sliderCurves: Record<string, { anchors: Array<{ month: number; value: number; steepness?: number }> }>;
}

export interface Badge {
  label: string;
  tone: 'good' | 'warn' | 'bad';
}

export interface DerivedScores {
  monthly: Record<string, number[]>; // 12-entry array per slider key
  badges: Badge[][]; // 12 entries, each an array of badges for that month
  weatherBand: string[]; // 12 entries: 'cold' | 'cool' | 'warm' | 'hot'
  // Human-readable "why this number" breakdown per slider per month — the
  // same terms deriveDestinationScores's formula switch already computes,
  // narrated rather than recomputed. Display-only: never read by any
  // scoring/ranking logic, only by the admin scoring editor's live preview.
  explanations: Record<string, string[]>;
}

/** A destination with its derived per-month scores attached — the
 * TypeScript equivalent of the legacy app's `DESTINATIONS` (vs. `RAW_DESTINATIONS`). */
export type ScoredDestination = ScoringDestination & DerivedScores;
