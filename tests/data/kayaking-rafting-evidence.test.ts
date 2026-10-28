import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Ev = Record<string, { calm: number; lakes: number; paddle: number; paddle_sea: number; coast_km: number; sea: number; median_wave_m: number | null; whitewater: number | null; multi: number | null; type: string; rivers: Array<{ river: string; cls: string; outfitters: string }>; multi_operators: string[]; urls: string[]; water_temperature: string | null; glacial: boolean }>;
const root = join(__dirname, '..', '..');
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/kayaking-rafting-evidence.json'), 'utf8')) as Ev;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/kayaking-rafting-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const tier = (n: number) => (n === 0 ? 0 : n === 1 ? 2 : n <= 3 ? 3 : n <= 6 ? 4 : n <= 10 ? 6 : n <= 20 ? 8 : 10);
const presence = (n: number) => (n === 0 ? 0 : n === 1 ? 7 : n <= 3 ? 8 : n <= 6 ? 9 : 10);
const kmTier = (k: number) => (k <= 0 ? 0 : k < 20 ? 2 : k < 50 ? 4 : k < 150 ? 6 : k < 400 ? 8 : 10);
const adj: Record<string, number> = { II: -3, III: -1, IV: 0, V: 1 };

describe('Kayaking & Rafting evidence', () => {
  it('covers all 180 places and every draft has an evidence text', () => {
    expect(Object.keys(ev)).toHaveLength(180);
    for (const p of Object.keys(ev)) {
      expect(typeof draft[p].evidence, p).toBe('string');
      expect(draft[p].evidence as string, p).toContain('Calm-water paddling:');
      expect(draft[p].evidence as string, p).toContain('Sea kayaking:');
      expect(draft[p].evidence as string, p).toContain('Whitewater');
    }
  });
  it('calm-water and sea kayaking follow the stated tiers', () => {
    for (const [p, r] of Object.entries(ev)) {
      expect(draft[p].calmWaterPaddling, p).toBe(tier(r.lakes + r.paddle));
      let want = r.coast_km > 0 ? Math.floor((kmTier(r.coast_km) + tier(r.paddle_sea)) / 2 + 0.5) : 0;
      if (r.median_wave_m !== null && r.median_wave_m > 1.5) want = Math.max(0, want - 2);
      expect(draft[p].seaKayaking, p).toBe(want);
    }
  });
  it('whitewater follows the river count and hardest class; cities, small islands and polar places are 0; unresearched places are blank', () => {
    for (const [p, r] of Object.entries(ev)) {
      if (r.type === 'blank') { expect(draft[p].whitewaterRafting, p).toBeUndefined(); expect(draft[p].multiDayRiverTrips, p).toBeUndefined(); continue; }
      if (r.type === 'zero') { expect(draft[p].whitewaterRafting, p).toBe(0); expect(draft[p].multiDayRiverTrips, p).toBe(0); expect(draft[p].whitewaterClasses, p).toEqual(['none']); continue; }
      const known = r.rivers.map((x) => x.cls).filter((c) => c in adj);
      const hardest = ['II', 'III', 'IV', 'V'].filter((c) => known.includes(c)).pop();
      const want = r.rivers.length === 0 ? 0 : Math.max(0, Math.min(10, presence(r.rivers.length) + (hardest ? adj[hardest] : 0)));
      expect(draft[p].whitewaterRafting, p).toBe(want);
      const m = r.multi_operators.length;
      expect(draft[p].multiDayRiverTrips, p).toBe(m === 0 ? 0 : m === 1 ? 4 : m <= 3 ? 7 : 10);
    }
  });
  it('every researched place names outfitters and pages', () => {
    for (const [p, r] of Object.entries(ev)) {
      if (r.type !== 'researched') continue;
      expect(r.urls.length, p).toBeGreaterThan(0);
      for (const u of r.urls) expect(u, p).toMatch(/^https:\/\//);
      for (const x of r.rivers) expect(x.outfitters.length + x.river.length, `${p} ${x.river}`).toBeGreaterThan(5);
    }
  });
  it('water temperature and skill levels use only legal values', () => {
    for (const p of Object.keys(ev)) {
      if (draft[p].waterTemperature !== undefined) expect(['warm', 'cool', 'glacial'], p).toContain(draft[p].waterTemperature);
      for (const l of (draft[p].skillLevels as string[] | undefined) ?? []) expect(['never', 'little', 'experienced'], p).toContain(l);
      for (const c of (draft[p].whitewaterClasses as string[] | undefined) ?? []) expect(['none', 'ii', 'iii', 'iv', 'v'], p).toContain(c);
      if (ev[p].glacial && ev[p].rivers.length) expect(draft[p].waterTemperature, p).toBe('glacial');
    }
  });
  it('keeps the checked anchors', () => {
    expect(draft['nepal'].whitewaterRafting).toBe(10);
    expect(draft['zimbabwe'].whitewaterRafting).toBe(8);
    expect(draft['grandcanyon'].whitewaterRafting).toBe(7);
    expect(draft['paris'].whitewaterRafting).toBe(0);
    expect(draft['tasmania'].multiDayRiverTrips).toBe(10);
    expect(draft['berlin'].calmWaterPaddling).toBe(10);
    expect(draft['iceland'].waterTemperature).toBe('glacial');
  });
});
