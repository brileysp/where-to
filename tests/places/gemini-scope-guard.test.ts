import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { renamedWithoutConfirmedScope } from '@/lib/places/gemini-scope-guard';
import { PLACE } from '@/lib/places/keys.generated';

const root = join(__dirname, '..', '..');
const renamed = JSON.parse(readFileSync(join(root, 'docs', 'renamed-places.json'), 'utf8')).ids as Record<string, string>;

describe('renamed and widened places are not sent to Gemini until the owner has confirmed their scope (standard D05, owner 20 Nov 2026)', () => {
  it("blocks Quebec City & Montreal, whose Scenic facts were written for 'Quebec City', while its scope is a draft", () => {
    const blocked = renamedWithoutConfirmedScope([{ k: 'scenicLandscapes', id: PLACE['quebec-city-and-montreal'] }], renamed, { [PLACE['quebec-city-and-montreal']]: 'draft' });
    expect(blocked).toHaveLength(1);
    expect(blocked[0].note).toContain('was Quebec City');
  });
  it('lets a renamed place through once the owner has confirmed its scope', () => {
    expect(renamedWithoutConfirmedScope([{ k: 'scenicLandscapes', id: PLACE['quebec-city-and-montreal'] }], renamed, { [PLACE['quebec-city-and-montreal']]: 'confirmed' })).toEqual([]);
  });
  it('does not block a place that was never renamed, even with a draft scope', () => {
    expect(renamedWithoutConfirmedScope([{ k: 'scenicLandscapes', id: PLACE.paris }], renamed, { [PLACE.paris]: 'draft' })).toEqual([]);
  });
  it('covers all 20 renamed places', () => {
    expect(Object.keys(renamed)).toHaveLength(20);
    expect(renamedWithoutConfirmedScope(Object.keys(renamed).map((id) => ({ k: 'scenicLandscapes', id })), renamed, {})).toHaveLength(20);
  });
  it('both scripts that send places to Gemini use the check', () => {
    expect(readFileSync(join(root, 'scripts', 'gemini-batch.ts'), 'utf8')).toContain('renamedWithoutConfirmedScope');
    expect(readFileSync(join(root, 'scripts', 'gemini-author-batch.ts'), 'utf8')).toContain('scopeConfirmed(place.id)');
  });
});
