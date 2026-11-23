// 14 Nov 2026: the last-digit rule judged where the owner reads it. The earlier check counted digits across a whole interest or the whole catalog, so a new batch of a couple of hundred
// values vanished inside about 1,900 live ones: Dolomites was saved with 9 of its 10 counted months on .0 or .5 and the check said "even". Two tests now stand on their own:
//   1. a CELL (one place, one interest) is not clumped: among its distinct runs of equal months (a flat stretch counts once; zeros and 10s do not count), at most 40% end in .0 or .5.
//      A cell with fewer than 3 such runs is exempt (a flat year is fine at any value).
//   2. a BATCH is even on its own: the digits .0 to .9 of the new values alone pass the same tolerance as the catalog, whatever the live scores look like. Each run of equal months
//      counts once here (a flat stretch is one value), because in a small batch one flat year would otherwise count twelve times and hide the variety.
import { circularRuns, countRunDigits, digitReport, evenTenthsCatalog, withRun, type DigitReport } from './even-tenths';

const r1 = (x: number) => Math.round(x * 10) / 10;
const digit = (v: number) => ((Math.round(v * 10) % 10) + 10) % 10;
const isRound = (v: number) => digit(v) === 0 || digit(v) === 5;
const counted = (v: number) => v > 0 && v < 10;

export const CELL_ROUND_LIMIT = 0.4;
export const CELL_MIN_RUNS = 3;

export interface CellClump { runs: number; round: number; share: number; clumped: boolean }

/** How many of a cell's distinct runs sit on .0 or .5 (a flat stretch is one run; zeros and 10s are left out). */
export function cellClump(scores: number[]): CellClump {
  const runs = circularRuns(scores.map(r1)).filter((r) => counted(r.v));
  const round = runs.filter((r) => isRound(r.v)).length;
  const share = runs.length ? round / runs.length : 0;
  return { runs: runs.length, round, share, clumped: runs.length >= CELL_MIN_RUNS && share > CELL_ROUND_LIMIT + 1e-9 };
}

export interface BatchCheck { batch: DigitReport; clumpedCells: Array<{ id: string; clump: CellClump; scores: number[] }> }

/** The digits of a batch for the judging test: every run of equal months once (flat stretches once; zeros and 10s left out). */
const runValues = (series: Record<string, number[]>): number[][] => Object.values(series).map((s) => circularRuns(s.map(r1)).filter((r) => counted(r.v)).map((r) => r.v));

/** Both tests for a set of new cells (id to twelve scores), worst cells first. */
export function checkBatch(series: Record<string, number[]>): BatchCheck {
  const clumpedCells = Object.entries(series).map(([id, scores]) => ({ id, scores, clump: cellClump(scores) })).filter((c) => c.clump.clumped).sort((a, b) => b.clump.share - a.clump.share || b.clump.runs - a.clump.runs);
  return { batch: digitReport(runValues(series)), clumpedCells };
}

/** One readable block for a log or a page: the batch on its own, then the worst cells. */
export function describeBatchCheck(label: string, c: BatchCheck): string[] {
  const shares = c.batch.shares.map((s) => String(Math.round(s)).padStart(2)).join(' ');
  const lines = [`${label}: this batch on its own, digits .0-.9 of its distinct runs (percent): ${shares}  runs=${c.batch.n}  worst .${c.batch.worst.digit} ${c.batch.worst.off >= 0 ? '+' : ''}${c.batch.worst.off.toFixed(1)} (tolerance ${c.batch.tolerance.toFixed(1)}): ${c.batch.even ? 'even' : 'UNEVEN'}`];
  lines.push(c.clumpedCells.length ? `   ${c.clumpedCells.length} cell(s) clumped on .0/.5 (limit ${Math.round(CELL_ROUND_LIMIT * 100)}% of runs):` : '   no clumped cells');
  for (const x of c.clumpedCells.slice(0, 8)) lines.push(`     ${x.id}: ${x.clump.round} of ${x.clump.runs} runs round  ${x.scores.join(' ')}`);
  return lines;
}

export const batchIsAcceptable = (c: BatchCheck) => c.batch.even && c.clumpedCells.length === 0;

/** Throws with the readable block when a batch fails either test; the gate every save path calls for the scores it is about to write. */
export function assertBatchAcceptable(label: string, series: Record<string, number[]>): BatchCheck {
  const c = checkBatch(series);
  if (!batchIsAcceptable(c)) throw new Error(`${label}: the new scores fail the last-digit check.\n${describeBatchCheck(label, c).join('\n')}`);
  return c;
}

/**
 * Moves round runs in clumped cells to nearby non-round values (at most `maxMove` tenths from where they were), shorter runs first so flat seasons stay flat, each to the digit
 * that is least used so far in the batch, keeping every month in order with its neighbours, off zeros and 10s. `accept` can veto a candidate series for a cell (the caller uses it to
 * keep blurb groups within their score limits). Returns new series; inputs are not changed.
 */
export function declumpCells(series: Record<string, number[]>, opts: { maxMove?: number; /** Where the cells were before any earlier change: the drift cap counts from here. */ anchor?: Record<string, number[]>; accept?: (id: string, candidate: number[]) => boolean } = {}): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, s] of Object.entries(series)) out[id] = s.map(r1);
  const start: Record<string, number[]> = opts.anchor ? Object.fromEntries(Object.entries(opts.anchor).map(([k, v]) => [k, v.map(r1)])) : JSON.parse(JSON.stringify(out));
  const counts = countRunDigits(Object.values(out));
  const maxMove = opts.maxMove ?? 3;
  const order = Object.keys(out).filter((id) => cellClump(out[id]).clumped).sort((a, b) => cellClump(out[b]).share - cellClump(out[a]).share || a.localeCompare(b));
  for (const id of order) {
    let guard = 0;
    while (cellClump(out[id]).clumped && guard++ < 24) {
      const cur = out[id];
      const peak = Math.max(...cur);
      const cands = circularRuns(cur).filter((r) => counted(r.v) && isRound(r.v)).sort((a, b) => a.len - b.len || (b.v === peak ? 1 : 0) - (a.v === peak ? 1 : 0) || a.start - b.start);
      let moved = false;
      for (const run of cands) {
        const n = cur.length, prev = cur[(run.start + n - 1) % n], next = cur[(run.start + run.len) % n];
        const options: Array<{ val: number; score: number }> = [];
        for (let k = -maxMove; k <= maxMove; k++) {
          if (k === 0) continue;
          const val = r1(run.v + k / 10);
          if (isRound(val) || val < 0.1 || val > 9.8) continue;
          if (Math.abs(val - start[id][run.start]) > maxMove / 10 + 1e-6) continue; // never drift more than maxMove from where the cell started
          if (run.len < n && [prev, next].some((nb) => nb !== run.v && (Math.sign(run.v - nb) !== Math.sign(val - nb) || Math.abs(val - nb) < 0.1))) continue;
          if (val > peak && run.v !== peak) continue;
          if (opts.accept && !opts.accept(id, withRun(cur, run, val))) continue;
          options.push({ val, score: counts[digit(val)] + 0.3 * Math.abs(k) });
        }
        if (!options.length) continue;
        options.sort((a, b) => a.score - b.score || a.val - b.val);
        const pick = options[0].val;
        counts[digit(run.v)] -= 1; counts[digit(pick)] += 1;
        out[id] = withRun(cur, run, pick);
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }
  return out;
}

/** Makes a batch pass both tests where it can: evens the batch's own digits, then de-clumps cells, with `accept` guarding each change. */
export function fixBatch(series: Record<string, number[]>, opts: { maxMove?: number; accept?: (id: string, candidate: number[]) => boolean } = {}): Record<string, number[]> {
  const evened = evenTenthsCatalog(series, new Set(), { maxMove: opts.maxMove ?? 3, diffuse: true, byRun: true, accept: opts.accept });
  return declumpCells(evened, { ...opts, anchor: series });
}
