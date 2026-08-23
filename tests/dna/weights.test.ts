import { describe, expect, it } from 'vitest';
import { convertTravelDNAToRecommendationWeights } from '@/lib/dna/weights';
import { createEmptyPreferenceProfile } from '@/lib/dna/profile';
import { createStatePair, legacy } from './helpers';

describe('convertTravelDNAToRecommendationWeights', () => {
  // Deliberate divergence from the legacy engine: legacy's own
  // SLIDER_ATTRIBUTE_MAP never had a luxuryLodging entry either — a real
  // bug in the original app, not introduced by the port — so luxuryLodging
  // could never receive a nonzero weight from any signal (interests,
  // bands, or swipes). Fixed on this side only; the legacy reference used
  // for this comparison still lacks the key, so it's added back in before
  // comparing everything else for an exact match.
  it('matches legacy on the blank-slate (all-zero) profile, plus the fixed luxuryLodging entry', () => {
    const { legacyState, newState } = createStatePair();
    const legacyWeights = legacy.convertTravelDNAToRecommendationWeights(legacyState.profile);
    expect(convertTravelDNAToRecommendationWeights(newState.profile)).toEqual({
      ...legacyWeights,
      luxuryLodging: 2,
    });
  });

  // Deliberate divergence from the legacy engine: legacy floors EVERY
  // slider (including net-rejected ones) to ~2 via min-max normalization.
  // Per product feedback, a slider the user only ever swiped "no" on
  // should read as 0, not a soft "maybe" — so net-negative raw signal
  // skips the floor entirely instead of being lifted into it.
  it('floors a slider to exactly 0 when its net signal is negative (only swiped left)', () => {
    const profile = createEmptyPreferenceProfile();
    profile.golf = -5;
    profile.birding = 4;
    const weights = convertTravelDNAToRecommendationWeights(profile);
    expect(weights.golf).toBe(0);
    expect(weights.birding).toBeGreaterThan(0);
  });

  it('still floors a never-tested (zero-signal) slider at the ~2 baseline, not 0', () => {
    const profile = createEmptyPreferenceProfile();
    profile.birding = 4;
    const weights = convertTravelDNAToRecommendationWeights(profile);
    expect(weights.golf).toBeGreaterThanOrEqual(2);
  });

  // golf's weighted sum also includes 'relaxation' and 'luxury' — shared
  // with sailing/spa/finedining — so unrelated positive swipes on those
  // could otherwise keep golf's aggregate positive even after the user
  // explicitly rejected every golf card. The dominant-attribute check
  // catches this: golf itself went negative, so it floors to 0 regardless.
  it('floors a slider to 0 via its dominant attribute even when shared secondary attributes are positive', () => {
    const profile = createEmptyPreferenceProfile();
    profile.golf = -3; // direct rejection of golf specifically
    profile.relaxation = 5; // positive from unrelated beach/spa swipes
    profile.luxury = 5;
    const weights = convertTravelDNAToRecommendationWeights(profile);
    expect(weights.golf).toBe(0);
  });
});
