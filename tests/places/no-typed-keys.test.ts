import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';
import { buildKeysFile } from '@/lib/places/keys-file';

const root = join(__dirname, '..', '..');
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === 'node_modules' ? [] : statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []; });

// 18 Nov 2026, step 4 of the naming plan: "No place keys typed into code. Code and tests that need a specific place look it up by name (PLACE.myanmar)."
describe('place keys in code', () => {
  it('no source or test file types a place key (use PLACE.name from src/lib/places/keys.generated.ts)', () => {
    // create-place, identity-edit and identity-pages tests are allowed: it starts from an empty scratch database and checks the keys it hands out (p0001, p0002 ...), which are not the real places.
    const allowed = new Set(['src/lib/places/keys.generated.ts', 'src/lib/authoring/standards.ts', 'src/lib/db/schema.ts', 'tests/admin/create-place.test.ts', 'tests/admin/identity-edit.test.ts', 'tests/admin/identity-pages.test.ts', 'tests/admin/scope-version.test.ts']);
    const offenders = [...walk(join(root, 'src')), ...walk(join(root, 'tests'))].map((f) => relative(root, f)).filter((f) => !allowed.has(f) && !f.startsWith('tests/places/')).filter((f) => /['"]p\d{4}['"]/.test(readFileSync(join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('the generated names file', () => {
  it('lists the current slug, a retired slug and an old id for each place, sorted, with plain-string values', () => {
    const text = buildKeysFile({
      identity: [{ key: 'p0113', label: 'Myanmar', slug: 'myanmar' }, { key: 'p0058', label: 'Dominican Republic', slug: 'dominican-republic' }],
      slugRedirects: [{ slug: 'bagan', placeKey: 'p0113', kind: 'old_id' }, { slug: 'myanmar-old', placeKey: 'p0113', kind: 'old_slug' }],
      idRedirects: [{ oldId: 'bagan', placeKey: 'p0113' }, { oldId: 'punta-cana', placeKey: 'p0058' }],
    });
    expect(text).toContain("bagan: 'p0113', // Myanmar (old id)");
    expect(text).toContain("'dominican-republic': 'p0058', // Dominican Republic");
    expect(text).toContain("'myanmar-old': 'p0113', // Myanmar (old slug)");
    expect(text).toContain("'punta-cana': 'p0058', // Dominican Republic (old id)");
    expect(text.indexOf('bagan:')).toBeLessThan(text.indexOf("'dominican-republic'"));
    expect(text).toContain('export const PLACE: { readonly [K in PlaceName]: string }');
  });
});
