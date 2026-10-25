import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// docs/column-scoring-plan.md checks for All-inclusive Resorts: no gaps, anchors hold, the three chip ratings follow the stated count tiers.
const root = join(__dirname, '..', '..');
const inputs = JSON.parse(readFileSync(join(root, 'docs/evidence/all-inclusive-inputs.json'), 'utf8')) as Record<string, { adults: number; family: number; lux: number; rated: Record<string, number> }>;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/all-inclusive-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const COLUMNS = ['adultsOnly', 'familyResorts', 'luxuryAllInclusive', 'activities', 'diningDepth', 'eveningScene', 'typicalResortSize', 'evidence'];
const tier = (n: number) => (n <= 0 ? 0 : n === 1 ? 2 : n <= 3 ? 3 : n <= 6 ? 4 : n <= 10 ? 6 : n <= 20 ? 8 : 10);

describe('All-inclusive evidence', () => {
  it('fills every column for every place', () => {
    expect(Object.keys(draft)).toHaveLength(25);
    for (const [place, row] of Object.entries(draft)) for (const col of COLUMNS) expect(row[col], `${place} ${col}`).not.toBeUndefined();
  });
  it('gives the chip ratings the stated tiers from the counts', () => {
    for (const [place, v] of Object.entries(inputs)) {
      expect(draft[place].adultsOnly, `${place} adults`).toBe(tier(v.adults));
      expect(draft[place].familyResorts, `${place} family`).toBe(tier(v.family));
      expect(draft[place].luxuryAllInclusive, `${place} luxury`).toBe(tier(v.lux));
    }
  });
  it('keeps the anchors named in the column hints', () => {
    const anchors: Record<string, Record<string, number>> = {
      adultsOnly: { rivieramaya: 10, jamaica: 8, 'punta-cana': 8, bahamas: 4, okinawa: 0 },
      familyResorts: { rivieramaya: 10, 'punta-cana': 10, canaries: 10, egypt: 10, jamaica: 8, mauritius: 8, 'turks-caicos': 3 },
      luxuryAllInclusive: { maldives: 10, rivieramaya: 8, 'punta-cana': 8, mauritius: 8, jamaica: 6, 'turks-caicos': 3 },
    };
    for (const [col, places] of Object.entries(anchors)) for (const [place, want] of Object.entries(places)) expect(draft[place][col], `${col} ${place}`).toBe(want);
  });
  it('keeps the safari lodges out: Northern Tanzania rates zero on all three chips', () => {
    for (const col of ['adultsOnly', 'familyResorts', 'luxuryAllInclusive']) expect(draft.tanzania[col]).toBe(0);
  });
});
