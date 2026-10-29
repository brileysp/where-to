import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Ev = Record<string, { routes: number; r20: number; r40: number; r80: number; max_km: number; coastal: number; huts: number; relief_m: number | null; thin: boolean; races: Array<{ race: string; series: string; host: string }>; values: Record<string, unknown> }>;
const root = join(__dirname, '..', '..');
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/trail-running-evidence.json'), 'utf8')) as Ev;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/trail-running-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const cnt = (n: number) => (n === 0 ? 0 : n === 1 ? 2 : n <= 3 ? 3 : n <= 6 ? 4 : n <= 10 ? 6 : n <= 20 ? 8 : 10);
const mt = (r: number) => (r < 300 ? 1 : r < 600 ? 3 : r < 1000 ? 5 : r < 1500 ? 7 : r < 2500 ? 9 : 10);

describe('Trail Running evidence', () => {
  it('covers all 63 places with an evidence line per column', () => {
    expect(Object.keys(ev)).toHaveLength(63);
    for (const p of Object.keys(ev)) for (const l of ['Distances available:', 'Climbing available:', 'Mountain trail running:', 'Coastal and island trails:', 'Races and ultras:', 'Hut-to-hut running:']) expect(draft[p].evidence as string, p).toContain(l);
  });
  it('values match the saved file', () => {
    for (const [p, r] of Object.entries(ev)) for (const [k, v] of Object.entries(r.values)) expect(draft[p][k], `${p} ${k}`).toEqual(v);
  });
  it('distances and climbing follow the stated rules', () => {
    for (const [p, r] of Object.entries(ev)) {
      const d = (draft[p].trailDistances as string[] | undefined) ?? [];
      expect(d.includes('m3'), p).toBe(r.routes >= 1);
      expect(d.includes('m6'), p).toBe(r.r20 >= 2);
      expect(d.includes('m12'), p).toBe(r.r40 >= 1);
      expect(d.includes('m30'), p).toBe(r.r80 >= 1);
      if (r.relief_m !== null) {
        const c = draft[p].trailClimbing as string[];
        expect(c.includes('up3000'), p).toBe(r.relief_m >= 600);
        expect(c.includes('big6500'), p).toBe(r.relief_m >= 1500);
      }
    }
  });
  it('ratings follow the tiers and stay blank where fewer than 3 routes are mapped', () => {
    for (const [p, r] of Object.entries(ev)) {
      if (r.routes < 3) { expect(draft[p].mountainTrailRunning, p).toBeUndefined(); expect(draft[p].coastalIslandTrails, p).toBeUndefined(); continue; }
      expect(draft[p].coastalIslandTrails, p).toBe(cnt(r.coastal));
      if (r.relief_m !== null) expect(draft[p].mountainTrailRunning, p).toBe(mt(r.relief_m));
    }
  });
  it('race and hut ticks follow their rules and every race names a series', () => {
    for (const [p, r] of Object.entries(ev)) {
      expect(!!draft[p].raceHost, p).toBe(r.races.length > 0);
      for (const x of r.races) expect(x.series.length, p).toBeGreaterThan(5);
      expect(!!draft[p].hutToHutRuns, p).toBe(r.huts >= 8 && r.max_km >= 50);
    }
  });
  it('keeps the checked anchors', () => {
    expect(draft['nepal'].mountainTrailRunning).toBe(10);
    expect(draft['swissalps'].mountainTrailRunning).toBe(10);
    expect(draft['cornwall'].coastalIslandTrails).toBe(10);
    expect(draft['canaries'].coastalIslandTrails).toBe(10);
    expect(draft['chamonix'].raceHost).toBe(true);
    expect(draft['dolomites'].trailDistances).toContain('m30');
  });
});
