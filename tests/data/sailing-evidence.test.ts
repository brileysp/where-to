import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Ev = Record<string, { marinas: number; islands: number; sheltered: number; regattas: number; events: string[]; expedition: number | null; operators: Array<{ name: string; says: string; url: string }>; sea: string | null; median_wave_m: number | null; calm_share: number | null; bareboat_base: boolean }>;
const root = join(__dirname, '..', '..');
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/sailing-evidence.json'), 'utf8')) as Ev;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/sailing-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const tier = (n: number) => (n === 0 ? 0 : n === 1 ? 2 : n <= 3 ? 3 : n <= 6 ? 4 : n <= 10 ? 6 : n <= 20 ? 8 : 10);
const presence = (n: number) => (n === 0 ? 0 : n === 1 ? 7 : n <= 3 ? 8 : n <= 6 ? 9 : 10);

describe('Sailing evidence', () => {
  it('covers all 138 places and every draft has an evidence line per rating', () => {
    expect(Object.keys(ev)).toHaveLength(138);
    for (const p of Object.keys(ev)) {
      const e = draft[p].evidence as string;
      expect(e, p).toContain('Sheltered island hopping:');
      expect(e, p).toContain('Racing and regattas:');
      expect(e, p).toContain('Expedition sailing:');
    }
  });
  it('the sheltered rating follows the marina tier, the island limit and the wave rule', () => {
    for (const [p, r] of Object.entries(ev)) {
      const cap = r.islands >= 10 ? 10 : r.islands >= 3 ? 5 : 2;
      let want = Math.min(tier(r.marinas), cap);
      if (r.median_wave_m === null) want = Math.min(want, 2);
      else if (r.calm_share !== null && r.calm_share < 0.6) want = Math.max(0, want - 2);
      expect(draft[p].shelteredIslandHopping, p).toBe(want);
      expect(r.sheltered, p).toBe(want);
    }
  });
  it('regattas follow the presence-led scale and name their events', () => {
    for (const [p, r] of Object.entries(ev)) {
      expect(draft[p].racingRegattas, p).toBe(presence(r.events.length));
    }
  });
  it('expedition operators each name a page, and the rating follows the operator count', () => {
    for (const [p, r] of Object.entries(ev)) {
      if (r.expedition === null) { expect(draft[p].expeditionSailing, p).toBeUndefined(); continue; }
      for (const o of r.operators) { expect(o.url, p).toMatch(/^https:\/\//); expect(o.says.length, `${p} ${o.name}`).toBeGreaterThan(10); }
      if (r.operators.length > 0) expect(draft[p].evidence as string, p).toContain(r.operators[0].name);
      const n = r.operators.length;
      if (n > 0) expect(r.expedition, p).toBe(n === 1 ? 3 : n <= 3 ? 6 : 9);
      expect(draft[p].expeditionSailing, p).toBe(r.expedition);
    }
  });
  it('sea conditions use only legal values and follow the wave thresholds where measured', () => {
    for (const [p, r] of Object.entries(ev)) {
      if (r.median_wave_m !== null) expect(draft[p].seaConditions, p).toBe(r.median_wave_m < 0.5 ? 'flat' : r.median_wave_m <= 1.5 ? 'swell' : 'open');
      if (draft[p].seaConditions !== undefined) expect(['flat', 'swell', 'open'], p).toContain(draft[p].seaConditions);
    }
  });
  it('keeps the checked anchors', () => {
    expect(draft['croatia'].shelteredIslandHopping).toBe(10);
    expect(draft['morocco'].shelteredIslandHopping).toBe(0);
    expect(draft['sydney'].racingRegattas).toBe(8);
    expect(draft['svalbard'].expeditionSailing).toBe(9);
    expect(draft['antarctica'].expeditionSailing).toBe(9);
    expect(draft['croatia'].bareboatBase).toBe(true);
  });
});
