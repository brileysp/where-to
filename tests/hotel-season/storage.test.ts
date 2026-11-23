import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe('hotel season storage', () => {
  it('both tables have row-level security switched on in the migration (new tables must; the check is scripts/check-rls.ts)', () => {
    const sql = readFileSync(join(root, 'drizzle', '0061_hotel_season.sql'), 'utf8');
    expect(sql).toContain('ALTER TABLE "place_hotel_quote_runs" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "place_hotel_season" ENABLE ROW LEVEL SECURITY');
  });
  it('allows only one current run per place and kind', () => {
    expect(readFileSync(join(root, 'drizzle', '0061_hotel_season.sql'), 'utf8')).toContain('CREATE UNIQUE INDEX "place_hotel_quote_runs_current_unique"');
  });
  it('the traveler screens never read the hotel season tables; the Cost tab card reads its own generated file (owner, 19 Nov 2026: build the cost seasonality card into the Cost tab)', () => {
    const offenders = ['src/app', 'src/components'].flatMap((d) => walk(join(root, d))).filter((f) => /\.(ts|tsx)$/.test(f)).filter((f) => /hotel-season|placeHotelSeason|placeHotelQuoteRuns/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('the place-row download does not carry the summary (it lives in its own table)', () => {
    expect(readFileSync(join(root, 'src/lib/db/schema.ts'), 'utf8')).not.toMatch(/hotelSeason:\s*jsonb/);
  });
});
