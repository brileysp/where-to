// Keeps the last digit of the monthly scores evenly used.
//
// Owner rule (3 Oct 2026, clarified 11 Oct): across the catalog there should be NO MORE 6.0s and 6.5s than 6.1s, 6.2s, 6.3s and so
// on. Each last digit should turn up about as often as any other (roughly 10% each), so a .0 or a .5 still appears now and then,
// just not more than the rest. What looks artificial and lazy is a string of .5s followed by a different string of .5s, and it piles
// many places onto one score in the same month. Flat seasons are fine, at any value.
//
// Method: a flat run of months sitting on x.0 or x.5 is moved to a nearby non-round value (within 0.3) only while that digit is used
// MORE than its fair share. Longer runs go first, so the strings go and the odd single round month stays. A run moves as a block,
// so a flat season stays flat. A move must keep every relation with the neighbouring runs (lower stays lower, higher stays higher,
// never equal) and stay between 0.1 and 9.8. Zeros (closed months) and 10s are never touched. Of the allowed values the move
// picks the last digit that is least used so far, then the smaller move, then a seeded coin flip.

export type DigitCounts = number[]; // length 10, index = tenths digit

const r1 = (x: number) => Math.round(x * 10) / 10;
const digit = (v: number) => ((Math.round(v * 10) % 10) + 10) % 10;
const isRound = (v: number) => digit(v) === 0 || digit(v) === 5;
const counted = (v: number) => v > 0 && v < 10;

function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Tenths-digit counts of every value that is not a zero or a 10. */
export function countDigits(series: number[][]): DigitCounts {
  const c: DigitCounts = new Array(10).fill(0);
  for (const s of series) for (const v of s) if (counted(v)) c[digit(v)]++;
  return c;
}

/** Tenths-digit counts with every run of equal months counted once (a flat stretch is one value, not several); zeros and 10s are left out. */
export function countRunDigits(series: number[][]): DigitCounts {
  const c: DigitCounts = new Array(10).fill(0);
  for (const s of series) for (const r of circularRuns(s.map(r1))) if (counted(r.v)) c[digit(r.v)]++;
  return c;
}

export interface Run {
  start: number;
  len: number;
  v: number;
}

/** Runs of equal consecutive months, wrapping December to January. */
export function circularRuns(out: number[]): Run[] {
  const n = out.length;
  const starts = out.map((_, i) => i).filter((i) => out[i] !== out[(i + n - 1) % n]);
  if (starts.length === 0) return [{ start: 0, len: n, v: out[0] }];
  return starts.map((s) => {
    let len = 1;
    while (len < n && out[(s + len) % n] === out[s]) len++;
    return { start: s, len, v: out[s] };
  });
}

/** The series with one run set to a new value (a copy). */
export function withRun(series: number[], run: Run, val: number): number[] {
  const c = series.slice();
  for (let k = 0; k < run.len; k++) c[(run.start + k) % c.length] = val;
  return c;
}

/** The best non-round replacement for a run, or null when none keeps the neighbouring months in order. */
function pickReplacement(out: number[], run: Run, counts: DigitCounts, coin: () => boolean, maxMove = 3, anyDigit = false, veto?: (val: number) => boolean): number | null {
  const n = out.length;
  const v = run.v;
  const prev = out[(run.start + n - 1) % n];
  const next = out[(run.start + run.len) % n];
  const ok = (cand: number) => {
    if (cand < 0.1 || cand > 9.8) return false;
    if (run.len === n) return true;
    for (const nb of [prev, next]) {
      if (nb === v) continue;
      if (Math.sign(v - nb) !== Math.sign(cand - nb) || Math.abs(cand - nb) < 0.1) return false;
    }
    return true;
  };
  const cands: Array<{ val: number; mv: number }> = [];
  for (let k = -maxMove; k <= maxMove; k++) {
    if (k === 0) continue;
    const val = r1(v + k / 10);
    // Catalog mode (anyDigit) may land on any last digit that is still below its fair share; authoring mode never lands on x.0 / x.5.
    if ((anyDigit ? counts[digit(val)] < 0.1 * counts.reduce((a, b) => a + b, 0) : !isRound(val)) && ok(val) && !veto?.(val)) cands.push({ val, mv: Math.abs(k) });
  }
  if (cands.length === 0) return null;
  // Prefer the digit furthest below its fair share, with a mild preference for the smaller move (a move of 0.4 only wins for a digit
  // that is nearly unused).
  const total = counts.reduce((a, b) => a + b, 0);
  const fair = Math.max(0.1 * total, 1);
  return cands
    .map((c) => ({ ...c, score: counts[digit(c.val)] / fair + 0.12 * c.mv, tie: coin() ? 0 : 1 }))
    .sort((a, b) => a.score - b.score || a.tie - b.tie)[0].val;
}

function coinFor(seed: string): () => boolean {
  let flip = seedFrom(seed);
  return () => ((flip = Math.imul(flip ^ (flip >>> 15), 2246822519) >>> 0), (flip & 1) === 1);
}

/**
 * One place, used while authoring: `counts` holds the digits of the places already done in this run. A round run stays when its
 * digit is still within its fair share (a tenth of everything so far, plus a little slack), otherwise it moves.
 */
export function avoidRoundScores(scores: number[], seed: string, counts: DigitCounts = new Array(10).fill(0)): number[] {
  const out = scores.map(r1);
  const coin = coinFor(seed);
  const runs = circularRuns(out).sort((a, b) => b.len - a.len || a.start - b.start);
  for (const run of runs) {
    if (!counted(run.v)) continue;
    if (!isRound(run.v)) {
      counts[digit(run.v)] += run.len; // non-round runs count towards the totals too
      continue;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    const d = digit(run.v);
    if (counts[d] + run.len <= 0.1 * (total + run.len) + 1.5) {
      counts[d] += run.len; // within its share: this round run stays
      continue;
    }
    const next = pickReplacement(out, run, counts, coin);
    if (next === null) {
      counts[d] += run.len;
      continue;
    }
    for (let k = 0; k < run.len; k++) out[(run.start + k) % out.length] = next;
    counts[digit(next)] += run.len;
  }
  return out;
}

/**
 * Whole catalog at once (used to even out places already written): runs across ALL places on an over-used last digit (x.0 and x.5
 * in practice, but any digit that is well above a tenth) are ranked by length and the longest move first until that digit is down to its
 * fair share, landing only on digits still below theirs. `exempt` places are never changed.
 */
export function evenTenthsCatalog(series: Record<string, number[]>, exempt: Set<string> = new Set(), opts: { maxMove?: number; protectPeak?: boolean; diffuse?: boolean; /** Count each run of equal months once instead of once per month (for judging a small batch on its own). */ byRun?: boolean; accept?: (id: string, candidate: number[]) => boolean } = {}): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, s] of Object.entries(series)) out[id] = s.map(r1);
  const counts = opts.byRun ? countRunDigits(Object.values(out)) : countDigits(Object.values(out));
  const unit = (len: number) => (opts.byRun ? 1 : len);
  const total = counts.reduce((a, b) => a + b, 0);
  const target = total / 10;
  const all: Array<{ id: string; run: Run }> = [];
  for (const id of Object.keys(out).sort()) {
    if (exempt.has(id)) continue;
    const peak = Math.max(...out[id]);
    for (const run of circularRuns(out[id])) if (counted(run.v) && !(opts.protectPeak && run.v === peak)) all.push({ id, run }); // protectPeak: an owner-approved best month is never moved
  }
  // Ties between equally long runs are broken by a hash of the place, not alphabetically, so no letter of the alphabet is favoured.
  const tieKey = (x: { id: string; run: Run }) => seedFrom(`${x.id}:${x.run.start}`);
  all.sort((a, b) => b.run.len - a.run.len || tieKey(a) - tieKey(b) || a.id.localeCompare(b.id));
  for (const { id, run } of all) {
    const d = digit(run.v);
    if (counts[d] - target <= Math.max(unit(run.len) / 2, 0.12 * target)) continue; // this digit is already about at its fair share
    const next = pickReplacement(out[id], run, counts, coinFor(id + run.start), opts.maxMove ?? 3, true, opts.accept ? (val) => !opts.accept!(id, withRun(out[id], run, val)) : undefined);
    if (next === null) continue;
    for (let k = 0; k < run.len; k++) out[id][(run.start + k) % out[id].length] = next;
    counts[d] -= unit(run.len);
    counts[digit(next)] += unit(run.len);
  }
  if (opts.diffuse) diffuseDigits(out, series, counts, exempt, opts);
  return out;
}

/**
 * Second phase (13 Nov 2026): the run-based pass above can only move a value to a digit it is within reach of, so a shortfall on .5 next to a
 * surplus on .0 never closes. This pass lets the surplus flow one step at a time: a run moves to a neighbouring digit whenever that digit holds
 * clearly fewer values than the one it leaves (so the sum of squared shares always falls and the loop ends), until no digit is more than half
 * the tolerance from 10% (any digit may give to an emptier neighbour, so a gap on .5 is filled by a chain .0 to .1 to .2 and so on). Moves are at most `maxMove` tenths, keep every month in order with its neighbours, never touch zeros, 10s, exempt places
 * or (with protectPeak) a place's best month, and a flat season moves as one block.
 */
function diffuseDigits(out: Record<string, number[]>, input: Record<string, number[]>, counts: DigitCounts, exempt: Set<string>, opts: { maxMove?: number; protectPeak?: boolean; byRun?: boolean; accept?: (id: string, candidate: number[]) => boolean }): void {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 30) return;
  const goal = Math.max(1, tenthsTolerance(total) / 2) * total / 100;
  const spread = () => Math.max(...counts.map((c) => Math.abs(c - total / 10)));
  const ids = Object.keys(out).filter((id) => !exempt.has(id)).sort();
  for (let pass = 0; pass < 60 && spread() > goal; pass++) {
    let moved = 0;
    const order: Array<{ id: string; run: Run }> = [];
    for (const id of ids) {
      const peak = Math.max(...out[id]);
      for (const run of circularRuns(out[id])) if (counted(run.v) && !(opts.protectPeak && run.v === peak)) order.push({ id, run });
    }
    order.sort((a, b) => seedFrom(`${a.id}:${a.run.start}:${pass}`) - seedFrom(`${b.id}:${b.run.start}:${pass}`));
    for (const { id, run } of order) {
      if (spread() <= goal) break;
      const cur = out[id];
      if (cur[run.start] !== run.v) continue; // changed earlier in this pass
      const d = digit(run.v);
      const n = cur.length, v = run.v, prev = cur[(run.start + n - 1) % n], next = cur[(run.start + run.len) % n];
      let best: { val: number; cost: number } | null = null;
      for (let k = -(opts.maxMove ?? 3); k <= (opts.maxMove ?? 3); k++) {
        if (k === 0) continue;
        const val = r1(v + k / 10);
        if (val < 0.1 || val > 9.8) continue;
        if (counts[digit(val)] + (opts.byRun ? 1 : run.len) >= counts[d]) continue; // must land on a clearly emptier digit
        if (Array.from({ length: run.len }, (_, j) => (run.start + j) % n).some((m) => Math.abs(val - input[id][m]) > (opts.maxMove ?? 3) / 10 + 1e-6)) continue; // never drift more than maxMove from the original
        if (run.len < n && [prev, next].some((nb) => nb !== v && (Math.sign(v - nb) !== Math.sign(val - nb) || Math.abs(val - nb) < 0.1))) continue;
        if (opts.accept && !opts.accept(id, withRun(cur, run, val))) continue;
        const cost = counts[digit(val)] + 3 * Math.abs(k);
        if (!best || cost < best.cost) best = { val, cost };
      }
      if (!best) continue;
      for (let j = 0; j < run.len; j++) cur[(run.start + j) % n] = best.val;
      counts[d] -= opts.byRun ? 1 : run.len;
      counts[digit(best.val)] += opts.byRun ? 1 : run.len;
      moved++;
    }
    if (moved === 0) break;
  }
}

// ---- The measure (13 Nov 2026) ------------------------------------------------------------------------------------------------------------------
// The owner's rule, stated once so every path uses the same test: each last digit .0 to .9 turns up about 10% of the time. Not "avoid .0 and .5"
// (that makes .4 and .6 pile up instead); EVEN. This is the measure the status report, the scanner and the save gates all use.

/** How far, in percentage points, a digit's share may stray from 10%: 2.5 standard errors of a fair spread, never under 2 points. */
export function tenthsTolerance(n: number): number {
  if (n <= 0) return 100;
  return Math.max(2, 2.5 * Math.sqrt(0.1 * 0.9 / n) * 100);
}

export interface DigitReport {
  /** Values counted (zeros and 10s are not). */
  n: number;
  counts: DigitCounts;
  /** Share of each digit, in percent. */
  shares: number[];
  tolerance: number;
  /** The digit furthest from 10% and by how many points. */
  worst: { digit: number; off: number };
  /** True when every digit is within tolerance. */
  even: boolean;
}

export function digitReport(series: number[][]): DigitReport {
  const counts = countDigits(series);
  const n = counts.reduce((a, b) => a + b, 0);
  const shares = counts.map((c) => (n ? (100 * c) / n : 0));
  const tolerance = tenthsTolerance(n);
  const offs = shares.map((s) => s - 10);
  const wi = offs.reduce((bi, o, i) => (Math.abs(o) > Math.abs(offs[bi]) ? i : bi), 0);
  return { n, counts, shares, tolerance, worst: { digit: wi, off: offs[wi] }, even: n < 30 ? true : offs.every((o) => Math.abs(o) <= tolerance) };
}

/** The best month of each place (10s and zeros left out): the owner also looks at the peaks as a row, so they get their own test. */
export function peakSeries(series: number[][]): number[][] {
  return [series.map((s) => Math.max(...s)).filter(counted)];
}

/** One line for a log: "digits .0-.9: 10 9 11 ... (worst .4 +2.1 points, tolerance 2.4): even" */
export function describeDigits(rep: DigitReport): string {
  return `digits .0-.9 (percent): ${rep.shares.map((s) => String(Math.round(s)).padStart(2)).join(' ')}  n=${rep.n}  worst .${rep.worst.digit} ${rep.worst.off >= 0 ? '+' : ''}${rep.worst.off.toFixed(1)} (tolerance ${rep.tolerance.toFixed(1)}): ${rep.even ? 'even' : 'UNEVEN'}`;
}

/**
 * Evens a new batch against what is already live. The live series count towards the totals but are never touched; only the new series move
 * (by at most 0.3, neighbors kept in order, flat seasons kept flat, zeros and 10s untouched). Returns the new series and both reports.
 */
export function balanceAgainstLive(newSeries: Record<string, number[]>, liveSeries: number[][] = [], opts: { maxMove?: number; protectPeak?: boolean; accept?: (id: string, candidate: number[]) => boolean } = {}): { series: Record<string, number[]>; before: DigitReport; after: DigitReport; combinedAfter: DigitReport } {
  const live: Record<string, number[]> = {};
  liveSeries.forEach((s, i) => { live[`__live${i}`] = s; });
  const merged = evenTenthsCatalog({ ...live, ...newSeries }, new Set(Object.keys(live)), { maxMove: opts.maxMove ?? 3, protectPeak: opts.protectPeak, diffuse: true, accept: opts.accept });
  const series: Record<string, number[]> = {};
  for (const id of Object.keys(newSeries)) series[id] = merged[id];
  return { series, before: digitReport(Object.values(newSeries)), after: digitReport(Object.values(series)), combinedAfter: digitReport([...liveSeries, ...Object.values(series)]) };
}

/**
 * Throws with a readable table when a batch (together with what is live) is still uneven: the gate every save path calls.
 * The best months of the places are reported (describeDigits(digitReport(peakSeries(...)))) but do not block: a best month is the top of a
 * dozen values, so its last digit is naturally skewed upward, and balancing the whole spread is what keeps peaks off long runs of .0 and .5.
 */
export function assertEvenTenths(label: string, newSeries: number[][], liveSeries: number[][] = []): DigitReport {
  const rep = digitReport([...liveSeries, ...newSeries]);
  if (!rep.even) throw new Error(`${label}: last digits are uneven. ${describeDigits(rep)}. Run the balance step (balanceAgainstLive) before saving.`);
  return rep;
}
