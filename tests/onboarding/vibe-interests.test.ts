import { describe, expect, it } from 'vitest';
import { DEFAULT_START_INTERESTS, interestsFromVibes, startingInterests } from '@/lib/onboarding/vibe-interests';
import { VIBES } from '@/lib/onboarding/vibes';

const any = () => true;

describe('interests from photo picks', () => {
  it('takes the first interest of each photo before any second ones', () => {
    expect(interestsFromVibes(['beach', 'old'], any)).toEqual(['beachesSwimming', 'historyArchaeology', 'sunbathing', 'museumsArt', 'architecture']);
  });
  it('never gives more than the maximum', () => {
    expect(interestsFromVibes(['beach', 'food', 'hotel', 'trail', 'old', 'night', 'wild'], any, 5)).toHaveLength(5);
    expect(interestsFromVibes(['beach'], any, 1)).toEqual(['beachesSwimming']);
  });
  it('skips interests that are not allowed (specialist tier, or without questions)', () => {
    expect(interestsFromVibes(['beach'], (k) => k !== 'beachesSwimming')).toEqual(['sunbathing']);
  });
  it('does not repeat an interest two photos share', () => {
    const r = interestsFromVibes(['trail', 'quiet'], any, 5);
    expect(new Set(r).size).toBe(r.length);
    expect(r.filter((k) => k === 'scenicLandscapes')).toHaveLength(1);
  });
  it('ignores photos it does not know and gives nothing for no photos', () => {
    expect(interestsFromVibes(['nope'], any)).toEqual([]);
    expect(interestsFromVibes([], any)).toEqual([]);
  });
  it('falls back to the common interests when there are no photo picks', () => {
    expect(startingInterests([], any)).toEqual(DEFAULT_START_INTERESTS);
    expect(startingInterests([], (k) => k !== 'streetFood')).toEqual(DEFAULT_START_INTERESTS.filter((k) => k !== 'streetFood'));
    expect(startingInterests(['night'], any)).toEqual(['nightlife', 'festivals']);
  });
  it('every photo points at least one interest', () => {
    for (const v of VIBES) expect(v.interests.length).toBeGreaterThan(0);
  });
});
