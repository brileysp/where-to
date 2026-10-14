import { describe, it, expect } from 'vitest';
import { avoidRoundScores, countDigits, evenTenthsCatalog } from '../../src/lib/gemini/even-tenths';

const dig = (v: number) => Math.round(v * 10) % 10;
const share = (series: number[][], d: number) => {
  const c = countDigits(series);
  return c[d] / c.reduce((a, b) => a + b, 0);
};
// A catalog the way Gemini writes it: long strings of x.5 and x.0.
function lazyCatalog(n: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (let p = 0; p < n; p++) {
    const lo = 3 + (p % 3), hi = lo + 1 + (p % 2);
    out[`p${String(p).padStart(2, '0')}`] = [lo + 0.5, lo + 0.5, lo + 0.5, lo + 0.5, lo + 0.5, hi + 0.5, hi + 0.5, hi + 0.5, hi + 0.5, hi + 0.5, lo + 0.5, lo + 0.5];
  }
  return out;
}

describe('evenTenthsCatalog', () => {
  it('brings x.0 and x.5 down to about a tenth each, not to zero', () => {
    const out = evenTenthsCatalog(lazyCatalog(60), new Set(), { maxMove: 5 });
    const all = Object.values(out);
    // The input is nothing but x.5; afterwards .5 is one digit among ten, not a clump, and no digit dominates.
    expect(share(all, 5)).toBeGreaterThan(0.06);
    expect(share(all, 5)).toBeLessThan(0.14);
    for (let d = 0; d < 10; d++) expect(share(all, d)).toBeLessThan(0.16);
  });
  it('moves the longest strings first and keeps flat seasons flat', () => {
    const out = evenTenthsCatalog(lazyCatalog(60), new Set(), { maxMove: 5 });
    for (const s of Object.values(out)) {
      expect(new Set(s.slice(5, 10)).size).toBe(1);
      expect(s[0]).toBe(s[11]);
    }
  });
  it('also fixes a non-round digit that is badly over-used and one that is starved', () => {
    // .4 is everywhere and .7 almost never used
    const series: Record<string, number[]> = {};
    for (let p = 0; p < 40; p++) series[`q${p}`] = [3.4, 3.4, 3.4, 3.4, 5.4, 5.4, 5.4, 5.4, 4.4, 4.4, 4.4, 3.4].map((v) => v + (p % 5) * 0.01 * 0);
    const out = evenTenthsCatalog(series, new Set(), { maxMove: 4 });
    expect(share(Object.values(out), 4)).toBeLessThan(0.2);
    expect(share(Object.values(out), 7) + share(Object.values(out), 6)).toBeGreaterThan(0.1);
  });
  it('never moves zeros, tens or exempt places, and never by more than 0.3', () => {
    const series = { ...lazyCatalog(30), closed: [0, 0, 0, 6, 6.5, 7, 7.5, 7, 6.5, 6, 0, 0], keep: [9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5] };
    const out = evenTenthsCatalog(series, new Set(['keep']));
    expect(out.keep).toEqual(series.keep);
    out.closed.forEach((v, i) => { if (series.closed[i] === 0) expect(v).toBe(0); });
    for (const id of Object.keys(series)) out[id].forEach((v, i) => expect(Math.abs(v - series[id as keyof typeof series][i])).toBeLessThanOrEqual(0.3001));
  });
  it('keeps the order of neighbouring months', () => {
    const series = { a: [3, 3.5, 4, 4.5, 5, 5.5, 5.5, 5, 4.5, 4, 3.5, 3], ...lazyCatalog(20) };
    const out = evenTenthsCatalog(series);
    for (let i = 0; i < 12; i++) {
      const j = (i + 1) % 12;
      expect(Math.sign(out.a[j] - out.a[i])).toBe(Math.sign(series.a[j] - series.a[i]));
    }
  });
});

describe('avoidRoundScores (while authoring)', () => {
  it('keeps round values at about a tenth each over a run of places, with the strings gone', () => {
    const counts = new Array(10).fill(0);
    const all: number[][] = [];
    for (const [id, s] of Object.entries(lazyCatalog(60))) all.push(avoidRoundScores(s, id, counts));
    expect(share(all, 5)).toBeLessThan(0.16);
    expect(share(all, 5)).toBeGreaterThan(0.03);
    expect(all.every((s) => s.length === 12)).toBe(true);
    expect(dig(all[0][0])).not.toBeNaN();
  });
});
