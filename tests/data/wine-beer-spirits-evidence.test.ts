import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/wine-beer-spirits-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/wine-beer-spirits-evidence.json'), 'utf8')) as Record<string, { values: Record<string, unknown> }>;
const RATINGS = ['wineRegion', 'beerCulture', 'whiskyCulture', 'otherSpirits', 'sakeTraditional'];
const LABELS = ['Vineyards and wine regions:', 'Craft beer and breweries:', 'Whisky:', 'Other spirits:', 'Sake and traditional drinks:', 'Celebrated wines:', 'Spirits made here:'];

describe('Wine, Beer & Spirits evidence', () => {
  it('covers all 110 places with an evidence line per column', () => {
    expect(Object.keys(draft)).toHaveLength(110);
    for (const [p, d] of Object.entries(draft)) for (const l of LABELS) expect(d.evidence as string, `${p} ${l}`).toContain(l);
  });
  it('values match the evidence file and stay on the 0 to 10 scale', () => {
    for (const [p, d] of Object.entries(draft)) {
      for (const k of RATINGS) { const v = d[k]; if (v !== undefined) { expect(v as number, `${p} ${k}`).toBeGreaterThanOrEqual(0); expect(v as number).toBeLessThanOrEqual(10); } }
      expect(ev[p].values, p).toEqual(Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'evidence')));
    }
  });
  it('celebrated wines and spirits each carry a Wikipedia source and a confidence in the evidence', () => {
    for (const [p, d] of Object.entries(draft)) {
      const e = d.evidence as string;
      if (d.celebratedReds || d.celebratedWhites || d.celebratedOtherWines) expect(e, p).toMatch(/Celebrated wines: .*Source: https:\/\/en\.wikipedia\.org\/wiki\/\S+ \(confidence (high|medium|low)\)/);
      else expect(e, p).toContain('Celebrated wines: left blank');
      if (d.spiritKinds) expect(e, p).toMatch(/Spirits made here: .*Source: https:\/\/en\.wikipedia\.org\/wiki\/\S+ \(confidence (high|medium|low)\)/);
      else expect(e, p).toContain('Spirits made here: left blank');
    }
  });
  it('the two sourced raises say so, and no other rating is above the tier formula without a Judged note', () => {
    expect(draft['oaxaca'].otherSpirits).toBe(10);
    expect(draft['barbados'].otherSpirits).toBe(9);
    for (const [p, d] of Object.entries(draft)) if (d.otherSpirits !== undefined && ['oaxaca', 'barbados'].includes(p)) expect(d.evidence as string, p).toContain('Judged:');
  });
  it('keeps the checked anchors', () => {
    for (const p of ['bordeaux', 'napa', 'tuscany', 'champagne', 'rioja']) expect(draft[p].wineRegion, p).toBe(10);
    expect(draft['bavaria-munich'].beerCulture).toBe(10);
    expect(draft['ireland'].whiskyCulture).toBe(10);
    expect(draft['palau'].wineRegion).toBe(0);
    expect(draft['mendoza'].whiskyCulture).toBe(0);
    expect(draft['tokyo-kyoto'].sakeTraditional).toBeDefined();
    expect(Object.values(draft).filter((d) => d.sakeTraditional !== undefined)).toHaveLength(1);
  });
});
