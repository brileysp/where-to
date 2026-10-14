// Post-processing for Gemini's 12 monthly scores. The model clusters on whole
// numbers and .5s and repeats values in pairs (5, 5, 5.8, 5.8, 4.5, 4.5, ...),
// which flattens every ranking. User rule (2026-10-03): a 5.0 or 5.5 must occur
// about as often as a 5.1 or 5.6, and adjacent months never repeat a value.
//
// Method: nudge each score by at most 0.2 so the last digit is spread evenly
// (a score on x.0 can become x.8-x.2, a score on x.5 can become x.3-x.7, so
// across a catalog every digit gets used), then re-sample until: adjacent
// months never share a value; no new 0.5+ jump appears; months that were equal stay within 0.3 of each
// other (so one shared blurb is still honest); any pair that differed by 0.2+
// keeps its order; literal 10s are left alone. Deterministic per seed.

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function decimalizeScores(orig: number[], seed: string): number[] {
  const rand = mulberry32(seedFrom(seed));
  const n = orig.length;
  const candidatesFor = (v: number): number[] => {
    if (v >= 10) return [10];
    const out: number[] = [];
    for (let d = -2; d <= 2; d++) {
      const c = r1(v + d / 10);
      if (c >= 0 && c <= 9.9) out.push(c);
    }
    return out.length ? out : [v];
  };
  let best = orig.slice();
  for (let attempt = 0; attempt < 500; attempt++) {
    const next = orig.map((v) => {
      const c = candidatesFor(v);
      return c[Math.floor(rand() * c.length)];
    });
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      if (i + 1 < n && Math.abs(next[i] - next[i + 1]) < 0.05 && next[i] < 10) ok = false;
      // Never create a 0.5+ month-to-month jump that was not there (it would demand a distinct blurb).
      if (i + 1 < n && Math.abs(orig[i] - orig[i + 1]) < 0.45 && Math.abs(next[i] - next[i + 1]) >= 0.45) ok = false;
      for (let j = i + 1; j < n && ok; j++) {
        const od = orig[i] - orig[j];
        const nd = next[i] - next[j];
        if (Math.abs(od) < 0.05 && Math.abs(nd) > 0.35) ok = false;
        if (Math.abs(od) >= 0.2 && Math.sign(od) !== Math.sign(nd)) ok = false;
      }
    }
    if (ok) return next;
    best = next;
  }
  return best;
}

/**
 * A place whose twelve months all share one blurb is equally good all year, so its score is one flat value
 * and the digit-spreading above must not touch it (owner rule, 7 Oct 2026). Returns the flat scores, or
 * null when the months do not all share one blurb.
 */
export function flatScoresIfSingleBlurb(texts: string[], scores: number[]): number[] | null {
  if (texts.length === 0 || texts.some((t) => t.trim().toLowerCase() !== texts[0].trim().toLowerCase())) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return scores.map(() => r1(mean));
}

/**
 * The digit-spreading above must not wiggle a stretch the model scored flat (owner rule, 9 Oct 2026: Chicago's closed
 * winter months were 0.5, 0.5, 0.5 from Gemini and came out 0.7, 0.5, 0.7). Identical text does NOT always mean identical
 * scores: a slow build or fall may legitimately give 4.4 then 4.7 on the same words. So:
 *  - months with identical text whose raw scores the model gave as equal keep exactly that value;
 *  - months with identical text sitting at the bottom of the year (within 0.3 of the lowest score) are one flat value
 *    (the group's mean), because a trough, as when nobody dives, is not a slope;
 *  - everything else keeps its digit-spread value.
 */
export function holdFlatMonths(texts: string[], raw: number[], spread: number[]): number[] {
  const groups = new Map<string, number[]>();
  texts.forEach((t, i) => {
    const key = t.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const floor = Math.min(...raw);
  const out = spread.slice();
  const frozen = new Set<number>();
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const vals = idx.map((i) => raw[i]);
    const equal = Math.max(...vals) - Math.min(...vals) < 0.05;
    const trough = Math.max(...vals) <= floor + 0.3;
    if (!equal && !trough) continue;
    const v = equal ? vals[0] : r1(vals.reduce((a, b) => a + b, 0) / vals.length);
    for (const i of idx) {
      out[i] = v;
      frozen.add(i);
    }
  }
  // A spread month must not land on exactly the same value as a frozen neighbour (adjacent months never repeat).
  for (let i = 0; i < out.length; i++) {
    if (frozen.has(i) || out[i] >= 10) continue;
    for (const j of [i - 1, i + 1]) {
      if (j >= 0 && j < out.length && frozen.has(j) && Math.abs(out[i] - out[j]) < 0.05) out[i] = r1(out[i] + (out[i] >= 9.8 ? -0.1 : 0.1));
    }
  }
  return out;
}

/**
 * A long steady stretch (four or more months within 0.2 of each other) must not be wobbled by the digit spreading above: Gemini
 * wrote 6.5 for five winter months and the spreading turned them into 6.4, 6.5, 6.4, 6.6, 6.7 (Cape Town, 10 Oct 2026). The months
 * in such a stretch become one flat value, the mean of what Gemini wrote.
 */
export function holdFlatBands(raw: number[], spread: number[], inBand: boolean[]): number[] {
  const out = spread.slice();
  const n = raw.length;
  // Group consecutive in-band months (circular), but start a new group wherever the level changes by more than 0.2 from the group's first
  // month: two different flat stretches side by side (Antarctica's 7.5 summer and its 0 winter) are two bands, not one.
  const seen = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!inBand[i] || seen[i]) continue;
    let start = i;
    while (inBand[(start + n - 1) % n] && (start + n - 1) % n !== i && Math.abs(raw[(start + n - 1) % n] - raw[i]) <= 0.2) start = (start + n - 1) % n;
    const idx: number[] = [];
    for (let k = start; inBand[k % n] && idx.length < n && Math.abs(raw[k % n] - raw[start]) <= 0.2; k++) idx.push(k % n);
    idx.forEach((j) => (seen[j] = true));
    const mean = r1(idx.reduce((a, j) => a + raw[j], 0) / idx.length);
    idx.forEach((j) => (out[j] = mean));
  }
  return out;
}
