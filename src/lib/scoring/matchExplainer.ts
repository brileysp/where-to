import { BAND_DIMENSIONS, MONTH_NAMES, VISIBLE_SLIDERS } from './constants';
import { isSliderNA } from './destinations';
import { styleAdjustedScore } from './rank';
import type { SelectedBands, SelectedStyles } from './rank';
import type { ScoredDestination } from './types';

export interface MatchReason {
  key: string;
  icon: string;
  label: string;
}

export interface MatchExplanation {
  pros: MatchReason[];
  cons: MatchReason[];
}

const MAX_REASONS = 3;
const STRONG_SCORE = 7.5;
const WEAK_SCORE = 3;
// A con only means something if the user actually asked for this interest —
// "No Surfing" on something you never weighted is noise, not information.
// Pros have no such floor: a great score on something you didn't ask for
// is still worth knowing about, so they're never filtered by weight.
const CON_MIN_WEIGHT = 7;

// Ordinal band-mismatch phrasing, one pair per non-weather dimension —
// "below" is the direction of the destination's own bands relative to
// whatever range the user selected (e.g. destination is easier than any
// physical-demand band the user is open to).
const DIRECTIONAL_PHRASES: Record<string, { below: string; above: string }> = {
  budget: { below: 'Not as upscale as you want', above: 'Pricier than you want' },
  vibe: { below: 'Quieter than you want', above: 'Livelier than you want' },
  physical: { below: 'Easier than you want', above: 'More demanding than you want' },
};

/**
 * Short, plain-language "what's helping, what's hurting" for this
 * destination/month. Replaces the old single-interest "Specialist boost"
 * callout with a fuller picture: up to 3 standout interests (pros) and up
 * to 3 things dragging the match down (cons) — weak or altogether missing
 * interests, and Open To band mismatches, which previously had zero
 * visible explanation despite silently halving the score per mismatched
 * dimension (see bandPenalty in rank.ts). "No X" (isNA — structurally
 * absent, e.g. no surfing somewhere landlocked) is kept distinct from
 * "Weak on X" (present but scores poorly) since they mean different
 * things to a traveler.
 *
 * Scans every slider directly rather than the curated interest-list pool
 * (rankedBreakdownSliders' topInterestSliders) — that pool exists to keep
 * the interest LIST short, but it's too permissive a bar for a "con" (it
 * includes anything above the neutral default, not just things you
 * actually asked for) and too restrictive for a "pro" (a great score on
 * something you never weighted should still surface).
 */
export function explainMatch(
  dest: ScoredDestination,
  weights: Record<string, number>,
  monthIdx: number,
  selectedBands: SelectedBands,
  selectedStyles?: SelectedStyles,
): MatchExplanation {
  const rows = VISIBLE_SLIDERS.map((s) => ({
    key: s.key,
    icon: s.icon,
    label: s.label,
    weight: weights[s.key] || 0,
    score: styleAdjustedScore(dest, s.key, monthIdx, selectedStyles),
    isNA: isSliderNA(dest, s.key),
  }));

  const pros: MatchReason[] = rows
    .filter((r) => !r.isNA && r.score >= STRONG_SCORE)
    .sort((a, b) => b.weight - a.weight || b.score - a.score)
    .slice(0, MAX_REASONS)
    .map((r) => ({ key: r.key, icon: r.icon, label: r.label }));

  const interestCons = rows
    .filter((r) => r.weight >= CON_MIN_WEIGHT && (r.isNA || r.score <= WEAK_SCORE))
    .sort((a, b) => b.weight - a.weight)
    .map((r) => ({
      key: r.key,
      icon: r.icon,
      label: r.isNA ? `No ${r.label}` : `Weak on ${r.label}`,
    }));

  const bandCons: MatchReason[] = [];
  BAND_DIMENSIONS.forEach((dim) => {
    const selected = selectedBands[dim.key] || [];
    // Nothing selected reads the same as "no constraint" in bandPenalty
    // (both skip the dimension), so this can't be what's hurting the score.
    if (selected.length === 0 || selected.length >= dim.bands.length) return;

    const order = dim.bands.map((b) => b.key);
    const selectedIdx = selected.map((k) => order.indexOf(k)).filter((i) => i >= 0);
    if (selectedIdx.length === 0) return;
    const minSel = Math.min(...selectedIdx);
    const maxSel = Math.max(...selectedIdx);

    if (dim.key === 'weather') {
      const destBand = dest.weatherBand[monthIdx];
      if (selected.includes(destBand)) return;
      const destIdx = order.indexOf(destBand);
      const direction = destIdx < minSel ? 'colder' : 'hotter';
      bandCons.push({ key: 'band-weather', icon: dim.icon, label: `${MONTH_NAMES[monthIdx]} is ${direction} than you want` });
      return;
    }

    const destBands: string[] = (dest as unknown as Record<string, string[]>)[dim.key + 'Bands'] || [];
    if (destBands.some((b) => selected.includes(b))) return; // matches — not a con

    const destIdxs = destBands.map((k) => order.indexOf(k)).filter((i) => i >= 0);
    if (destIdxs.length === 0) return; // no data for this dimension — nothing to claim
    const destMax = Math.max(...destIdxs);
    const destMin = Math.min(...destIdxs);
    const phrases = DIRECTIONAL_PHRASES[dim.key];
    if (destMax < minSel) bandCons.push({ key: `band-${dim.key}`, icon: dim.icon, label: phrases.below });
    else if (destMin > maxSel) bandCons.push({ key: `band-${dim.key}`, icon: dim.icon, label: phrases.above });
    // else: destination's bands straddle the selected range without
    // overlapping it — an ambiguous edge case, not worth a confident claim.
  });

  return {
    pros,
    cons: [...bandCons, ...interestCons].slice(0, MAX_REASONS),
  };
}
