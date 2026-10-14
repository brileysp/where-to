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

interface Run {
  start: number;
  len: number;
  v: number;
}

/** Runs of equal consecutive months, wrapping December to January. */
function circularRuns(out: number[]): Run[] {
  const n = out.length;
  const starts = out.map((_, i) => i).filter((i) => out[i] !== out[(i + n - 1) % n]);
  if (starts.length === 0) return [{ start: 0, len: n, v: out[0] }];
  return starts.map((s) => {
    let len = 1;
    while (len < n && out[(s + len) % n] === out[s]) len++;
    return { start: s, len, v: out[s] };
  });
}

/** The best non-round replacement for a run, or null when none keeps the neighbouring months in order. */
function pickReplacement(out: number[], run: Run, counts: DigitCounts, coin: () => boolean, maxMove = 3, anyDigit = false): number | null {
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
    if ((anyDigit ? counts[digit(val)] < 0.1 * counts.reduce((a, b) => a + b, 0) : !isRound(val)) && ok(val)) cands.push({ val, mv: Math.abs(k) });
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
export function evenTenthsCatalog(series: Record<string, number[]>, exempt: Set<string> = new Set(), opts: { maxMove?: number } = {}): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, s] of Object.entries(series)) out[id] = s.map(r1);
  const counts = countDigits(Object.values(out));
  const total = counts.reduce((a, b) => a + b, 0);
  const target = total / 10;
  const all: Array<{ id: string; run: Run }> = [];
  for (const id of Object.keys(out).sort()) {
    if (exempt.has(id)) continue;
    for (const run of circularRuns(out[id])) if (counted(run.v)) all.push({ id, run });
  }
  // Ties between equally long runs are broken by a hash of the place, not alphabetically, so no letter of the alphabet is favoured.
  const tieKey = (x: { id: string; run: Run }) => seedFrom(`${x.id}:${x.run.start}`);
  all.sort((a, b) => b.run.len - a.run.len || tieKey(a) - tieKey(b) || a.id.localeCompare(b.id));
  for (const { id, run } of all) {
    const d = digit(run.v);
    if (counts[d] - target <= Math.max(run.len / 2, 0.12 * target)) continue; // this digit is already about at its fair share
    const next = pickReplacement(out[id], run, counts, coinFor(id + run.start), opts.maxMove ?? 3, true);
    if (next === null) continue;
    for (let k = 0; k < run.len; k++) out[id][(run.start + k) % out[id].length] = next;
    counts[d] -= run.len;
    counts[digit(next)] += run.len;
  }
  return out;
}
