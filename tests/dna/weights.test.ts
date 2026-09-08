import { describe, expect, it } from 'vitest';
import { convertTravelDNAToRecommendationWeights, SLIDER_ATTRIBUTE_MAP } from '@/lib/dna/weights';
import { createEmptyPreferenceProfile } from '@/lib/dna/profile';
import { createStatePair, legacy } from './helpers';

describe('convertTravelDNAToRecommendationWeights', () => {
  // A blank-slate profile carries zero signal for every slider, so on
  // BOTH sides of the taxonomy migration every key trivially floors to
  // the same ~2 baseline (see the "never-tested" test below) regardless
  // of what SLIDER_ATTRIBUTE_MAP's specific attribute weights are — this
  // makes the blank-slate case a weak but still real invariant to keep
  // even after the 28-key legacy taxonomy became the 53-key one: every
  // new-side key present should still floor to exactly 2. A real
  // key-by-key value comparison against the legacy engine no longer
  // applies once the key sets themselves deliberately diverge (renames,
  // splits, and brand-new interests the legacy engine never had), so this
  // no longer asserts equality against legacy's own output.
  it('floors every new-taxonomy slider to the ~2 baseline on a blank-slate (all-zero) profile', () => {
    const { legacyState, newState } = createStatePair();
    const legacyWeights = legacy.convertTravelDNAToRecommendationWeights(legacyState.profile);
    expect(new Set(Object.values(legacyWeights))).toEqual(new Set([2])); // sanity: legacy itself floors everything to 2 here
    const weights = convertTravelDNAToRecommendationWeights(newState.profile);
    expect(Object.keys(weights).sort()).toEqual(Object.keys(SLIDER_ATTRIBUTE_MAP).sort());
    Object.values(weights).forEach((v) => expect(v).toBe(2));
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
