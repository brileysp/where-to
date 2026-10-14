import { describe, it, expect } from 'vitest';
import { GATE_MIN_WEIGHT, isVisibleForWeights, unlockingInterests } from '@/lib/scoring/gating';

const bentonville = { gated: true, gatedInterests: ['mountainBiking'] };
const mozambique = { gated: true, gatedInterests: ['safari', 'diving', 'beaches'] };

describe('specialist place gating', () => {
  it('never hides a place that is not gated', () => {
    expect(isVisibleForWeights({}, {})).toBe(true);
    expect(isVisibleForWeights({ gated: false, gatedInterests: ['safari'] }, {})).toBe(true);
  });
  it('hides a gated place until the interest weight reaches the threshold', () => {
    expect(isVisibleForWeights(bentonville, { mountainBiking: GATE_MIN_WEIGHT - 1 })).toBe(false);
    expect(isVisibleForWeights(bentonville, { mountainBiking: GATE_MIN_WEIGHT })).toBe(true);
    expect(isVisibleForWeights(bentonville, {})).toBe(false);
  });
  it('any one of several gated interests unlocks the place', () => {
    expect(isVisibleForWeights(mozambique, { safari: 3, diving: 8 })).toBe(true);
    expect(unlockingInterests(mozambique, { safari: 9, diving: 8, beaches: 2 })).toEqual(['safari', 'diving']);
    expect(isVisibleForWeights(mozambique, { safari: 3, beaches: 6 })).toBe(false);
  });
  it('a place marked gated with no interests picked stays visible', () => {
    expect(isVisibleForWeights({ gated: true, gatedInterests: [] }, {})).toBe(true);
  });
});
