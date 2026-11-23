import { describe, expect, it } from 'vitest';
import { stampsRegionFor } from '@/lib/scoring/continents';
import { PLACE } from '@/lib/places/keys.generated';

describe('passport regions', () => {
  it('puts Puerto Rico with the Caribbean, not the mainland US', () => {
    expect(stampsRegionFor(PLACE['puerto-rico'])).toBe('Mexico, Central America and Caribbean');
  });
  it('keeps the US states, Hawaii included, under US', () => {
    expect(stampsRegionFor(PLACE.maui)).toBe('US');
    expect(stampsRegionFor(PLACE['yosemite-national-park'])).toBe('US');
  });
  it('keeps Canada, and the Caribbean countries, in their own groups', () => {
    expect(stampsRegionFor(PLACE['banff-and-jasper-national-parks'])).toBe('Canada');
    expect(stampsRegionFor(PLACE.jamaica)).toBe('Mexico, Central America and Caribbean');
  });
});
