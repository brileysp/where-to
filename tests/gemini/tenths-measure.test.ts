import { describe, expect, it } from 'vitest';
import { digitReport, tenthsTolerance, balanceAgainstLive, assertEvenTenths, peakSeries } from '@/lib/gemini/even-tenths';

const rnd = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const place = (r: () => number, digits: number[]) => Array.from({ length: 12 }, () => Math.round((2 + Math.floor(r() * 7) + digits[Math.floor(r() * digits.length)] / 10) * 10) / 10);

describe('the last-digit measure', () => {
  it('calls an even spread even and a pile-up on .4 and .6 uneven (not just .0 and .5)', () => {
    const r = rnd(1);
    const even = Array.from({ length: 60 }, () => place(r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(digitReport(even).even).toBe(true);
    const lumpy = Array.from({ length: 60 }, () => place(r, [4, 6, 4, 6, 1, 9]));
    const rep = digitReport(lumpy); expect(rep.even).toBe(false); expect([4, 6]).toContain(rep.worst.digit);
  });
  it('widens the tolerance for small batches and never goes under 2 points', () => {
    expect(tenthsTolerance(100)).toBeGreaterThan(tenthsTolerance(1000)); expect(tenthsTolerance(100000)).toBe(2);
  });
  it('does not count zeros and 10s', () => { expect(digitReport([[0, 10, 6.3]]).n).toBe(1); });
  it('balances a lumpy new batch against live scores without touching the live ones, and keeps flat seasons flat and order', () => {
    const r = rnd(7);
    const live = Array.from({ length: 80 }, () => place(r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    const fresh: Record<string, number[]> = {}; for (let i = 0; i < 40; i++) fresh[`p${i}`] = place(r, [4, 6, 4, 6, 5]);
    fresh.flat = Array(12).fill(5.5);
    const out = balanceAgainstLive(fresh, live);
    expect(out.before.even).toBe(false); expect(out.combinedAfter.worst.off).toBeLessThan(digitReport([...live, ...Object.values(fresh)]).worst.off + 1e-9);
    expect(new Set(out.series.flat).size).toBe(1);
    for (const [id, s] of Object.entries(out.series)) s.forEach((v, i) => { expect(Math.abs(v - fresh[id][i])).toBeLessThanOrEqual(0.31); });
  });
  it('can protect each place\'s best month from being moved', () => {
    const fresh: Record<string, number[]> = {}; for (let i = 0; i < 30; i++) fresh[`p${i}`] = [4.5, 5, 6.5, 7, 8, 9.5, 9, 8, 7.5, 6, 5.5, 5];
    const out = balanceAgainstLive(fresh, [], { protectPeak: true });
    for (const s of Object.values(out.series)) expect(s[5]).toBe(9.5);
  });
  it('the gate throws on an uneven batch and passes an even one', () => {
    const r = rnd(3);
    const live = Array.from({ length: 100 }, () => place(r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    const bad = Array.from({ length: 50 }, () => place(r, [5, 0, 5]));
    expect(() => assertEvenTenths('test', bad, live)).toThrow(/uneven/);
    expect(() => assertEvenTenths('test', live.slice(0, 10), live.slice(10))).not.toThrow();
  });
  it('looks at the best month of each place as its own row', () => {
    expect(peakSeries([[3.1, 8.5, 2], [9.9, 1], [10, 4]])).toEqual([[8.5, 9.9]]);
  });
});
