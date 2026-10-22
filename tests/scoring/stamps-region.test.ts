import { describe, expect, it } from 'vitest';
import { stampsRegionFor } from '@/lib/scoring/continents';

describe('passport regions', () => {
  it('puts Puerto Rico with the Caribbean, not the mainland US', () => {
    expect(stampsRegionFor('puerto-rico')).toBe('Mexico, Central America and Caribbean');
  });
  it('keeps the US states, Hawaii included, under US', () => {
    expect(stampsRegionFor('maui')).toBe('US');
    expect(stampsRegionFor('yosemite')).toBe('US');
  });
  it('keeps Canada, and the Caribbean countries, in their own groups', () => {
    expect(stampsRegionFor('banff')).toBe('Canada');
    expect(stampsRegionFor('jamaica')).toBe('Mexico, Central America and Caribbean');
  });
});
