import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Ev = Record<string, { rated: Record<string, number | null>; nSpecies: Record<string, number>; charters: number; fishingBusinesses: number; overallFishing: number; judged: Record<string, number>; values: Record<string, unknown> }>;
const root = join(__dirname, '..', '..');
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/fishing-evidence.json'), 'utf8')) as Ev;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/fishing-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const KEY: Record<string, string> = { big: 'bigGameFish', flats: 'flatsFish', trout: 'troutChar', salmon: 'salmonSteelhead', pred: 'freshwaterPredators' };
const tier = (n: number) => (n === 0 ? 0 : n === 1 ? 3 : n === 2 ? 5 : n === 3 ? 7 : 9);

describe('Fishing evidence', () => {
  it('covers all 198 places with an evidence line per column', () => {
    expect(Object.keys(ev)).toHaveLength(198);
    for (const p of Object.keys(ev)) for (const l of ['Big ocean game fish:', 'Flats fish:', 'Trout and char:', 'Salmon and steelhead:', 'Freshwater predators:']) expect(draft[p].evidence as string, p).toContain(l);
  });
  it('values match the saved file', () => {
    for (const [p, r] of Object.entries(ev)) for (const [k, v] of Object.entries(r.values)) expect(draft[p][k], `${p} ${k}`).toEqual(v);
  });
  it('no rating is above the species tier plus the business bonus, or above the overall Fishing score plus 3, unless judged', () => {
    for (const [p, r] of Object.entries(ev)) {
      for (const [g, k] of Object.entries(KEY)) {
        const v = draft[p][k] as number | undefined;
        if (v === undefined || r.judged[g] !== undefined) continue;
        const n = r.nSpecies[g];
        const biz = g === 'big' || g === 'flats' ? r.charters : r.fishingBusinesses;
        const ceiling = Math.min(9, tier(n) + (n >= 1 && biz >= 5 ? 1 : 0));
        expect(v, `${p} ${k}`).toBeLessThanOrEqual(ceiling);
        expect(v, `${p} ${k}`).toBeLessThanOrEqual(r.overallFishing + 3);
      }
    }
  });
  it('judged cells carry their reason in the evidence and are the only 10s', () => {
    for (const [p, r] of Object.entries(ev)) {
      for (const [g, k] of Object.entries(KEY)) {
        const v = draft[p][k] as number | undefined;
        if (v === 10) expect(r.judged[g], `${p} ${k}`).toBe(10);
        if (r.judged[g] !== undefined) expect(draft[p].evidence as string, p).toContain('Judged:');
      }
    }
  });
  it('keeps the checked anchors', () => {
    expect(draft['los-cabos'].bigGameFish).toBe(10);
    expect(draft['gbr'].bigGameFish).toBe(10);
    expect(draft['belize'].flatsFish).toBe(10);
    expect(draft['bahamas'].flatsFish).toBe(10);
    expect(draft['tasmania'].troutChar).toBe(10);
    expect(draft['southeast-alaska'].salmonSteelhead).toBe(10);
    expect(draft['mongolia'].freshwaterPredators).toBe(10);
    expect(draft['hokkaido'].salmonSteelhead).toBe(4);
    expect(draft['galapagos'].flatsFish).toBe(0);
  });
  it('landlocked places get no ocean fishing', () => {
    for (const p of ['bavaria-munich', 'prague', 'vienna', 'nepal', 'swissalps']) if (draft[p]) expect(draft[p].bigGameFish, p).toBe(0);
  });
  it('hand-researched rules name a source and a quote, and salmon months only sit where salmon are rated', () => {
    for (const [p, d] of Object.entries(draft)) {
      if (d.catchRelease) expect(d.evidence as string, p).toMatch(/Catch-and-release rule: [a-z_]+\.[\s\S]+Source: https?:\/\//);
      if (d.guideRule) expect(d.catchRelease, p).toBeDefined();
      if (d.salmonRunMonths) expect(d.salmonSteelhead as number, p).toBeGreaterThan(0);
    }
    expect(Object.values(draft).filter((d) => d.catchRelease).length).toBe(26);
    expect(Object.values(draft).filter((d) => d.salmonRunMonths).length).toBe(6);
  });
  it('methods and access appear exactly where some group is rated 3 or more', () => {
    for (const [p, d] of Object.entries(draft)) {
      const any = Object.values(KEY).some((k) => ((d[k] as number | undefined) ?? 0) >= 3);
      expect(!!d.fishingMethods, p).toBe(any);
      expect(!!d.fishingAccess, p).toBe(any);
    }
  });
});
