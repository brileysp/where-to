import { describe, expect, it } from 'vitest';
import { DEFAULT_PEAK, PEAK_NAMES, PEAK_STEPS, isPeak, peakGain } from '@/lib/onboarding/peak';
import { DEFAULT_MATCH_SETTINGS, matchSettingsProblem, mergeMatchSettings } from '@/lib/scoring/matchSettings';
import { shiftForSeason } from '@/lib/scoring/rank';
import { seasonOffset, seasonQuietness } from '@/lib/scoring/seasonCrowds';
import { parseTravelProfile } from '@/lib/onboarding/profile';
import { parseTrip, effectiveTrip, overridesFor } from '@/lib/onboarding/trips';
import { allBands } from '@/lib/onboarding/care';

describe('crowds and prices scale', () => {
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
  it('the middle moves nothing; peak times move negative, off peak positive, growing toward each end', () => {
    const g = [0, 1, 2, 3, 4].map((i) => peakGain(i, DEFAULT_MATCH_SETTINGS));
    expect(g[2]).toBe(0);
    expect(g[0]).toBeLessThan(g[1]);
    expect(g[1]).toBeLessThan(0);
    expect(g[3]).toBeGreaterThan(0);
    expect(g[4]).toBeGreaterThan(g[3]);
    expect(peakGain(99, DEFAULT_MATCH_SETTINGS)).toBe(0);
  });
  it('the steps on the Matching tab must run from negative through zero to positive', () => {
    expect(matchSettingsProblem(DEFAULT_MATCH_SETTINGS)).toBeNull();
    expect(matchSettingsProblem({ ...DEFAULT_MATCH_SETTINGS, peakStepLeanOff: 0.3, peakStepOff: 0.1 })).toMatch(/Crowds & prices/);
    expect(mergeMatchSettings({ peakStepOff: 0.4 }).peakStepOff).toBe(0.4);
    expect(mergeMatchSettings({ peakStepOff: 3 }).peakStepOff).toBe(DEFAULT_MATCH_SETTINGS.peakStepOff);
  });
});

describe('how busy a month is for a place', () => {
  const amalfi = { peak: [6, 7, 8], low: [12, 1, 2], peakIntensity: 'extreme' as const, crowdBaseline: null, inaccessible: [] as number[] };
  const mild = { ...amalfi, peakIntensity: 'mild' as const };
  it('uses the authored peak and low months and how extreme the peak is', () => {
    expect(seasonQuietness(amalfi, 6)).toBe(1);
    expect(seasonQuietness(mild, 6)).toBe(5);
    expect(seasonQuietness(amalfi, 0)).toBe(9);
    expect(seasonQuietness(amalfi, 3)).toBe(6);
  });
  it('an extreme peak is a much bigger swing than a mild one, so a mild place barely moves', () => {
    expect(seasonOffset(amalfi, 6)).toBe(-5);
    expect(seasonOffset(mild, 6)).toBe(-1);
    expect(seasonOffset(amalfi, 3)).toBe(0);
  });
  it('a month nobody can visit is neither a deal nor quiet', () => {
    expect(seasonQuietness({ ...amalfi, inaccessible: [7] }, 6)).toBeNull();
    expect(seasonOffset({ ...amalfi, inaccessible: [7] }, 6)).toBe(0);
  });
  it('a chronically busy place stays pricey in its low season; a quiet place still has an expensive peak', () => {
    expect(seasonQuietness({ ...amalfi, crowdBaseline: 'high' }, 0)).toBe(5);
    expect(seasonQuietness({ ...mild, crowdBaseline: 'low' }, 6)).toBe(3);
    expect(seasonQuietness({ ...mild, crowdBaseline: 'low' }, 3)).toBe(6);
  });
});

describe('moving a score for the leaning', () => {
  it('a neutral leaning, or a month that makes no difference, leaves the score alone', () => {
    expect(shiftForSeason(8, -5, 0)).toBe(8);
    expect(shiftForSeason(8, 0, 0.25)).toBe(8);
  });
  it('off peak lowers a busy month and raises a quiet one; peak times do the reverse', () => {
    expect(shiftForSeason(8, -5, 0.25)).toBeCloseTo(6.75, 5);
    expect(shiftForSeason(8, 3, 0.25)).toBeCloseTo(8.75, 5);
    expect(shiftForSeason(8, -5, -0.25)).toBeCloseTo(9.25, 5);
  });
  it('never leaves 0 to 10', () => {
    expect(shiftForSeason(9.9, 3, 0.25)).toBe(10);
    expect(shiftForSeason(0.5, -5, 0.25)).toBe(0);
  });
});

describe('the leaning in the profile and in a trip', () => {
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
