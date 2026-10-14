// Gentle smoothing for blocky monthly scores (owner request, 10 Oct 2026). No model calls: pure arithmetic on the 12 numbers.
//
// Gemini often returns a season as steps (9.5, 9.5, 9.5, 9.2, 9.2, 8.5, 8.0, 7.5, 7.5): real conditions change gradually, so a
// repeated value in the middle of a slope is unnatural. This tool is used ONLY when a series is blocky (see isBlocky); a series
// that is already varied, or genuinely flat all year, is returned untouched. What it never does:
//   - move a month more than MAX_MOVE from what Gemini wrote, or past the year's highest or lowest value;
//   - touch a closed season: two or more adjacent months at the bottom of the year and at 1.0 or below stay exactly flat;
//   - flatten a real dip or hump: a plateau that is a local high or low (both neighbours lower, or both higher) keeps its level;
//   - blur a hard edge (a drop of 2.5 or more between neighbours, such as a season closing): both ends stay near where they were;
//   - blur an intended step: when the month texts are given, a change of 1.0 or more between two months whose blurbs differ (a dry season
//     or an animal arriving, then staying) keeps both months where Gemini put them. Only blocks inside one described stretch are eased;
//   - lower the peak: months at the year's highest value keep their weight so the top stays where Gemini put it.
// Method: a circular Whittaker smoother (weighted least squares with a second-difference penalty). Months inside a plateau get a low
// weight, so they are pulled toward the slope their neighbours describe, while months that mark something real keep a high weight.

const N = 12;
const MAX_MOVE = 0.7;
const STEP_INTENT = 1; // a jump this big between months with different text is something that really happens, not a lazy plateau
const LOW_AMPLITUDE = 1.5; // a year spanning less than this is gently varying: long flat stretches are steps, not floors
const CLOSED_CEILING = 1; // a bottom-of-year run at or below this is a closed season (nobody dives): exactly flat, never smoothed
const LAMBDA = 4;
const r1 = (x: number) => Math.round(x * 10 + 1e-9) / 10;
const same = (a: number, b: number) => Math.abs(a - b) < 0.05;

/** Runs of equal adjacent values, treating the year as a circle. */
function equalRuns(o: number[]): number[][] {
  const seen = new Array<boolean>(N).fill(false);
  const runs: number[][] = [];
  for (let i = 0; i < N; i++) {
    if (seen[i]) continue;
    let start = i;
    while (same(o[(start + N - 1) % N], o[start]) && (start + N - 1) % N !== i) start = (start + N - 1) % N;
    const run = [start];
    let k = start;
    while (same(o[(k + 1) % N], o[k]) && (k + 1) % N !== start) {
      k = (k + 1) % N;
      run.push(k);
    }
    run.forEach((x) => (seen[x] = true));
    runs.push(run);
  }
  return runs;
}

/** Months inside a long, steady stretch: four or more adjacent months within 0.2 of each other (an off-season floor that wobbles by a tenth). */
export function flatBandMonths(o: number[]): boolean[] {
  // In a year that barely moves (under LOW_AMPLITUDE) a long flat stretch is just one step of a staircase, not a real floor.
  if (Math.max(...o) - Math.min(...o) < LOW_AMPLITUDE) return new Array<boolean>(N).fill(false);
  const inBand = new Array<boolean>(N).fill(false);
  for (let start = 0; start < N; start++) {
    let lo = o[start];
    let hi = o[start];
    let len = 1;
    while (len < N) {
      const v = o[(start + len) % N];
      if (Math.max(hi, v) - Math.min(lo, v) > 0.2) break;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      len++;
    }
    if (len >= 4) for (let k = 0; k < len; k++) inBand[(start + k) % N] = true;
  }
  return inBand;
}

/** Blocky = two or more repeated adjacent values that are not part of a closed-season floor, a long steady stretch or the top of the year, in a year that actually moves. */
export function isBlocky(o: number[]): boolean {
  if (o.length !== N) return false;
  if (Math.max(...o) - Math.min(...o) < 0.6) return false;
  const floor = Math.min(...o) + 0.3;
  const band = flatBandMonths(o);
  let repeats = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    if (same(o[i], o[j]) && !(o[i] <= floor && o[j] <= floor && o[i] <= CLOSED_CEILING) && !(band[i] && band[j] && o[i] < Math.max(...o) - 0.05) && !(o[i] >= Math.max(...o) - 0.05)) repeats++; // a slab at the very top is a peak season, not a block on a slope
  }
  return repeats >= 2;
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Smooths a blocky series; returns the input unchanged (a copy) when it is not blocky. */
export function smoothBlockyScores(orig: number[], texts?: string[]): number[] {
  if (!isBlocky(orig)) return orig.slice();
  const mx = Math.max(...orig);
  const mn = Math.min(...orig);
  const floor = mn + 0.3;
  const w = new Array<number>(N).fill(1);
  const frozen = new Array<boolean>(N).fill(false);
  const target = orig.slice();
  const runs = equalRuns(orig);
  const inRun = new Array<boolean>(N).fill(false);
  for (const run of runs) {
    run.forEach((i) => (inRun[i] = true));
    const v = orig[run[0]];
    const before = orig[(run[0] + N - 1) % N];
    const after = orig[(run[run.length - 1] + 1) % N];
    const isMax = v >= mx - 0.05;
    const high = before < v && after < v;
    const low = before > v && after > v;
    const extremum = high || low;
    if (run.length < 2) {
      if (isMax) frozen[run[0]] = true; // a single-month peak is never lowered
      else if (extremum) w[run[0]] = 20;
      continue;
    }
    if (v <= floor && v <= CLOSED_CEILING) run.forEach((i) => (frozen[i] = true)); // closed season: exactly flat
    else if (extremum && run.length >= 5 && Math.max(...orig) - Math.min(...orig) >= LOW_AMPLITUDE) run.forEach((i) => (frozen[i] = true)); // a long flat season stays one level
    else if (extremum && run.length >= 3) {
      // A slab of 3-4 months at a top or a bottom keeps its level in the middle and eases at its two edges toward the slope.
      run.forEach((i) => (frozen[i] = true));
      const step = (outside: number) => (Math.abs(v - outside) >= 1 ? 0.2 : 0.1) * (high ? -1 : 1);
      target[run[0]] = r1(v + step(before));
      target[run[run.length - 1]] = r1(v + step(after));
    } else if (isMax) run.forEach((i) => (frozen[i] = true)); // a two-month peak is natural
    else if (extremum) run.forEach((i) => (w[i] = 20)); // a short real dip or hump keeps its level
    else run.forEach((i) => (w[i] = 0.12)); // a block on a slope is pulled onto the slope
  }
  // A long steady stretch (an off-season floor that wobbles by a tenth) is one described condition: it stays exactly as written.
  const band = flatBandMonths(orig);
  for (let i = 0; i < N; i++) if (band[i] && orig[i] < mx - 0.05) frozen[i] = true;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    if (Math.abs(orig[i] - orig[j]) >= 2.5) {
      w[i] = Math.max(w[i], 80); // a hard edge (a season starting or stopping) is held firmly
      w[j] = Math.max(w[j], 80);
    }
  }
  void inRun;
  if (texts && texts.length === N) {
    const norm = (t: string) => t.trim().toLowerCase();
    for (let i = 0; i < N; i++) {
      const prev = (i + N - 1) % N;
      if (norm(texts[i]) !== norm(texts[prev]) && Math.abs(orig[i] - orig[prev]) >= STEP_INTENT) {
        w[i] = Math.max(w[i], 80);
        w[prev] = Math.max(w[prev], 80);
      }
    }
  }
  frozen.forEach((f, i) => f && (w[i] = 1e4));
  // (W + lambda * D'D) s = W o, D = circular second difference
  const A = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  for (let i = 0; i < N; i++) A[i][i] += w[i];
  for (let r = 0; r < N; r++) {
    // Do not penalize curvature across a hard edge (a drop of 2.5 or more): smoothing "through" a cliff makes the far side ring.
    if (Math.abs(orig[(r + N - 1) % N] - orig[r]) >= 2.5 || Math.abs(orig[r] - orig[(r + 1) % N]) >= 2.5) continue;
    const idx = [(r + N - 1) % N, r, (r + 1) % N];
    const coef = [1, -2, 1];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) A[idx[a]][idx[b]] += LAMBDA * coef[a] * coef[b];
  }
  const s = solve(A, target.map((v, i) => w[i] * v)).map((v, i) => r1(Math.min(mx, Math.max(mn, Math.min(orig[i] + MAX_MOVE, Math.max(orig[i] - MAX_MOVE, v))))));
  frozen.forEach((f, i) => f && (s[i] = target[i]));
  // Between two fixed points (a frozen month, a kept peak or dip, an intended step) the months must run one way, never bump:
  // a rise from May's 8.9 to August's 9.4 may not spike to 9.5 in July. Enforce that with a forward and a backward clamp.
  const pivots = [...Array(N).keys()].filter((i) => w[i] >= 6);
  for (let a = 0; a < pivots.length; a++) {
    const p = pivots[a];
    const q = pivots[(a + 1) % pivots.length];
    const span = (q - p + N) % N;
    if (span < 2 || (pivots.length === 1 && span === 0)) continue;
    const dir = Math.sign(s[q] - s[p]);
    if (dir === 0) continue;
    for (let k = 1; k < span; k++) {
      const i = (p + k) % N;
      const prev = s[(i + N - 1) % N];
      s[i] = dir > 0 ? Math.max(s[i], prev) : Math.min(s[i], prev);
    }
    for (let k = span - 1; k >= 1; k--) {
      const i = (p + k) % N;
      const next = s[(i + 1) % N];
      s[i] = dir > 0 ? Math.min(s[i], next) : Math.max(s[i], next);
    }
    // If the stretch still has a tie, lay its months evenly between the two fixed points (a ramp, not a block).
    const stretch = Array.from({ length: span + 1 }, (_, k) => s[(p + k) % N]);
    // Only when the months already lie near that ramp: a stretch with a real step inside it (Death Valley's Oct) is left alone.
    if (stretch.some((v, k) => k > 0 && same(v, stretch[k - 1]))) {
      const line = (k: number) => s[p] + ((s[q] - s[p]) * k) / span;
      const nearLine = Array.from({ length: span - 1 }, (_, k) => k + 1).every((k) => Math.abs(stretch[k] - line(k)) <= 0.4);
      if (nearLine) for (let k = 1; k < span; k++) s[(p + k) % N] = r1(line(k));
    }
  }
  // No two adjacent months may still match (outside a frozen run). Spread each leftover run of equal values: on a slope it is
  // interpolated between its two neighbours; at a local high or low it is domed by a tenth toward the nearer neighbour.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const run of equalRuns(s)) {
      if (run.length < 2 || run.some((i) => frozen[i])) continue;
      const v = s[run[0]];
      const before = s[(run[0] + N - 1) % N];
      const after = s[(run[run.length - 1] + 1) % N];
      const m = run.length;
      const between = (before < v && v < after) || (after < v && v < before);
      const vals = run.map((_, k) => {
        if (between) return r1(before + ((after - before) * (k + 1)) / (m + 1));
        const down = before < v && after < v ? -0.1 : 0.1; // local high eases down, local low eases up
        const edge = Math.abs(before - v) <= Math.abs(after - v) ? 0 : m - 1;
        return r1(v + (k === edge ? down : 0));
      });
      // a run on a slope that interpolation would leave tied (a very small gap) keeps a tenth between members
      for (let k = 1; k < m; k++) if (same(vals[k], vals[k - 1])) vals[k] = r1(vals[k] + (after >= before ? 0.1 : -0.1));
      run.forEach((i, k) => {
        const nv = Math.min(mx, Math.max(mn, vals[k]));
        if (nv !== s[i]) changed = true;
        s[i] = nv;
      });
    }
    if (!changed) break;
  }
  // Last resort for any tie left over: move the one non-frozen member by a tenth, whichever way creates no new tie and stays closest to
  // what Gemini wrote.
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      if (!same(s[i], s[j]) || (frozen[i] && frozen[j])) continue;
      const k = frozen[j] ? i : j;
      const nbrs = [s[(k + N - 1) % N], s[(k + 1) % N]];
      const options = [r1(s[k] + 0.1), r1(s[k] - 0.1)]
        .filter((v) => v <= mx && v >= mn && nbrs.every((x) => !same(v, x)))
        .sort((a, b) => Math.abs(a - orig[k]) - Math.abs(b - orig[k]));
      if (options.length) {
        s[k] = options[0];
        changed = true;
      }
    }
    if (!changed) break;
  }
  // The promise to the owner: no month ends up more than MAX_MOVE from what Gemini wrote, whatever the steps above did.
  for (let i = 0; i < N; i++) if (!frozen[i]) s[i] = r1(Math.min(orig[i] + MAX_MOVE, Math.max(orig[i] - MAX_MOVE, s[i])));
  return s;
}
