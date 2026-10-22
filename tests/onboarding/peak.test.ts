import { describe, expect, it } from 'vitest';
import { DEFAULT_PEAK, PEAK_NAMES, PEAK_STEPS, isPeak, peakWeight } from '@/lib/onboarding/peak';
import { DEFAULT_MATCH_SETTINGS, matchSettingsProblem, mergeMatchSettings } from '@/lib/scoring/matchSettings';
import { blendOffPeak } from '@/lib/scoring/rank';
import { parseTravelProfile } from '@/lib/onboarding/profile';
import { parseTrip, effectiveTrip, overridesFor } from '@/lib/onboarding/trips';
import { allBands } from '@/lib/onboarding/care';

describe('peak or off peak', () => {
  it('has five steps and starts in the middle', () => {
    expect(PEAK_STEPS).toBe(5);
    expect(PEAK_NAMES).toHaveLength(5);
    expect(DEFAULT_PEAK).toBe(2);
    expect(PEAK_NAMES[DEFAULT_PEAK]).toBe('In between');
  });
  it('only accepts whole steps from 0 to 4', () => {
    expect([0, 1, 2, 3, 4].every(isPeak)).toBe(true);
    expect([-1, 5, 2.5, '2', null, undefined, NaN].some(isPeak)).toBe(false);
  });
  it('mixes in nothing at Peak times, and more at each step toward Off peak', () => {
    const w = [0, 1, 2, 3, 4].map((i) => peakWeight(i, DEFAULT_MATCH_SETTINGS));
    expect(w[0]).toBe(0);
    expect(w).toEqual([...w].sort((a, b) => a - b));
    expect(w[2]).toBe(0.2);
    expect(peakWeight(99, DEFAULT_MATCH_SETTINGS)).toBe(0.2);
  });
  it('the steps on the Matching tab must grow from one step to the next', () => {
    expect(matchSettingsProblem(DEFAULT_MATCH_SETTINGS)).toBeNull();
    expect(matchSettingsProblem({ ...DEFAULT_MATCH_SETTINGS, peakMiddle: 0.5, peakLeanOff: 0.3 })).toMatch(/peak or off peak/);
    expect(mergeMatchSettings({ peakOff: 0.7 }).peakOff).toBe(0.7);
    expect(mergeMatchSettings({ peakOff: 3 }).peakOff).toBe(DEFAULT_MATCH_SETTINGS.peakOff);
  });
});

describe('mixing in the off-peak value', () => {
  it('leaves the score alone with no weight or no off-peak value', () => {
    expect(blendOffPeak(8, 3, 0)).toBe(8);
    expect(blendOffPeak(8, undefined, 0.5)).toBe(8);
    expect(blendOffPeak(8, NaN, 0.5)).toBe(8);
  });
  it('moves a busy place down and a quiet one up, by the weight', () => {
    expect(blendOffPeak(8, 3, 0.2)).toBeCloseTo(7, 5);
    expect(blendOffPeak(7, 7, 0.5)).toBeCloseTo(7, 5);
    expect(blendOffPeak(6.6, 7, 0.5)).toBeCloseTo(6.8, 5);
  });
});

describe('peak in the profile and in a trip', () => {
  it('a saved profile keeps a valid step, and falls back to the middle for anything else', () => {
    expect(parseTravelProfile({ v: 1, peak: 4 })!.peak).toBe(4);
    expect(parseTravelProfile({ v: 1, peak: 9 })!.peak).toBe(2);
    expect(parseTravelProfile({ v: 1 })!.peak).toBe(2);
  });
  it('a trip can set its own step, and only a different step is saved', () => {
    const profile = { who: [], bands: allBands(), care: {}, peak: 3 };
    expect(effectiveTrip(profile, { overrides: {} }).peak).toBe(3);
    expect(effectiveTrip(profile, { overrides: { peak: 0 } }).peak).toBe(0);
    expect(overridesFor(profile, { who: [], bands: profile.bands, care: {}, peak: 3 })).toEqual({});
    expect(overridesFor(profile, { who: [], bands: profile.bands, care: {}, peak: 2 })).toEqual({ peak: 2 });
    const t = parseTrip({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', overrides: { peak: 2 } })!;
    expect(t.overrides.peak).toBe(2);
  });
});
