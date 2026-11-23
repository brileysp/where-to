// 14 Nov 2026: puts freshly written scores through the last-digit rule where the owner reads it (src/lib/gemini/clump.ts): the NEW batch must be even on its own, and no single cell may be
// clumped on .0 and .5. Changes are small (at most 0.3 from what Gemini or a hand edit gave), keep every month in order, never touch zeros or 10s, and are vetoed when they would make a
// blurb span more than its rules allow (src/lib/authoring/rules.ts: wideGroup, splitConsider) where it did not before. Used by gemini-batch.ts collect and scripts/rebalance-results.ts.
// (The first version judged the batch only inside the live catalog, where 223 new values hide among 1,900: Dolomites was saved with nine of ten months on .0 or .5.)
import { balanceAgainstLive, describeDigits } from '@/lib/gemini/even-tenths';
import { batchIsAcceptable, cellClump, checkBatch, describeBatchCheck, fixBatch } from '@/lib/gemini/clump';
import { liveSeries } from '@/lib/authoring/live-series';
import { scanStructure } from '@/lib/authoring/rules';

export interface ResultCell { k: string; id: string; gemini: { applicable?: boolean; monthly_scores?: number[]; gemini_raw_scores?: number[]; blurbs?: Array<{ months: number[]; text: string }> } }

const SPREAD_HITS = ['wideGroup', 'splitConsider'];
const spreadHits = (c: ResultCell, scores: number[]) => scanStructure((c.gemini.blurbs ?? []).map((b) => ({ months: b.months, text: b.text })), scores).filter((h) => SPREAD_HITS.includes(h));

/** Rewrites monthly_scores in place; the scores as received are kept once as gemini_raw_scores. Returns report lines (before and after, worst cells first). */
export function balanceResults(cells: ResultCell[], liveRows: Array<{ id: string; authoredCurves?: string[] | null; naSliders?: string[] | null }>): string[] {
  const out: string[] = [];
  const todo = cells.filter((c) => c.gemini?.applicable && Array.isArray(c.gemini.monthly_scores) && c.gemini.monthly_scores.length === 12);
  for (const k of new Set(todo.map((c) => c.k))) {
    const mine = todo.filter((c) => c.k === k); const byId: Record<string, number[]> = {}; const cellOf = new Map<string, ResultCell>();
    for (const c of mine) { byId[c.id] = c.gemini.monthly_scores!.map((v) => Math.round(v * 10) / 10); cellOf.set(c.id, c); }
    out.push(...describeBatchCheck(`${k} BEFORE`, checkBatch(byId)));
    // A change is allowed only if it adds no spread problem the cell did not already have.
    const baseline = new Map(mine.map((c) => [c.id, spreadHits(c, byId[c.id])]));
    const accept = (id: string, cand: number[]) => spreadHits(cellOf.get(id)!, cand).every((h) => baseline.get(id)!.includes(h));
    let fixed = fixBatch(byId, { maxMove: 3, accept });
    // Then nudge the batch toward the catalog's own digits as well, but only keep that if the batch still passes both of its own tests and no cell is clumped again.
    const live = liveSeries(liveRows, k, new Set(Object.keys(byId)));
    const both = balanceAgainstLive(fixed, live, { maxMove: 3, accept: (id, cand) => accept(id, cand) && !cellClump(cand).clumped }).series;
    if (batchIsAcceptable(checkBatch(both))) fixed = both;
    for (const c of mine) { c.gemini.gemini_raw_scores ??= byId[c.id]; c.gemini.monthly_scores = fixed[c.id]; }
    out.push(...describeBatchCheck(`${k} AFTER`, checkBatch(fixed)));
    out.push(`   together with the ${live.length} live cells: ${describeDigits(balanceAgainstLive(fixed, live, { maxMove: 0 }).combinedAfter)}`);
  }
  return out;
}
