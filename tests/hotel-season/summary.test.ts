import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { summariseRun, swingOf } from '@/lib/hotel-season/summary';
import { loadCollectionRuns, collectionFileNames } from '@/lib/hotel-season/load-files';
import type { QuoteRun } from '@/lib/hotel-season/types';

const runs = loadCollectionRuns();
const byKey = (k: string) => runs.find((r) => r.key === k)!;
const sumOf = (k: string) => summariseRun(byKey(k).run);
const root = join(__dirname, '..', '..');

describe('hotel season summary: every collected place recomputes from its raw quotes', () => {
  it('covers 195 distinct places and every collection file is mapped', () => {
    expect(runs.length).toBe(195);
    expect(new Set(runs.map((r) => r.run.placeId)).size).toBe(195);
    const mapped = new Set(Object.values(JSON.parse(readFileSync(join(root, 'scripts/data/hotel-place-map-nov15.json'), 'utf8')) as Record<string, { file: string }>).map((x) => x.file));
    expect([...mapped].sort()).toEqual(collectionFileNames());
  });
  it('the index computed from the raw prices equals the index recorded when the quotes were collected, for all 195 places', () => {
    for (const { key, run, recordedIdx } of runs) {
      const s = summariseRun(run);
      const computed: Array<number | null> = new Array(14).fill(null);
      run.dates.forEach((d, i) => { if (i === 1) computed[i] = s.holiday.dec29; else if (i === 2) computed[i] = s.holiday.dec31; else computed[i] = s.months[Number(d.slice(5, 7)) - 1]; });
      expect(computed, key).toEqual(recordedIdx);
    }
  });
  it('every summary is complete: 12 months, a count for each, the quote date and a known flag', () => {
    for (const { key, run } of runs) {
      const s = summariseRun(run);
      expect(s.months.length, key).toBe(12); expect(s.monthsN.length, key).toBe(12);
      expect(s.asOf, key).toMatch(/^2026-11-1[45]$/); expect(s.area.length, key).toBeGreaterThan(2);
      for (const f of s.flags) expect(['thin', 'thin-holidays', 'closed-months', 'flat', 'small-market'], key).toContain(f);
      s.months.forEach((m, i) => { if (m != null) expect(s.monthsN[i], `${key} month ${i + 1}`).toBeGreaterThanOrEqual(3); });
    }
  });
});

describe('hotel season summary: the cases the owner reviewed', () => {
  it('Kyoto is a solid sample: April is the high month, 31 December about 2.6 times a normal night', () => {
    const s = sumOf('kyoto');
    expect(s.flags).toEqual([]); expect(s.months[3]).toBe(144); expect(s.holiday.dec31).toBe(258); expect(s.levelUsd).toBe(940);
    expect(swingOf(s)).toBeCloseTo(1.6, 1);
  });
  it('Santorini is thin and closed December to March, with those months blank rather than cheap', () => {
    const s = sumOf('santorini');
    expect(s.flags).toEqual(expect.arrayContaining(['thin', 'closed-months']));
    expect(s.closedMonths).toEqual([1, 2, 3, 12]);
    expect(s.months[11]).toBeNull(); expect(s.months[0]).toBeNull();
  });
  it('Bangkok holds one rate all year (flat) but its New Year night still spikes', () => {
    const s = sumOf('bangkok');
    expect(s.flags).toContain('flat'); expect(s.holiday.dec31).toBe(306);
  });
  it('Provence was re-run as Luberon after the first search matched a Tokyo hotel, and the stored area says so', () => {
    const s = sumOf('provence'); expect(s.area).toBe('Luberon');
    expect(byKey('provence').run.panel.some((h) => /tokyo/i.test(h.name))).toBe(false);
  });
  it('Turks and Caicos has no listing count, so no closure or small-market flag can be claimed', () => {
    const s = sumOf('turks'); expect(s.listedHotels).toEqual([0, 0]);
    expect(s.flags).not.toContain('closed-months'); expect(s.flags).not.toContain('small-market');
  });
  it('a place with too few hotels priced on a date has no index for it, never a made-up one', () => {
    const s = sumOf('queenstown'); expect(s.holiday.dec31 === null || s.holiday.n31 >= 3).toBe(true);
    expect(sumOf('vienna').holiday.dec31).toBeNull();
  });
});

describe('hotel season summary: rules on small made-up runs', () => {
  const dates = ['2026-12-15', '2026-12-29', '2026-12-31', '2027-01-19', '2027-02-16', '2027-03-16', '2027-04-20', '2027-05-18', '2027-06-15', '2027-07-20', '2027-08-17', '2027-09-21', '2027-10-19', '2027-11-09'];
  const base = (panel: QuoteRun['panel'], listed = new Array(14).fill(100)): QuoteRun => ({ placeId: 'x', kind: 'luxury', source: 'booking.com', searchTerm: 'X', quotedOn: '2026-11-14', dates, listed, panel });
  const hotel = (name: string, f: (i: number) => number | null) => ({ name, prices: dates.map((_, i) => f(i)) });
  it('100 is each hotel\'s own typical month, and a hotel that doubles in July puts July at 200', () => {
    const run = base([1, 2, 3].map((k) => hotel('h' + k, (i) => (i === 9 ? 400 : 200))));
    const s = summariseRun(run); expect(s.months[6]).toBe(200); expect(s.months[0]).toBe(100); expect(s.flags).not.toContain('flat');
  });
  it('fewer than 3 hotels priced gives no index for that month', () => {
    const run = base([1, 2].map((k) => hotel('h' + k, () => 100)));
    expect(summariseRun(run).months.every((m) => m === null)).toBe(true);
  });
  it('the holiday dates never move a hotel\'s own typical price', () => {
    const run = base([1, 2, 3].map((k) => hotel('h' + k, (i) => (i === 1 || i === 2 ? 1000 : 100))));
    const s = summariseRun(run); expect(s.months.every((m) => m === 100)).toBe(true); expect(s.holiday.dec31).toBe(1000); expect(s.flags).toContain('flat');
  });
  it('rejects a run that is not 14 dates long', () => {
    expect(() => summariseRun({ ...base([]), dates: dates.slice(0, 13) })).toThrow();
  });
});
