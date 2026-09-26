import { VISIBLE_SLIDERS, NEUTRAL_WEIGHT } from './constants';
import { isSliderNA } from './destinations';
import { styleAdjustedScore } from './rank';
import type { SelectedStyles } from './rank';
import type { ScoredDestination, Slider } from './types';

// Ported from app.js:454-568 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/app.js),
// retyped to take explicit `weights` params instead of reading a global
// `state` object — a retype, not a redesign; the math is unchanged.

const TOP_INTEREST_COUNT = 10;
const MIN_INTEREST_POOL_SIZE = 5;

/**
 * The curated set of sliders worth showing for ANY destination breakdown:
 * real positive signal (weight above the neutral floor), capped to the top
 * TOP_INTEREST_COUNT by weight. Used by both the compact top-of-card
 * summary and the per-month drill-down so they always show the exact same
 * curated list — never "everything" in one place and a filtered view in
 * the other.
 */
export function topInterestSliders(weights: Record<string, number>): Slider[] {
  const aboveNeutral = VISIBLE_SLIDERS.filter((s) => (weights[s.key] || 0) > NEUTRAL_WEIGHT).sort(
    (a, b) => (weights[b.key] || 0) - (weights[a.key] || 0),
  );
  // A sparse profile (few sliders above neutral) would otherwise leave a
  // card showing only 1-2 rows — always backfill with the next-highest
  // weighted sliders so the breakdown never reads as broken/empty, even
  // for weights that aren't technically "above neutral."
  if (aboveNeutral.length < MIN_INTEREST_POOL_SIZE) {
    const haveKeys = new Set(aboveNeutral.map((s) => s.key));
    const backfill = VISIBLE_SLIDERS.filter((s) => !haveKeys.has(s.key))
      .sort((a, b) => (weights[b.key] || 0) - (weights[a.key] || 0))
      .slice(0, MIN_INTEREST_POOL_SIZE - aboveNeutral.length);
    return [...aboveNeutral, ...backfill].slice(0, TOP_INTEREST_COUNT);
  }
  return aboveNeutral.slice(0, TOP_INTEREST_COUNT);
}

const MIN_HIGHLIGHT_COUNT = 1;
// The For You tab's interest breakdown never shows more than 5 rows —
// a card-sized list, not a full interest inventory (see explainMatch for
// the "scan everything" version used for pros/cons).
const MAX_HIGHLIGHT_COUNT = 5;
// How close to your single strongest interest a slider's weight has to be
// to count as "real signal" for you specifically, not just "not literally
// neutral." 0.6 keeps deliberately-elevated secondary picks (e.g. a 6 next
// to a 9) while still collapsing a genuinely single-minded profile to 1.
const SIGNAL_STRENGTH_FRACTION = 0.6;

/**
 * How many sliders the breakdown list shows — dynamic per profile, not a
 * fixed number. Counts sliders whose weight is within
 * SIGNAL_STRENGTH_FRACTION of the profile's own strongest weight, so a
 * single-minded profile (one interest set way above the rest) collapses to
 * just that one row, while a broad profile shows the full MAX_HIGHLIGHT_COUNT.
 */
export function defaultHighlightCount(weights: Record<string, number>): number {
  const values = VISIBLE_SLIDERS.map((s) => weights[s.key] || 0);
  const max = Math.max(...values, 0);
  if (max <= 0) return MIN_HIGHLIGHT_COUNT;
  const strongCount = values.filter((w) => w >= max * SIGNAL_STRENGTH_FRACTION).length;
  return Math.max(MIN_HIGHLIGHT_COUNT, Math.min(MAX_HIGHLIGHT_COUNT, strongCount));
}

/**
 * The interests shown as chips on a destination's For You tab: the traveller's own top interests,
 * in their priority order (highest weight first), as many as defaultHighlightCount says are real
 * signal for this profile (1 to 5). Depends only on the weights, never on the month or the
 * destination, so the row never reshuffles while someone previews different months.
 */
export function topInterestChips(weights: Record<string, number>): Slider[] {
  return topInterestSliders(weights)
    .map((slider, i) => ({ slider, i }))
    .sort((a, b) => (weights[b.slider.key] || 0) - (weights[a.slider.key] || 0) || a.i - b.i)
    .map((x) => x.slider)
    .slice(0, defaultHighlightCount(weights));
}

/** Same tone bands as scoreLabel, but phrased for a single slider's fit rather than the overall trip score. */
export function matchReasonTier(score: number): { text: string; cls: string } {
  if (score >= 9) return { text: 'exceptional', cls: 'excellent' };
  if (score >= 7.5) return { text: 'excellent', cls: 'excellent' };
  if (score >= 6.5) return { text: 'strong', cls: 'good' };
  if (score >= 5) return { text: 'solid', cls: 'okay' };
  return { text: 'a stretch', cls: 'poor' };
}

export interface BreakdownRow {
  slider: Slider;
  weight: number;
  score: number;
  isNA: boolean;
}

// A weight at or below this counts as "doesn't really care" — a generalist
// with nothing weighted higher has nothing to "specialize" in, so the
// specialist callout shouldn't show at all.
const SPECIALIST_MIN_WEIGHT = 6;

export interface SpecialistHighlight {
  slider: Slider;
  score: number;
  // True when more than one slider shares the user's single highest
  // weight — the UI phrases the callout differently ("Specialist boost: X"
  // rather than "X is your #1 interest") since it isn't uniquely #1.
  tied: boolean;
}

/**
 * Which interest earns the "Specialist boost" callout for this
 * destination/month: the user's single highest-weighted slider, or, when
 * several sliders are tied for that top weight, whichever tied slider
 * actually scores best here (not just the first one in slider order).
 * Returns null when nothing is weighted above SPECIALIST_MIN_WEIGHT, or
 * when every tied top slider is N/A for this destination.
 */
export function specialistHighlight(
  dest: ScoredDestination,
  weights: Record<string, number>,
  monthIdx: number,
  selectedStyles?: SelectedStyles,
): SpecialistHighlight | null {
  const maxWeight = Math.max(...VISIBLE_SLIDERS.map((s) => weights[s.key] || 0));
  if (maxWeight <= SPECIALIST_MIN_WEIGHT) return null;

  const tiedSliders = VISIBLE_SLIDERS.filter((s) => (weights[s.key] || 0) === maxWeight);
  const candidates = tiedSliders
    .map((s) => ({ slider: s, score: styleAdjustedScore(dest, s.key, monthIdx, selectedStyles), isNA: isSliderNA(dest, s.key) }))
    .filter((c) => !c.isNA)
    .sort((a, b) => b.score - a.score);
  if (candidates.length === 0) return null;

  return { slider: candidates[0].slider, score: candidates[0].score, tied: tiedSliders.length > 1 };
}

export interface TopWeightStatus {
  isTop: boolean;
  tied: boolean;
}

/**
 * Whether a given slider is (one of) the user's single highest-weighted
 * interest(s) — used to label the "Best months" hint as "your top
 * interest" vs "a top interest" when more than one slider shares the max
 * weight. Unlike specialistHighlight, this has no minimum-weight floor: it
 * always answers relative to whatever the user's own highest weight is.
 */
export function topWeightStatus(sliderKey: string, weights: Record<string, number>): TopWeightStatus {
  const maxWeight = Math.max(...VISIBLE_SLIDERS.map((s) => weights[s.key] || 0));
  const tiedCount = VISIBLE_SLIDERS.filter((s) => (weights[s.key] || 0) === maxWeight).length;
  return { isTop: (weights[sliderKey] || 0) === maxWeight, tied: tiedCount > 1 };
}

/**
 * Interest sliders for this card — up to defaultHighlightCount(weights) of
 * them (5 at most, fewer if the user's profile is concentrated on one or
 * two interests), picked by weight. Unlike topInterestSliders (the shared,
 * destination-agnostic pool behind the results-list chip row), this is
 * destination-aware: when two sliders are tied on weight right at the cutoff,
 * the one that actually scores better HERE wins the spot, so the 5 shown are
 * both what the user cares about most and what this place is actually good
 * at — not an arbitrary pick among equally-weighted candidates. Same set,
 * same order, for whichever month is being scored, so a card's breakdown can
 * be compared month-to-month instead of reshuffling.
 */
export function rankedBreakdownSliders(
  dest: ScoredDestination,
  weights: Record<string, number>,
  monthIdx: number,
  selectedStyles?: SelectedStyles,
): BreakdownRow[] {
  const rows: BreakdownRow[] = VISIBLE_SLIDERS.map((s) => ({
    slider: s,
    weight: weights[s.key] || 0,
    score: styleAdjustedScore(dest, s.key, monthIdx, selectedStyles),
    isNA: isSliderNA(dest, s.key),
  }));

  const count = defaultHighlightCount(weights);
  const picked = [...rows]
    .sort((a, b) => b.weight - a.weight || b.score - a.score)
    .slice(0, count);

  // NA rows sink to the bottom regardless of weight; everything else
  // keeps the weight (then place-score) order picked above.
  return picked.sort((a, b) => Number(a.isNA) - Number(b.isNA));
}
