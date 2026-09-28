import { BAND_DIMENSIONS, VISIBLE_SLIDERS } from './constants';
import { isSliderNA } from './destinations';
import { effectiveWeights, styleAdjustedScore } from './rank';
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
//
// Pros follow the same principle, with the same test the score itself uses. They used to have
// no weight floor ("a great score on something you didn't ask for is still worth knowing"),
// which meant any empty pro slot got filled by whatever strong interest was left: a Connoisseur
// who weighted fishing at 2 was told Panama's fishing was one of its selling points. A pro must
// now be an interest that actually counts in the match (see effectiveWeights in rank.ts). When
// the user has stated nothing at all there is nothing to filter against, so the unfiltered
// standout list is kept.
const CON_MIN_WEIGHT = 7;

// The green budget pill. The user only counts as cost-motivated when they've narrowed the
// budget bands to the cheapest half AND kept the cheapest one: basic only, or basic +
// comfortable. Dropping just the top tier (leaving three of four) is not cost motivation, and a
// selection that leaves out basic is not a budget selection. There is deliberately no inverse
// pill for high-end or luxury: Luxury Hotels is already an interest slider. Budget bands are
// inclusive spans (what tiers of trip a place can support), so band membership alone is too
// loose: Rome lists basic, but its cheapest tier is $$. The pill therefore also requires the
// destination's own cheapest cost tier to be the lowest one ($), which drops Rome and London
// while keeping Vietnam, Bali and Panama.
const BUDGET_PILL_LABEL = 'Budget-friendly';
const CHEAPEST_COST_TIER = '$';

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
 * The green "Budget-friendly" reason, or null. See BUDGET_PILL_LABEL above for exactly when it
 * applies.
 */
export function budgetPillReason(dest: ScoredDestination, selectedBands: SelectedBands): MatchReason | null {
  const budgetDim = BAND_DIMENSIONS.find((d) => d.key === 'budget');
  if (!budgetDim) return null;
  const order = budgetDim.bands.map((b) => b.key);
  const cheapestHalf = order.slice(0, Math.floor(order.length / 2));
  const selected = selectedBands.budget || [];
  const costMotivated = selected.length > 0 && selected.includes(order[0]) && selected.every((k) => cheapestHalf.includes(k));
  if (costMotivated && (dest.budgetBands || []).includes(order[0]) && dest.costRange?.min === CHEAPEST_COST_TIER) {
    return { key: 'band-budget-match', icon: budgetDim.icon, label: BUDGET_PILL_LABEL };
  }
  return null;
}

/**
 * One reason per Open To dimension whose selection this destination misses entirely, i.e. the
 * dimensions bandPenalty halves the score for ("Pricier than you want", "May is hotter than
 * you want", ...).
 */
export function bandMismatchReasons(dest: ScoredDestination, monthIdx: number, selectedBands: SelectedBands): MatchReason[] {
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
      // Deliberately no month name baked in here (it used to read "December
      // is colder than you want") — every other dimension's label below is
      // a bare predicate ("Pricier than you want", "Quieter than you
      // want"...) meant to slot into a caller's own sentence (e.g. DnaDetail's
      // "...because it's {reason}"). Weather's label carrying its own
      // subject+verb was the one exception, and it broke exactly there:
      // "because it's December is colder than you want". A caller that
      // wants the month back (a standalone chip, say) can prepend it itself
      // from the month it already has in scope.
      bandCons.push({ key: 'band-weather', icon: dim.icon, label: `${direction === 'colder' ? 'Colder' : 'Hotter'} than you want` });
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
  return bandCons;
}

export interface MatchAdjustment extends MatchReason {
  tone: 'good' | 'bad';
}

/**
 * What the Open To filters did to this destination/month's score, for the note behind the score's
 * (i): the green Budget-friendly reason (when it applies) plus a red reason for every dimension
 * that mismatches. Empty when the filters did nothing worth saying.
 */
export function matchAdjustments(dest: ScoredDestination, monthIdx: number, selectedBands: SelectedBands): MatchAdjustment[] {
  const good = budgetPillReason(dest, selectedBands);
  return [
    ...(good ? [{ ...good, tone: 'good' as const }] : []),
    ...bandMismatchReasons(dest, monthIdx, selectedBands).map((r) => ({ ...r, tone: 'bad' as const })),
  ];
}

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

  const counted = effectiveWeights(weights);
  const userHasPriorities = Object.values(counted).some((w) => w > 0);
  const interestPros: MatchReason[] = rows
    .filter((r) => !r.isNA && r.score >= STRONG_SCORE && (!userHasPriorities || (counted[r.key] || 0) > 0))
    .sort((a, b) => b.weight - a.weight || b.score - a.score)
    .map((r) => ({ key: r.key, icon: r.icon, label: r.label }));

  const budgetReason = budgetPillReason(dest, selectedBands);
  const budgetPros: MatchReason[] = budgetReason ? [budgetReason] : [];
  const pros = [...budgetPros, ...interestPros].slice(0, MAX_REASONS);

  const interestCons = rows
    .filter((r) => r.weight >= CON_MIN_WEIGHT && (r.isNA || r.score <= WEAK_SCORE))
    .sort((a, b) => b.weight - a.weight)
    .map((r) => ({
      key: r.key,
      icon: r.icon,
      label: r.isNA ? `No ${r.label}` : `Weak on ${r.label}`,
    }));

  const bandCons = bandMismatchReasons(dest, monthIdx, selectedBands);

  return {
    pros,
    cons: [...bandCons, ...interestCons].slice(0, MAX_REASONS),
  };
}
