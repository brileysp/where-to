import { describe, expect, it } from 'vitest';
import { nextKey, resolveAll, resolveFrom, uniqueSlug, type IdentityTables } from '@/lib/places/resolve';
import { PLACE } from '@/lib/places/keys.generated';

const t: IdentityTables = {
  identity: [{ key: 'p0113', label: 'Myanmar', slug: 'myanmar' }, { key: 'p0058', label: 'Dominican Republic', slug: 'dominican-republic' }],
  slugRedirects: [{ slug: 'bagan', placeKey: 'p0113' }, { slug: 'punta-cana', placeKey: 'p0058' }],
  idRedirects: [{ oldId: 'bagan', placeKey: 'p0113' }, { oldId: 'punta-cana', placeKey: 'p0058' }],
};

// 18 Nov 2026, step 4 of the naming plan: a place can be named by its key, its slug, a retired slug or the id it had before the keys, and all of them find the same place.
describe('finding a place from what was typed', () => {
  it('finds Myanmar by key, slug, old slug and old id', () => {
    expect(resolveFrom(t, 'p0113')).toMatchObject({ key: 'p0113', label: 'Myanmar', how: 'key' });
    expect(resolveFrom(t, 'myanmar')).toMatchObject({ key: 'p0113', how: 'slug' });
    expect(resolveFrom(t, 'Myanmar')).toMatchObject({ key: 'p0113', how: 'slug' });
    expect(resolveFrom(t, 'bagan')).toMatchObject({ key: 'p0113', label: 'Myanmar', how: 'old-slug' });
  });
  it('finds nothing for an unknown name and says which entries failed', () => {
    expect(resolveFrom(t, 'atlantis')).toBeNull();
    expect(resolveAll(t, ['myanmar', 'atlantis', 'punta-cana'])).toEqual({ keys: ['p0113', 'p0058'], unknown: ['atlantis'] });
  });
  it('allocates the next key after the highest and never reuses one', () => {
    expect(nextKey(['p0001', 'p0200', 'p0057'])).toBe('p0201');
    expect(nextKey([])).toBe('p0001');
  });
  it('makes a new slug unique against live slugs, retired slugs and old ids', () => {
    expect(uniqueSlug('lima', ['myanmar'])).toBe('lima');
    expect(uniqueSlug('bagan', ['myanmar', 'bagan'])).toBe('bagan-2');
  });
});

describe('PLACE, the generated names for keys', () => {
  it('maps the slug, the old id and the old name of Myanmar to its key', () => {
    expect(PLACE.myanmar).toBe('p0113');
    expect(PLACE.bagan).toBe('p0113');
    expect(PLACE['dominican-republic']).toBe('p0058');
    expect(PLACE['punta-cana']).toBe('p0058');
  });
});

import { replaceKeysWithLabels } from '@/lib/places/console-labels';
import { buildRenamedDoc } from '@/lib/places/renamed-sync';

describe('reports never print a key (console-labels)', () => {
  const labels = new Map([['p0113', 'Myanmar'], ['p0058', 'Dominican Republic']]);
  it('replaces keys with labels and leaves everything else alone', () => {
    expect(replaceKeysWithLabels('BLOCKS  scenicLandscapes: p0113  old rule oldName', labels)).toBe('BLOCKS  scenicLandscapes: Myanmar  old rule oldName');
    expect(replaceKeysWithLabels('p0058:hiking and p0113', labels)).toBe('Dominican Republic:hiking and Myanmar');
    expect(replaceKeysWithLabels('score p01130 and xp0113 stay; p9999 has no label', labels)).toBe('score p01130 and xp0113 stay; p9999 has no label');
  });
});

describe('the old-name list is built from the label history', () => {
  it('lists the latest retired label as "was" and keeps older ones, ignoring the current label and its own case', () => {
    const doc = buildRenamedDoc({ p0113: 'Myanmar', p0001: 'Acadia National Park' }, [
      { placeKey: 'p0113', label: 'Bagan', isCurrent: false, createdAt: 1 }, { placeKey: 'p0113', label: 'Bagan & Inle', isCurrent: false, createdAt: 2 }, { placeKey: 'p0113', label: 'Myanmar', isCurrent: true, createdAt: 3 },
      { placeKey: 'p0001', label: 'acadia national park', isCurrent: false, createdAt: 1 },
    ], { allow: { p0124: { Serengeti: 'why' } } });
    expect(doc.ids).toEqual({ p0113: 'Myanmar (was Bagan & Inle)' });
    expect(doc.earlier).toEqual({ p0113: ['Bagan'] });
    expect(doc.allow).toEqual({ p0124: { Serengeti: 'why' } });
  });
});
