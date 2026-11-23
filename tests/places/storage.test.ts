import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

// 18 Nov 2026, steps 1 and 2 of docs/place-naming-plan.md: the identity tables exist and are filled, but nothing in the app reads them yet (step 4 moves reads over).
describe('place identity storage', () => {
  it('nothing the traveler sees reads the identity tables yet (the admin Names & scope screens do, since step 5)', () => {
    const offenders = ['src/app', 'src/components'].flatMap((d) => walk(join(root, d))).filter((f) => /\.(ts|tsx)$/.test(f)).filter((f) => !f.includes(`${join(root, 'src')}/app/admin`) && !f.includes(`${join(root, 'src')}/components/admin`)).filter((f) => /placeIdentity|placeLabelHistory|placeSlugRedirects|placeIdRedirects|placeSourceKeys/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('the place-row download does not carry identity fields (they live in their own tables)', () => {
    const schema = readFileSync(join(root, 'src/lib/db/schema.ts'), 'utf8');
    const placesBlock = schema.slice(schema.indexOf("export const places = pgTable("), schema.indexOf("export const places = pgTable(") + 6000);
    expect(placesBlock).not.toMatch(/scopeVersion|placeKey/);
  });
  it('the migration turns row-level security on for all five tables', () => {
    const sql = readFileSync(join(root, 'drizzle/0062_place_identity.sql'), 'utf8');
    for (const t of ['place_identity', 'place_label_history', 'place_slug_redirects', 'place_id_redirects', 'place_source_keys']) expect(sql).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
  });
});
