import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Row = Record<string, unknown> & { evidence: Record<string, string> };
const root = join(__dirname, '..', '..');
const evidence = JSON.parse(readFileSync(join(root, 'docs/evidence/mountain-biking-evidence.json'), 'utf8')) as Record<string, Row>;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/mountain-biking-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const COLUMNS = ['trailGrades', 'easyFlowTrails', 'liftServedParks', 'bikepackingRoutes', 'bikeRental', 'eBikeRental', 'dayLengths'];
const countTier = (n: number) => (n === 0 ? 0 : n === 1 ? 2 : n <= 3 ? 3 : n <= 6 ? 4 : n <= 10 ? 6 : n <= 20 ? 8 : 10);
const kmTier = (k: number) => (k <= 0 ? 0 : k < 20 ? 2 : k < 50 ? 4 : k < 150 ? 6 : k <= 400 ? 8 : 10);
const routeTier = (n: number) => (n === 0 ? 0 : n === 1 ? 7 : n <= 3 ? 8 : n <= 6 ? 9 : 10);
const liftTier = (n: number) => (n === 0 ? 0 : n === 1 ? 4 : n <= 3 ? 6 : n <= 6 ? 8 : n <= 10 ? 9 : 10);
const ebikeTier = (n: number) => (n === 0 ? 0 : n === 1 ? 2 : n <= 3 ? 4 : n <= 6 ? 6 : n <= 10 ? 8 : 10);
const num = (text: string, re: RegExp) => Number(re.exec(text)?.[1]);

describe('Mountain Biking evidence', () => {
  it('has an evidence line for every place and column (no gaps)', () => {
    expect(Object.keys(evidence)).toHaveLength(128);
    for (const [place, row] of Object.entries(evidence)) for (const col of COLUMNS) expect(row.evidence[col]?.length ?? 0, `${place} ${col}`).toBeGreaterThan(20);
  });
  it('matches what was saved to the facts file', () => {
    for (const [place, row] of Object.entries(evidence)) for (const col of COLUMNS) expect(draft[place][col] ?? null, `${place} ${col}`).toEqual(row[col] ?? null);
  });
  it('keeps the anchors named in the column hints', () => {
    const anchors: Record<string, Record<string, number>> = {
      easyFlowTrails: { swissalps: 10, tuscany: 10, whistler: 8, queenstown: 2 },
      liftServedParks: { swissalps: 10, dolomites: 10, chamonix: 10, whistler: 10, 'north-island': 10, 'quebec-city': 10, 'arches-canyonlands': 0 },
      bikepackingRoutes: { banff: 10, 'arches-canyonlands': 10 },
    };
    for (const [col, places] of Object.entries(anchors)) for (const [place, want] of Object.entries(places)) expect(evidence[place][col], `${col} ${place}`).toBe(want);
  });
  it('ratings follow the stated tiers', () => {
    for (const [place, row] of Object.entries(evidence)) {
      const e = row.evidence;
      if (row.easyFlowTrails !== undefined) expect(row.easyFlowTrails, `${place} flow`).toBe(kmTier(num(e.easyFlowTrails, /^(\d+) km of easy/)));
      if (row.bikepackingRoutes !== undefined) expect(row.bikepackingRoutes, `${place} routes`).toBe(e.bikepackingRoutes.includes('iconic bikepacking') ? 10 : routeTier(num(e.bikepackingRoutes, /^(\d+) mountain-bike route/)));
      if (row.liftServedParks !== undefined) expect(row.liftServedParks, `${place} lifts`).toBe(e.liftServedParks.includes('Crankworx') ? 10 : e.liftServedParks.startsWith('No gondolas') ? 0 : liftTier(num(e.liftServedParks, /^(\d+) lift\(s\)/)));
      if (row.bikeRental !== undefined) expect(row.bikeRental, `${place} rental`).toBe(countTier(num(e.bikeRental, /^(\d+) bike rental/)));
      if (row.eBikeRental !== undefined) expect(row.eBikeRental, `${place} e-bike`).toBe(ebikeTier(num(e.eBikeRental, /^(\d+) rental business/)));
    }
  });
  it('trail columns stay blank where under 20 km of trail is mapped, and say so', () => {
    for (const [place, row] of Object.entries(evidence)) {
      if (row.trailGrades === undefined) {
        expect(row.easyFlowTrails, place).toBeUndefined();
        expect(row.dayLengths, place).toBeUndefined();
        expect(row.evidence.trailGrades, place).toContain('Left blank');
      }
    }
  });
  it('day lengths only list the four options and never skip a shorter one', () => {
    const order = ['couple', 'half', 'full'];
    for (const [place, row] of Object.entries(evidence)) {
      const d = row.dayLengths as string[] | undefined;
      if (!d) continue;
      for (const k of d) expect(['couple', 'half', 'full', 'multi']).toContain(k);
      order.forEach((k, i) => { if (d.includes(k)) for (const shorter of order.slice(0, i)) expect(d, `${place}: ${k} without ${shorter}`).toContain(shorter); });
    }
  });
  it('lift-served is blank, not 0, where lifts are mapped but none is known to carry bikes', () => {
    for (const [place, row] of Object.entries(evidence)) if (row.liftServedParks === undefined && row.trailGrades !== undefined) expect(row.evidence.liftServedParks, place).toMatch(/Left blank/);
  });
});
