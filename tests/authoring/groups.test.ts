import { describe, it, expect } from 'vitest';
import { groupMonths, fitsOneGroup, levelFor, describeMonths } from '@/lib/authoring/groups';

describe('month groups built from scores', () => {
  it('only ever joins neighboring months, across December and January', () => {
    const g = groupMonths([5.2, 5.4, 5.6, 6.1, 7.8, 9.6, 10, 9.8, 9.3, 7.5, 5.1, 5.3]);
    for (const x of g) { const set = new Set(x.months); expect(x.months.every((m) => set.has(((m % 12) + 1))|| x.months.indexOf(m) === x.months.length - 1)).toBe(true); }
    expect(g.map((x) => x.months)).toEqual([[11, 12, 1, 2, 3], [4], [5], [6, 7, 8], [9], [10]]);
  });
  it('keeps every spread within 0.5, or within 1.0 on a smooth climb or fall', () => {
    const scores = [2.1, 2.4, 2.9, 3.6, 4.4, 5.2, 5.9, 6.1, 5.5, 4.0, 3.1, 2.4];
    for (const g of groupMonths(scores)) { const v = g.months.map((m) => scores[m - 1]); expect(fitsOneGroup(v)).toBe(true); }
  });
  it('gives a flat year one group', () => {
    expect(groupMonths(new Array(12).fill(9.2))).toHaveLength(1);
    expect(groupMonths(new Array(12).fill(9.2))[0].months).toHaveLength(12);
  });
  it('separates closed months and keeps them together', () => {
    const g = groupMonths([10, 9.8, 8.5, 0, 0, 0, 0, 0, 0, 0, 8.7, 9.7]);
    const closed = g.find((x) => x.level === 'closed')!;
    expect(closed.months).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(g.every((x) => x.level === 'closed' || x.months.every((m) => ![4, 5, 6, 7, 8, 9, 10].includes(m)))).toBe(true);
  });
  it('splits a dip that a reader would not expect, but allows a smooth fall of up to a point', () => {
    expect(fitsOneGroup([7, 7.4, 7.9])).toBe(true);
    expect(fitsOneGroup([7.5, 7, 7.9])).toBe(false);
    expect(fitsOneGroup([6, 7.2])).toBe(false);
  });
  it('words levels against the best month and names months', () => {
    expect(levelFor(9.8, 10)).toBe('peak'); expect(levelFor(8, 10)).toBe('good'); expect(levelFor(5.5, 10)).toBe('fair'); expect(levelFor(2, 10)).toBe('poor'); expect(levelFor(0, 10)).toBe('closed');
    expect(describeMonths([11, 12, 1])).toBe('November to January'); expect(describeMonths([4])).toBe('April');
  });
});
