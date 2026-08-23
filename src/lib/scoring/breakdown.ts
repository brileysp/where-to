import { SLIDERS, NEUTRAL_WEIGHT } from './constants';
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
  const aboveNeutral = SLIDERS.filter((s) => (weights[s.key] || 0) > NEUTRAL_WEIGHT).sort(
    (a, b) => (weights[b.key] || 0) - (weights[a.key] || 0),
  );
  // A sparse profile (few sliders above neutral) would otherwise leave a
  // card showing only 1-2 rows — always backfill with the next-highest
  // weighted sliders so the breakdown never reads as broken/empty, even
  // for weights that aren't technically "above neutral."
  if (aboveNeutral.length < MIN_INTEREST_POOL_SIZE) {
    const haveKeys = new Set(aboveNeutral.map((s) => s.key));
    const backfill = SLIDERS.filter((s) => !haveKeys.has(s.key))
      .sort((a, b) => (weights[b.key] || 0) - (weights[a.key] || 0))
      .slice(0, MIN_INTEREST_POOL_SIZE - aboveNeutral.length);
    return [...aboveNeutral, ...backfill].slice(0, TOP_INTEREST_COUNT);
  }
  return aboveNeutral.slice(0, TOP_INTEREST_COUNT);
}

const MIN_HIGHLIGHT_COUNT = 1;
const MAX_HIGHLIGHT_COUNT = 8;
// How close to your single strongest interest a slider's weight has to be
// to count as "real signal" for you specifically, not just "not literally
// neutral." 0.6 keeps deliberately-elevated secondary picks (e.g. a 6 next
// to a 9) while still collapsing a genuinely single-minded profile to 1.
const SIGNAL_STRENGTH_FRACTION = 0.6;

/**
 * How many sliders show by default before "Show more" — dynamic per
 * profile, not a fixed number. Counts sliders whose weight is within
 * SIGNAL_STRENGTH_FRACTION of the profile's own strongest weight, so a
 * single-minded profile collapses to just that, while a broad profile
 * shows up to MAX_HIGHLIGHT_COUNT.
 */
export function defaultHighlightCount(weights: Record<string, number>): number {
  const values = SLIDERS.map((s) => weights[s.key] || 0);
  const max = Math.max(...values, 0);
  if (max <= 0) return MIN_HIGHLIGHT_COUNT;
  const strongCount = values.filter((w) => w >= max * SIGNAL_STRENGTH_FRACTION).length;
  return Math.max(MIN_HIGHLIGHT_COUNT, Math.min(MAX_HIGHLIGHT_COUNT, strongCount));
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

/**
 * Interest sliders for this card, in a fixed weight-based order — the same
 * set, same order, for whichever month is being scored, so a card's
 * breakdown can be compared month-to-month instead of reshuffling.
 */
export function rankedBreakdownSliders(
  dest: ScoredDestination,
  weights: Record<string, number>,
  monthIdx: number,
  selectedStyles?: SelectedStyles,
): BreakdownRow[] {
  return topInterestSliders(weights)
    .map((s) => ({
      slider: s,
      weight: weights[s.key] || 0,
      score: styleAdjustedScore(dest, s.key, monthIdx, selectedStyles),
      isNA: isSliderNA(dest, s.key),
    }))
    // NA rows sink to the bottom regardless of weight; everything else
    // keeps topInterestSliders()'s weight order (stable sort).
    .sort((a, b) => Number(a.isNA) - Number(b.isNA));
}
