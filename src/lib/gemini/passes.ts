// Authoring passes (docs/authoring-passes-spec.md): grouping of Gemini batches into named rounds, used by the one-off backfill and
// by the batch script. The pure function here has no database access so it can be tested.
import type { AuthoringPassKind } from '../db/schema';

export interface BatchSummary {
  id: string;
  interestKey: string;
  startedAt: Date;
  finishedAt: Date | null;
  /** Number of generation rows in the batch (0 = an empty or crashed run). */
  generations: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  /** Distinct prompt versions recorded on the batch's generations, for example "birding/v8". */
  versions: string[];
  placeIds: string[];
  appliedCount: number;
  lastActivity: Date;
}

export interface PlannedPass {
  interestKey: string;
  label: string;
  kind: AuthoringPassKind;
  promptVersion: string | null;
  finishedAt: Date | null;
  batchIds: string[];
}

/** "birding/v8" from "birding/v8" or "whaleWatching/v2 (adapted by Claude from the Hudson Valley text)". */
export function baseVersion(v: string): string {
  return v.split(' (')[0].trim();
}

const MIN_FULL_PASS_PLACES = 15;

export function planPasses(batches: BatchSummary[], interestLabel: (key: string) => string): PlannedPass[] {
  const real = batches.filter((b) => b.generations > 0);
  const groups = new Map<string, BatchSummary[]>();
  for (const b of real) {
    const manual = b.tokensIn === 0 && b.tokensOut === 0 && b.costUsd === 0; // hand edits recorded as a batch: no model call was made
    const key = manual ? `${b.interestKey}|manual` : `${b.interestKey}|${baseVersion(b.versions[0] ?? 'unknown')}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const byInterest = new Map<string, Array<{ key: string; list: BatchSummary[]; start: number; end: number }>>();
  for (const [key, list] of groups) {
    const interestKey = key.split('|')[0];
    const start = Math.min(...list.map((b) => b.startedAt.getTime()));
    const end = Math.max(...list.map((b) => b.lastActivity.getTime()));
    byInterest.set(interestKey, [...(byInterest.get(interestKey) ?? []), { key, list, start, end }]);
  }
  const out: PlannedPass[] = [];
  for (const [interestKey, groupsOfInterest] of byInterest) {
    groupsOfInterest.sort((a, b) => a.start - b.start);
    const latestEnd = Math.max(...groupsOfInterest.map((g) => g.end));
    let seenInitial = false;
    for (const g of groupsOfInterest) {
      const manual = g.key.endsWith('|manual');
      const version = manual ? null : g.key.split('|')[1];
      const places = new Set(g.list.flatMap((b) => b.placeIds)).size;
      let kind: AuthoringPassKind;
      if (manual) kind = 'targeted';
      else if (places < MIN_FULL_PASS_PLACES) kind = 'pilot';
      else if (!seenInitial) {
        kind = 'initial';
        seenInitial = true;
      } else kind = 'redo';
      const applied = g.list.reduce((a, b) => a + b.appliedCount, 0);
      // Still in progress: the interest's most recent full pass with nothing applied yet. Everything else is finished.
      const open = !manual && kind !== 'pilot' && g.end === latestEnd && applied === 0;
      out.push({
        interestKey,
        label: manual ? `${interestLabel(interestKey)} · source-check edits` : `${interestLabel(interestKey)} · ${version?.split('/')[1] ?? 'unknown'}`,
        kind,
        promptVersion: version,
        finishedAt: open ? null : new Date(g.end),
        batchIds: g.list.map((b) => b.id),
      });
    }
  }
  return out;
}

/** Pass total shown on the admin screen. */
export function totalTokens(tokensIn: number, tokensOut: number): number {
  return tokensIn + tokensOut;
}
