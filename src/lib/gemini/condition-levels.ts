// Condition levels for the snorkeling & diving "labels" design (draft, 10 Oct 2026).
// Gemini writes each month's blurb and then labels the month with one of these levels, judged from the blurb it just wrote.
// The month's score is then CALCULATED from the place's peak (set by the owner/Claude across the whole catalog) and this
// table, so scores cannot contradict the text, flat stretches are flat by construction, and a closed season is one value.

export const CONDITION_LEVELS = ['peak', 'strong', 'reduced', 'poor', 'disrupted', 'closed'] as const;
export type ConditionLevel = (typeof CONDITION_LEVELS)[number];

/** Share of the place's peak score each level earns. 'closed' is an absolute floor, not a share (nobody dives). */
export const LEVEL_SHARE: Record<Exclude<ConditionLevel, 'closed'>, number> = {
  peak: 1,
  strong: 0.92,
  reduced: 0.8,
  poor: 0.65,
  disrupted: 0.35,
};
export const CLOSED_SCORE = 0.4;

const r1 = (x: number) => Math.round(x * 10) / 10;

export function scoreForLevel(peak: number, level: ConditionLevel): number {
  if (level === 'closed') return Math.min(CLOSED_SCORE, peak);
  return r1(peak * LEVEL_SHARE[level]);
}

export function scoresFromLevels(peak: number, levels: ConditionLevel[]): number[] {
  return levels.map((l) => scoreForLevel(peak, l));
}
