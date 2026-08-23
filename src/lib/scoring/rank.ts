import { BAND_DIMENSIONS, SLIDERS } from './constants';
import type { ScoredDestination } from './types';

// Ported from app.js:127-193,728-733 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/app.js),
// retyped to take explicit params instead of reading a global `state`
// object — a retype, not a redesign; the math is unchanged.

export type SelectedBands = Record<string, string[]>;
// Slider key -> the sub-style pills currently scoped for it (e.g.
// { cycling: ['mountainBiking', 'gravelRiding'] }) — see earnedStyles/
// selectedStyles in db/schema.ts and DOMAIN_CORE_AXES in lib/dna/domains.ts.
export type SelectedStyles = Record<string, string[]>;

// How much a destination's slider score counts when scoped to a
// selected style: 'signature' is a full match, 'none' is a destination
// we've explicitly researched and confirmed is a poor fit for that
// style — a real but soft penalty (not near-zero), since even a
// genuinely opposite destination usually isn't a total non-starter for
// one interest among many. Untagged/unauthored destinations are handled
// separately in styleAdjustedScore and never fall through to this map —
// "we haven't researched this yet" and "we researched it and it's a
// poor fit" are different claims and shouldn't score the same.
const TIER_MULTIPLIERS: Record<'signature' | 'strong' | 'casual' | 'none', number> = {
  signature: 1,
  strong: 0.8,
  casual: 0.5,
  none: 0.3,
};

/**
 * The slider score to use for one destination/slider/month, scoped to
 * whichever sub-style pills are currently selected. With no selection,
 * or no tier data at all for this destination/slider (the destination
 * has never been authored for this slider — most destinations, for most
 * sliders, at any given time), this is just the raw monthly score,
 * unchanged — an unresearched destination reads as neutral, not as a
 * confirmed mismatch, matching isSliderNA's existing non-punitive
 * precedent. The TIER_MULTIPLIERS penalty only applies once a
 * destination has actually been authored for this slider and some of
 * its styles came back 'none' — a real claim, not an absence of one.
 * When multiple styles are selected, the BEST-matching one wins (max,
 * not average) — a destination signature for one of several loved
 * styles shouldn't be dragged down by being merely casual at another.
 */
export function styleAdjustedScore(
  dest: ScoredDestination,
  sliderKey: string,
  monthIdx: number,
  selectedStyles?: SelectedStyles,
): number {
  const raw = dest.monthly[sliderKey][monthIdx];
  const selected = selectedStyles?.[sliderKey];
  if (!selected || !selected.length) return raw;
  const tiers = dest.activityStyleTiers[sliderKey];
  if (!tiers) return raw;
  const multiplier = Math.max(...selected.map((styleKey) => TIER_MULTIPLIERS[tiers[styleKey] ?? 'none']));
  return raw * multiplier;
}

export function bandPenalty(dest: ScoredDestination, monthIdx: number, selectedBands: SelectedBands): number {
  let mult = 1;
  BAND_DIMENSIONS.forEach((dim) => {
    const selected = selectedBands[dim.key] || [];
    if (selected.length >= dim.bands.length) return; // no constraint set
    const match =
      dim.key === 'weather'
        ? selected.includes(dest.weatherBand[monthIdx])
        : ((dest as unknown as Record<string, string[]>)[dim.key + 'Bands'] || []).some((b) => selected.includes(b));
    if (!match) mult *= 0.5;
  });
  return mult;
}

// How many of the user's highest-weighted sliders count as their "clearest
// priorities" for the specialization boost, and how much that boost
// counts against the broad weighted average.
const TOP_SCORE_BOOST_COUNT = 5;
const TOP_SCORE_BOOST_WEIGHT = 0.4;

/**
 * A pure weighted average over ALL weighted sliders rewards being broadly
 * decent proportional to weight, but doesn't specially reward EXCELLING at
 * whichever handful of things the user cares about most. Blending in a
 * second average computed ONLY over the user's top TOP_SCORE_BOOST_COUNT
 * highest-weighted sliders breaks ties in favor of the specialist match.
 */
export function scoreForMonth(
  dest: ScoredDestination,
  weights: Record<string, number>,
  monthIdx: number,
  selectedBands: SelectedBands,
  selectedStyles?: SelectedStyles,
): number {
  const scoreFor = (key: string) => styleAdjustedScore(dest, key, monthIdx, selectedStyles);

  const tw = SLIDERS.reduce((s, c) => s + (weights[c.key] || 0), 0);
  if (tw === 0) {
    const uniform = SLIDERS.reduce((s, c) => s + scoreFor(c.key), 0) / SLIDERS.length;
    return uniform * bandPenalty(dest, monthIdx, selectedBands);
  }

  const broadAvg = SLIDERS.reduce((s, c) => s + (weights[c.key] || 0) * scoreFor(c.key), 0) / tw;

  const topSliders = [...SLIDERS]
    .filter((s) => (weights[s.key] || 0) > 0)
    .sort((a, b) => (weights[b.key] || 0) - (weights[a.key] || 0))
    .slice(0, TOP_SCORE_BOOST_COUNT);
  const topWeightSum = topSliders.reduce((s, c) => s + (weights[c.key] || 0), 0);
  const topAvg =
    topWeightSum === 0
      ? broadAvg
      : topSliders.reduce((s, c) => s + (weights[c.key] || 0) * scoreFor(c.key), 0) / topWeightSum;

  const blended = broadAvg * (1 - TOP_SCORE_BOOST_WEIGHT) + topAvg * TOP_SCORE_BOOST_WEIGHT;
  return blended * bandPenalty(dest, monthIdx, selectedBands);
}

export function scoreLabel(score: number): { text: string; cls: string } {
  if (score >= 8) return { text: 'Excellent time to go', cls: 'excellent' };
  if (score >= 6.5) return { text: 'Good time to go', cls: 'good' };
  if (score >= 5) return { text: 'Okay, some tradeoffs', cls: 'okay' };
  if (score >= 3) return { text: 'Not ideal timing', cls: 'poor' };
  return { text: 'Avoid this month', cls: 'bad' };
}

/** Same tiers/thresholds as scoreLabel, worded for how well a destination
 * fits this user's picks rather than whether the month itself is good —
 * a low match can still be great timing (see DestinationCard). */
export function matchLabel(score: number): { text: string; cls: string } {
  if (score >= 8) return { text: 'Excellent match', cls: 'excellent' };
  if (score >= 6.5) return { text: 'Good match', cls: 'good' };
  if (score >= 5) return { text: 'Okay match', cls: 'okay' };
  if (score >= 3) return { text: 'Weak match', cls: 'poor' };
  return { text: 'Poor match', cls: 'bad' };
}

export function barColor(s: number): string {
  if (s >= 8) return 'var(--good)';
  if (s >= 6.5) return 'var(--good-soft)';
  if (s >= 5) return 'var(--okay)';
  if (s >= 3) return 'var(--poor)';
  return 'var(--bad)';
}

export interface RankedDestination {
  d: ScoredDestination;
  s: number;
}

export function computeRankedDestinations(
  destinations: ScoredDestination[],
  weights: Record<string, number>,
  month: number,
  selectedBands: SelectedBands,
  selectedStyles?: SelectedStyles,
): RankedDestination[] {
  const monthIdx = month - 1;
  return [...destinations]
    .map((d) => ({ d, s: scoreForMonth(d, weights, monthIdx, selectedBands, selectedStyles) }))
    .sort((a, b) => b.s - a.s);
}
