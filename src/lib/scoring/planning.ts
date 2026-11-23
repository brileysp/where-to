/**
 * Planning scores for an interest (29 Oct 2026). Four numbers, each 1 to 10, kept on interest_meta and shown on the Interests list and the
 * interest page. They help the owner decide where to spend time; none of them is read by the scoring engine or shown to travellers.
 *
 *   seasonalVariance  how much an interest's score is expected to swing from month to month in a typical place (10 = the season decides
 *                     everything). Sets how much seasonal-blurb effort the interest gets.
 *   evergreen         how long the interest's data stays right without anyone checking (10 = set it and forget it). Sets the review cadence.
 *   stakes            what a wrong fact costs a traveller: safety, a fine, money, a wasted trip (10 = could hurt someone).
 *   refreshEffort     how much human time one refresh takes (10 = every place is hand-researched, 1 = a script redoes it).
 */

export const PLANNING_KEYS = ['seasonalVariance', 'evergreen', 'stakes', 'refreshEffort'] as const;
export type PlanningKey = (typeof PLANNING_KEYS)[number];

export const PLANNING_LABELS: Record<PlanningKey, { label: string; short: string; help: string }> = {
  seasonalVariance: { label: 'Seasonal variance', short: 'Seasons', help: '1 = the month barely matters, 10 = the season decides whether the interest works. Sets how much month-by-month blurb effort it gets.' },
  evergreen: { label: 'Evergreen', short: 'Evergreen', help: '1 = facts go stale within weeks, 10 = set it and forget it. The band sets the review cadence.' },
  stakes: { label: 'Stakes', short: 'Stakes', help: 'What a wrong fact costs a traveller: 1 = a mildly wasted evening, 10 = someone could be hurt. Sets how hard a fact is checked.' },
  refreshEffort: { label: 'Refresh effort', short: 'Effort', help: 'Human time for one full refresh: 1 = a script redoes it, 10 = every place is hand-researched.' },
};

export type SeasonalBand = 'Very high' | 'High' | 'Medium' | 'Low';
/** Share of a full 12-month blurb job that an interest in this band gets. */
export const SEASONAL_EFFORT: Record<SeasonalBand, number> = { 'Very high': 1, High: 0.6, Medium: 0.3, Low: 0.1 };
export function seasonalBand(score: number): SeasonalBand {
  return score >= 8 ? 'Very high' : score >= 6 ? 'High' : score >= 4 ? 'Medium' : 'Low';
}
export const SEASONAL_TREATMENT: Record<SeasonalBand, string> = {
  'Very high': 'A blurb for every month.',
  High: 'Peak, shoulder and off-season blurbs.',
  Medium: 'One overview that names the best and worst months.',
  Low: 'One evergreen blurb, plus a note only for places that are exceptions.',
};

export type ReviewCadence = 'weekly' | 'monthly' | 'quarterly' | 'annually';
export function reviewCadence(evergreen: number): ReviewCadence {
  return evergreen <= 2 ? 'weekly' : evergreen <= 4 ? 'monthly' : evergreen <= 6 ? 'quarterly' : 'annually';
}
export const CADENCE_LABEL: Record<ReviewCadence, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };
export const REVIEWS_PER_YEAR: Record<ReviewCadence, number> = { weekly: 52, monthly: 12, quarterly: 4, annually: 1 };

export type StakesBand = 'Critical' | 'High' | 'Moderate' | 'Low';
export function stakesBand(score: number): StakesBand {
  return score >= 8 ? 'Critical' : score >= 6 ? 'High' : score >= 4 ? 'Moderate' : 'Low';
}
export type EffortBand = 'Mostly hand research' | 'Mixed' | 'Mostly scripted';
export function effortBand(score: number): EffortBand {
  return score >= 8 ? 'Mostly hand research' : score >= 5 ? 'Mixed' : 'Mostly scripted';
}

/** One tone per band so the admin can colour a pill: 'hot' needs the most attention, 'cool' the least. */
export type Tone = 'hot' | 'warm' | 'mild' | 'cool';
export function planningTone(key: PlanningKey, score: number): Tone {
  if (key === 'evergreen') return score <= 2 ? 'hot' : score <= 4 ? 'warm' : score <= 6 ? 'mild' : 'cool';
  return score >= 8 ? 'hot' : score >= 6 ? 'warm' : score >= 4 ? 'mild' : 'cool';
}

/** A score a person may enter: a whole number from 1 to 10. */
export function isPlanningScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 10;
}

/**
 * Review workload if every interest keeps its cadence: reviews a year, and the average per month when they are staggered.
 */
export function reviewWorkload(evergreens: number[]): { perYear: number; perMonth: number } {
  const perYear = evergreens.reduce((sum, e) => sum + REVIEWS_PER_YEAR[reviewCadence(e)], 0);
  return { perYear, perMonth: perYear / 12 };
}

/** The "Where it came from" text on a repeating review to-do made from an interest's cadence (see scripts/make-review-todos.ts). */
export const CADENCE_TODO_SOURCE = 'Review cadence';

/** How far a place's own month-to-month swing must sit from its interest's usual swing before it is flagged as an exception (points on the 0 to 10 scale). */
export const SWING_EXCEPTION_POINTS = 4;

export interface SwingFlag {
  swing: number;
  /** The interest's usual swing: the median over its places. */
  norm: number;
  /** swing minus norm; positive means this place has stronger seasons than the interest as a whole. */
  diff: number;
  exception: boolean;
}

/** A place's swing is its best month minus its worst month. */
export function swingOf(monthly: number[]): number | null {
  return monthly.length === 12 ? Math.max(...monthly) - Math.min(...monthly) : null;
}

/** Flags places whose seasons differ a lot from the interest's usual (for example resort towns that close for a season). */
export function placeSwingFlags(places: Array<{ id: string; monthly: number[]; status: string }>): Map<string, SwingFlag> {
  const swings = places.filter((p) => p.status !== 'na').map((p) => ({ id: p.id, swing: swingOf(p.monthly) })).filter((x): x is { id: string; swing: number } => x.swing !== null);
  const out = new Map<string, SwingFlag>();
  if (swings.length < 5) return out;
  const sorted = swings.map((x) => x.swing).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const norm = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  for (const x of swings) {
    const diff = x.swing - norm;
    out.set(x.id, { swing: x.swing, norm, diff, exception: Math.abs(diff) >= SWING_EXCEPTION_POINTS });
  }
  return out;
}
