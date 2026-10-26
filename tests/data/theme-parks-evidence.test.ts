import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// The checks docs/column-scoring-plan.md asks for: no gaps, anchors hold, and the ratings follow the stated formulas.
type Evidence = Record<string, Record<string, unknown> & { evidence: Record<string, string> }>;
const root = join(__dirname, '..', '..');
const evidence = JSON.parse(readFileSync(join(root, 'docs/evidence/theme-parks-evidence.json'), 'utf8')) as Evidence;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/theme-parks-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const COLUMNS = ['thrillRides', 'waterParks', 'zoosAquariums', 'daysOfParks', 'parkHotels'];

describe('Theme Parks evidence', () => {
  it('has an evidence line for every place and column (no gaps)', () => {
    expect(Object.keys(evidence)).toHaveLength(20);
    for (const [place, row] of Object.entries(evidence)) {
      for (const col of COLUMNS) {
        // A rating can be null (blank) when no figure was found; the evidence line then says why.
        if (!((col === 'zoosAquariums' || col === 'parkHotels') && (row[col] === null || row[col] === undefined))) expect(row[col], `${place} ${col}`).not.toBeUndefined();
        expect(row.evidence[col]?.length ?? 0, `${place} ${col} evidence`).toBeGreaterThan(20);
      }
    }
  });
  it('matches what was saved to the facts file', () => {
    for (const [place, row] of Object.entries(evidence)) for (const col of COLUMNS) expect(draft[place][col] ?? null, `${place} ${col}`).toBe(row[col] ?? null);
  });
  it('keeps the anchors named in the column hints', () => {
    const anchors: Record<string, Record<string, number>> = {
      thrillRides: { 'tokyo-kyoto': 10, london: 7, paris: 7, beijing: 7, 'bavaria-munich': 4, amsterdam: 1, nyc: 1 },
      waterParks: { dubai: 10, 'bavaria-munich': 9, 'black-forest': 7, seoul: 7 },
      zoosAquariums: { singapore: 10, nyc: 10, hongkong: 7, taiwan: 7, paris: 5, 'black-forest': 2 },
    };
    for (const [col, places] of Object.entries(anchors)) for (const [place, want] of Object.entries(places)) expect(evidence[place][col], `${col} ${place}`).toBe(want);
  });
  it('thrill ratings follow the stated points tiers and never fall out of order', () => {
    const tiers: Array<[number, number]> = [[0, 1], [2, 2], [4, 3], [6, 4], [8, 5], [10, 6], [13, 7], [17, 8], [24, 9]];
    const rated: Array<{ place: string; pts: number; rating: number }> = [];
    for (const [place, row] of Object.entries(evidence)) {
      const m = /points ([\d.]+) =/.exec(row.evidence.thrillRides);
      const pts = m ? Number(m[1]) : 0;
      const want = tiers.find(([lim]) => pts <= lim)?.[1] ?? 10;
      expect(row.thrillRides, `${place} (${pts} points)`).toBe(want);
      rated.push({ place, pts, rating: row.thrillRides as number });
    }
    rated.sort((a, b) => a.pts - b.pts);
    for (let i = 1; i < rated.length; i++) expect(rated[i].rating, `${rated[i].place} after ${rated[i - 1].place}`).toBeGreaterThanOrEqual(rated[i - 1].rating);
  });
  it('hotels read onsite, nearby or city (blank where the place has no park)', () => {
    for (const row of Object.values(evidence)) if (row.parkHotels) expect(['onsite', 'nearby', 'city']).toContain(row.parkHotels);
  });
});
