import { describe, expect, it } from 'vitest';
import { assertBatchAcceptable, batchIsAcceptable, cellClump, checkBatch, declumpCells, fixBatch } from '@/lib/gemini/clump';

// The cells that were saved looking like this on 13 Nov 2026 (owner: "how did this happen?").
const DOLOMITES = [5.5, 5.5, 5.5, 4.4, 6.5, 9.5, 10, 10, 9.5, 8.5, 4.5, 5.5];
const VENICE = [5.5, 5.5, 6, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 5.5, 5.5];
const FINE = [2.5, 2.6, 2.8, 3.5, 4.2, 4.5, 4.6, 4.5, 4.3, 3.6, 3.2, 2.7];
const FLAT = new Array(12).fill(9.2);

describe('cell clumping', () => {
  it('flags the cells that were saved clumped, and not a flat year or a varied cell', () => {
    expect(cellClump(DOLOMITES).clumped).toBe(true);
    expect(cellClump(VENICE).clumped).toBe(true);
    expect(cellClump(FLAT).clumped).toBe(false);
    expect(cellClump(FINE).clumped).toBe(false);
  });
  it('counts a flat stretch once and leaves out zeros and 10s', () => {
    const c = cellClump(DOLOMITES);
    expect(c.runs).toBe(7); expect(c.round).toBe(6); // flat 5.5 winter once, 6.5, 9.5, 9.5, 8.5, 4.5 (the 10s and 4.4: 4.4 is not round)
  });
  it('exempts a cell with fewer than three runs', () => {
    expect(cellClump([7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 8, 8, 8, 8, 8, 8]).clumped).toBe(false);
  });
});

describe('batch on its own', () => {
  it('fails a skewed batch even though it would vanish inside a large catalog, and passes after fixBatch', () => {
    const series = { dol: DOLOMITES, ven: VENICE, a: [7.5, 7.5, 8, 8.5, 9, 9.5, 9, 8.5, 8, 7.5, 7, 7.5], b: [3.5, 4, 4.5, 5, 5.5, 6, 6.5, 6, 5.5, 5, 4.5, 4], c: [2, 2.5, 3, 3.5, 4, 4.5, 5, 4.5, 4, 3.5, 3, 2.5] };
    const before = checkBatch(series);
    expect(batchIsAcceptable(before)).toBe(false);
    expect(before.clumpedCells.length).toBeGreaterThanOrEqual(3);
    expect(() => assertBatchAcceptable('test', series)).toThrow(/last-digit check/);
    const fixed = fixBatch(series);
    expect(batchIsAcceptable(checkBatch(fixed))).toBe(true);
    for (const [id, s] of Object.entries(fixed)) s.forEach((v, i) => { expect(Math.abs(v - (series as Record<string, number[]>)[id][i])).toBeLessThanOrEqual(0.3 + 1e-9); });
  });
  it('keeps the 10s, keeps months in order, and keeps a flat season flat', () => {
    const fixed = declumpCells({ dol: DOLOMITES });
    expect(fixed.dol[6]).toBe(10); expect(fixed.dol[7]).toBe(10);
    expect(fixed.dol[0]).toBe(fixed.dol[1]); expect(fixed.dol[1]).toBe(fixed.dol[2]); // the flat winter did not break apart
    expect(cellClump(fixed.dol).clumped).toBe(false);
    expect(fixed.dol[9]).toBeLessThan(fixed.dol[5]); // order between neighbouring stretches kept: Oct below Sep's stretch
  });
  it('obeys a veto, so blurb groups can be protected', () => {
    const veto = (_id: string, c: number[]) => Math.max(...c.slice(5, 9)) - Math.min(...c.slice(5, 9)) <= 0.5 + 1e-9; // June to September within 0.5
    const fixed = declumpCells({ dol: DOLOMITES }, { accept: veto });
    expect(Math.max(...fixed.dol.slice(5, 9)) - Math.min(...fixed.dol.slice(5, 9))).toBeLessThanOrEqual(0.5 + 1e-9);
  });
});
