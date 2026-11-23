import { describe, expect, it } from 'vitest';
import { rekeyJson, rekeyString, type RekeyStats } from '@/lib/places/rekey';

const map = { bagan: 'p0113', 'punta-cana': 'p0058', napa: 'p0107', acadia: 'p0001' };

// 18 Nov 2026, step 3 of the naming plan: old ids become keys inside data files, and nothing else changes.
describe('rewriting old place ids to keys in data', () => {
  it('rewrites an id used as a key or as a whole value', () => {
    expect(rekeyJson({ bagan: { name: 'x' }, list: ['punta-cana', 'other'] }, map)).toEqual({ p0113: { name: 'x' }, list: ['p0058', 'other'] });
  });
  it('rewrites composites such as acadia:hiking, scenicLandscapes|bagan and scenicLandscapes__bagan', () => {
    expect(rekeyString('acadia:hiking', map)).toBe('p0001:hiking');
    expect(rekeyString('scenicLandscapes|bagan', map)).toBe('scenicLandscapes|p0113');
    expect(rekeyString('scenicLandscapes__bagan', map)).toBe('scenicLandscapes__p0113');
    expect(rekeyString('bagan|scenicLandscapes', map)).toBe('p0113|scenicLandscapes');
  });
  it('never touches free text that merely contains an id', () => {
    expect(rekeyString('Bagan is hot', map)).toBe('Bagan is hot');
    expect(rekeyString('napa valley wine', map)).toBe('napa valley wine');
    expect(rekeyString('Note: napa is dry', map)).toBe('Note: napa is dry');
    expect(rekeyString('docs/bagan-facts.json', map)).toBe('docs/bagan-facts.json');
  });
  it('counts what it changed and refuses to merge two keys', () => {
    const stats: RekeyStats = { keys: 0, values: 0, composites: 0 };
    rekeyJson({ bagan: 'napa', n: 'acadia:diving' }, map, stats);
    expect(stats).toEqual({ keys: 1, values: 1, composites: 1 });
    expect(() => rekeyJson({ bagan: 1, p0113: 2 }, map)).toThrow(/Two keys/);
  });
  it('can leave keys alone and rewrite only values (files keyed by another source\'s names)', () => {
    expect(rekeyJson({ bagan: { placeId: 'bagan' } }, map, undefined, { valuesOnly: true })).toEqual({ bagan: { placeId: 'p0113' } });
  });
});
