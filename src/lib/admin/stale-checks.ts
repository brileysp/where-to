// 13 Nov 2026: the rules for the "why this data goes stale" checklist, kept free of the database and the browser so the server actions, the cards and the tests share them.
// Each interest has reasons (interest_stale_factors). A review round is one "Review cadence" to-do; every active reason needs a result for that round before the to-do can be
// ticked done. A reason is "current" while its latest result is newer than its own review interval (its override, or the interest's cadence).
import type { StaleCategory, StaleChecker, StaleResult } from '@/lib/db/schema';
import { CADENCE_TODO_SOURCE, reviewCadence, type ReviewCadence } from '@/lib/scoring/planning';

export type { StaleCategory, StaleChecker, StaleResult };
export type StaleEvery = 'weekly' | 'monthly' | 'quarterly' | 'annually';

export interface StaleCheckRow { result: StaleResult; note: string; checkedBy: string; checkedAt: string; todoId: string | null }
export interface StaleFactorRow {
  id: string; interestKey: string; category: StaleCategory; statement: string; howToCheck: string; checker: StaleChecker; checkEvery: StaleEvery | null; sortOrder: number; active: boolean;
  /** The latest result for this reason, whatever round it was made in. */
  last: StaleCheckRow | null;
  /** The result recorded against the round being asked about (the open review to-do), if any. */
  thisRound: StaleCheckRow | null;
  /** True for a reason that applies to every interest (held once at site level and asked in each interest's review). */
  inherited?: boolean;
  /** True when this interest has said the site-wide reason does not apply to it; it is then not asked. */
  optedOut?: boolean;
  optOutNote?: string;
}

export const RESULT_LABEL: Record<StaleResult, string> = { checked: 'Checked, still true', changed: 'Changed', na: 'Does not apply' };
export const CHECKER_LABEL: Record<StaleChecker, string> = { owner: 'You', claude: 'Claude', script: 'A script' };
export const EVERY_LABEL: Record<StaleEvery, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };

const DAY = 86_400_000;
const DAYS: Record<ReviewCadence | StaleEvery, number> = { weekly: 7, monthly: 31, quarterly: 92, annually: 366 };
export const cadenceDays = (c: ReviewCadence | StaleEvery): number => DAYS[c];

export type FactorStatus = 'never' | 'current' | 'overdue';
/** never = no result yet; current = the latest result is within the reason's interval; overdue = older than that. `evergreen` is the interest's planning score. */
export function factorStatus(f: Pick<StaleFactorRow, 'last' | 'checkEvery'>, evergreen: number | null, now: Date = new Date()): FactorStatus {
  if (!f.last) return 'never';
  const every = f.checkEvery ?? (evergreen == null ? 'quarterly' : reviewCadence(evergreen));
  return now.getTime() - Date.parse(f.last.checkedAt) <= cadenceDays(every) * DAY ? 'current' : 'overdue';
}

export interface RoundProgress { total: number; done: number; missing: number }
type RoundRow = Pick<StaleFactorRow, 'active' | 'thisRound' | 'last' | 'checkEvery' | 'inherited' | 'optedOut'>;
/** Whether a reason is asked in this interest's review: active, not opted out, and (for a site-wide reason) due, since it is checked once per interval for each interest rather than every round. */
export function askedThisRound(f: RoundRow, evergreen: number | null, now: Date = new Date()): boolean {
  if (!f.active || f.optedOut) return false;
  if (!f.inherited) return true;
  return !!f.thisRound || factorStatus(f, evergreen, now) !== 'current';
}
/** How many of the reasons asked in this round already have a result. */
export function roundProgress(factors: RoundRow[], evergreen: number | null = null, now: Date = new Date()): RoundProgress {
  const asked = factors.filter((f) => askedThisRound(f, evergreen, now));
  const done = asked.filter((f) => f.thisRound).length;
  return { total: asked.length, done, missing: asked.length - done };
}

/** The message that stops a review to-do being ticked done, or null when it may be. Only review-cadence to-dos are gated, and only when the interest has reasons. */
export function reviewGateMessage(source: string, progress: RoundProgress): string | null {
  if (source !== CADENCE_TODO_SOURCE || progress.total === 0 || progress.missing === 0) return null;
  return `${progress.missing} of ${progress.total} reasons have no result for this review yet. Open the interest's Staleness checks and mark each one Checked, Changed or Does not apply.`;
}

export interface FactorSummary { total: number; current: number; overdue: number; never: number; noHow: number }
export function summarize(factors: Array<Pick<StaleFactorRow, 'last' | 'checkEvery' | 'active' | 'howToCheck' | 'optedOut'>>, evergreen: number | null, now: Date = new Date()): FactorSummary {
  const out: FactorSummary = { total: 0, current: 0, overdue: 0, never: 0, noHow: 0 };
  for (const f of factors) {
    if (!f.active || f.optedOut) continue;
    out.total++;
    if (!f.howToCheck.trim()) out.noHow++;
    out[factorStatus(f, evergreen, now)]++;
  }
  return out;
}
