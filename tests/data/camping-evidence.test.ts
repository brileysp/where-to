import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Row = Record<string, unknown> & { evidence: Record<string, string> };
const root = join(__dirname, '..', '..');
const evidence = JSON.parse(readFileSync(join(root, 'docs/evidence/camping-evidence.json'), 'utf8')) as Record<string, Row>;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/camping-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const research = JSON.parse(readFileSync(join(root, 'docs/evidence/camping-law-and-wildlife-research.json'), 'utf8')) as { wildCampingLaw: Record<string, { value: string; src: string }>; dangerousWildlife: Record<string, { value: string; src: string }> };
const COLUMNS = ['campgrounds', 'backcountry', 'glamping', 'wildCampingLaw', 'howRemote', 'nightTemps', 'dangerousWildlife'];
const countTier = (n: number) => (n === 0 ? 0 : n === 1 ? 2 : n <= 3 ? 3 : n <= 6 ? 4 : n <= 10 ? 6 : n <= 20 ? 8 : 10);
const campTier = (n: number) => (n < 20 ? 4 : n < 40 ? 5 : n < 80 ? 6 : n < 150 ? 7 : n < 300 ? 8 : n < 600 ? 9 : 10);
const remTier = (k: number) => (k < 3 ? 1 : k < 8 ? 3 : k < 15 ? 5 : k < 30 ? 7 : k <= 60 ? 9 : 10);
const num = (text: string, re: RegExp) => Number(re.exec(text)?.[1]);

describe('Camping evidence', () => {
  it('has an evidence line for every place and column (no gaps)', () => {
    expect(Object.keys(evidence)).toHaveLength(94);
    for (const [place, row] of Object.entries(evidence)) for (const col of COLUMNS) expect(row.evidence[col]?.length ?? 0, `${place} ${col}`).toBeGreaterThan(20);
  });
  it('matches what was saved to the facts file', () => {
    for (const [place, row] of Object.entries(evidence)) for (const col of COLUMNS) expect(draft[place][col] ?? null, `${place} ${col}`).toEqual(row[col] ?? null);
  });
  it('keeps the anchors named in the column hints', () => {
    const anchors: Record<string, Record<string, number>> = { campgrounds: { taiwan: 10, cornwall: 10, 'vancouver-island': 10, yellowstone: 8, atacama: 4 } };
    for (const [col, places] of Object.entries(anchors)) for (const [place, want] of Object.entries(places)) expect(evidence[place][col], `${col} ${place}`).toBe(want);
  });
  it('ratings follow the stated tiers', () => {
    for (const [place, row] of Object.entries(evidence)) {
      const e = row.evidence;
      if (row.campgrounds !== undefined) expect(row.campgrounds, `${place} campgrounds`).toBe(campTier(num(e.campgrounds, /^(\d+) distinct/)));
      if (row.backcountry !== undefined) expect(row.backcountry, `${place} backcountry`).toBe(countTier(num(e.backcountry, /^(\d+) backcountry/)));
      if (row.glamping !== undefined) expect(row.glamping, `${place} glamping`).toBe(countTier(num(e.glamping, /^(\d+) glamping/)));
      if (row.howRemote !== undefined) expect(row.howRemote, `${place} remote`).toBe(remTier(num(e.howRemote, /are ([\d.]+) km or more/)));
    }
  });
  it('site columns stay blank under 10 mapped sites, and say so', () => {
    for (const [place, row] of Object.entries(evidence)) if (row.campgrounds === undefined) {
      expect(row.howRemote, place).toBeUndefined();
      expect(row.evidence.campgrounds, place).toContain('Left blank');
    }
  });
  it('night temperatures follow the stated bands', () => {
    for (const [place, row] of Object.entries(evidence)) {
      const t = num(row.evidence.nightTemps, /is (-?[\d.]+) C/);
      // The line shows one decimal, so a value within 0.05 of a band edge may sit on either side.
      const bands = ['freezing', 'cold', 'cool', 'warm'];
      const at = (x: number) => (x >= 15 ? 3 : x >= 5 ? 2 : x >= 0 ? 1 : 0);
      expect([at(t - 0.05), at(t + 0.05)], place).toContain(bands.indexOf(row.nightTemps as string));
    }
  });
  it('every wild camping law and wildlife value has a source and matches the research file', () => {
    for (const [place, row] of Object.entries(evidence)) {
      if (row.wildCampingLaw !== undefined) {
        expect(['allowed', 'limited', 'not_allowed']).toContain(row.wildCampingLaw);
        expect(research.wildCampingLaw[place]?.value, place).toBe(row.wildCampingLaw);
        expect(row.evidence.wildCampingLaw, place).toContain('Source:');
      } else expect(row.evidence.wildCampingLaw, place).toContain('Left blank');
      if (row.dangerousWildlife !== undefined) {
        expect(['none', 'bearRules', 'bigGame']).toContain(row.dangerousWildlife);
        expect(research.dangerousWildlife[place]?.value, place).toBe(row.dangerousWildlife);
        expect(row.evidence.dangerousWildlife, place).toContain('Source:');
      }
    }
  });
  it('keeps the checked law anchors', () => {
    const law: Record<string, string> = { 'scottish-highlands-skye': 'allowed', lapland: 'allowed', acadia: 'not_allowed', uluru: 'not_allowed', yellowstone: 'limited', iceland: 'limited', 'badlands-black-hills': 'allowed', cornwall: 'not_allowed' };
    for (const [place, want] of Object.entries(law)) expect(evidence[place].wildCampingLaw, place).toBe(want);
  });
});

describe('Camping wildlife: none from GBIF records', () => {
  const gbif = JSON.parse(readFileSync(join(root, 'docs/evidence/camping-wildlife-gbif-records.json'), 'utf8')) as Record<string, { total: number; coverage_carnivores: number }>;
  it('every place set to none by records has zero records of the 12 taxa and 100 or more carnivore records', () => {
    for (const [place, row] of Object.entries(evidence)) {
      if (row.dangerousWildlife !== 'none') continue;
      expect(research.dangerousWildlife[place]?.src, place).toBe('https://api.gbif.org/v1/occurrence/search');
      expect(gbif[place].total, place).toBe(0);
      expect(gbif[place].coverage_carnivores, place).toBeGreaterThanOrEqual(100);
      expect(row.evidence.dangerousWildlife, place).toContain('Source: GBIF');
    }
  });
  it('Palawan stays blank because saltwater crocodiles are known there', () => {
    expect(draft['palawan'].dangerousWildlife).toBeUndefined();
    expect(evidence['palawan'].evidence.dangerousWildlife).toContain('saltwater crocodiles');
  });
});
