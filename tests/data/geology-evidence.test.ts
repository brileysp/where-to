import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PLACE } from '@/lib/places/keys.generated';

const root = join(__dirname, '..', '..');
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/geology-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/geology-evidence.json'), 'utf8')) as Record<string, { values: Record<string, unknown> }>;
const PARTS = ['volcanicLandscapes', 'geothermalFeatures', 'glaciersIce', 'fossilsDinosaurs', 'cavesKarst', 'rockFormations', 'tectonicLandscapes', 'mineralsMines'];
const LABELS = ['Volcanoes and volcanic landscapes:', 'Geothermal features:', 'Glaciers and ice:', 'Fossils and dinosaurs:', 'Caves and karst:', 'Rock formations and canyons:', 'Tectonic landscapes:', 'Rocks, minerals and mines:', 'UNESCO geological site or geopark:'];

describe('Geology evidence', () => {
  it('covers all 80 places with an evidence line per part', () => {
    expect(Object.keys(draft)).toHaveLength(80);
    for (const [p, d] of Object.entries(draft)) for (const l of LABELS) expect(d.evidence as string, `${p} ${l}`).toContain(l);
  });
  it('values match the evidence file and stay on the 0 to 10 scale', () => {
    for (const [p, d] of Object.entries(draft)) {
      for (const part of PARTS) { const v = d[part]; if (v !== undefined) { expect(typeof v, `${p} ${part}`).toBe('number'); expect(v as number).toBeGreaterThanOrEqual(0); expect(v as number).toBeLessThanOrEqual(10); } }
      expect(ev[p].values, p).toEqual(Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'evidence')));
    }
  });
  it('a blank part says why and a zero is only given for volcanoes, geothermal and glaciers', () => {
    for (const [p, d] of Object.entries(draft)) {
      for (const part of PARTS) {
        const label = LABELS[PARTS.indexOf(part)];
        const line = (d.evidence as string).split('\n').find((l) => l.startsWith(label))!;
        if (d[part] === undefined) expect(line, `${p} ${part}`).toContain('Left blank');
        if (d[part] === 0) expect(['volcanicLandscapes', 'geothermalFeatures', 'glaciersIce'], `${p} ${part}`).toContain(part);
      }
    }
  });
  it('keeps the checked anchors', () => {
    expect(draft[PLACE.iceland].volcanicLandscapes).toBe(10);
    expect(draft[PLACE.iceland].glaciersIce).toBe(10);
    expect(draft[PLACE['big-island']].volcanicLandscapes).toBe(10);
    expect(draft[PLACE.sicily].volcanicLandscapes).toBe(10);
    expect(draft[PLACE['yellowstone-national-park']].geothermalFeatures).toBe(10);
    expect(draft[PLACE['north-island']].geothermalFeatures).toBe(10);
    expect(draft[PLACE.vietnam].cavesKarst).toBe(10);
    expect(draft[PLACE['grand-canyon']].rockFormations).toBe(10);
    expect(draft[PLACE.mendoza].volcanicLandscapes).toBe(0);
    expect(draft[PLACE['big-island']].glaciersIce).toBe(0);
    expect(draft[PLACE['north-cascades']].glaciersIce).toBe(6);
  });
  it('UNESCO tick appears only where a site or geopark is named in the evidence', () => {
    for (const [p, d] of Object.entries(draft)) {
      const line = (d.evidence as string).split('\n').find((l) => l.startsWith('UNESCO geological site or geopark:'))!;
      expect(!!d.unescoGeology, p).toBe(line.includes('ticked'));
    }
  });
});
