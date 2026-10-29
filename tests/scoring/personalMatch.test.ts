import { describe, it, expect } from 'vitest';
import { matchInterest, survives } from '@/lib/scoring/personalMatch';
import { DEFAULT_MATCH_SETTINGS, matchSettingsProblem, mergeMatchSettings } from '@/lib/scoring/matchSettings';

const chip = (label: string, rating: number | null) => ({ label, rating });
const limit = (fit: number | null, message = 'Limit missed') => ({ kind: 'limit' as const, fit, message });
const lean = (fit: number | null, message = 'Lean missed') => ({ kind: 'lean' as const, fit, message });

describe('what survives one check', () => {
  it('keeps everything on a full match and the "keep" share on a complete miss', () => {
    expect(survives(0.5, 1)).toBe(1);
    expect(survives(0.5, 0)).toBe(0.5);
    expect(survives(0.85, 0)).toBeCloseTo(0.85);
  });
  it('loses a part of the miss for a near miss, and never goes above 1 or below the keep share', () => {
    expect(survives(0.5, 0.5)).toBeCloseTo(0.75);
    expect(survives(0.5, 3)).toBe(1);
    expect(survives(0.5, -2)).toBe(0.5);
  });
});

describe('matching one interest', () => {
  it('changes nothing when no chips are ticked, or every chip is', () => {
    expect(matchInterest({ ticked: [], chipsOffered: 4, answers: [] }).factor).toBe(1);
    const all = [chip('A', 0), chip('B', 0), chip('C', 0), chip('D', 0)];
    expect(matchInterest({ ticked: all, chipsOffered: 4, answers: [] }).factor).toBe(1);
  });
  it('uses the best ticked chip, so ticking more chips never lowers a place', () => {
    const one = matchInterest({ ticked: [chip('Big climbs', 0)], chipsOffered: 4, answers: [] }).factor;
    const two = matchInterest({ ticked: [chip('Big climbs', 0), chip('Quiet roads', 6)], chipsOffered: 4, answers: [] }).factor;
    expect(one).toBe(0.5);
    expect(two).toBeGreaterThan(one);
    expect(two).toBeCloseTo(survives(0.5, 6 / 7));
  });
  it('counts a rating at or above the full-match rating as a full match', () => {
    expect(matchInterest({ ticked: [chip('X', 7)], chipsOffered: 4, answers: [] }).factor).toBe(1);
    expect(matchInterest({ ticked: [chip('X', 10)], chipsOffered: 4, answers: [] }).matches).toEqual(['X']);
  });
  it('treats missing data as a pass, for chips and for answers', () => {
    expect(matchInterest({ ticked: [chip('X', null)], chipsOffered: 4, answers: [limit(null), lean(null)] }).factor).toBe(1);
  });
  it('lets one Limit miss decide a place and Lean misses add up slowly', () => {
    expect(matchInterest({ ticked: [], chipsOffered: 4, answers: [limit(0)] }).factor).toBe(0.65);
    expect(matchInterest({ ticked: [], chipsOffered: 4, answers: [lean(0), lean(0), lean(0)] }).factor).toBeCloseTo(0.85 ** 3);
  });
  it('never goes below the floor however much is missed', () => {
    const r = matchInterest({ ticked: [chip('X', 0)], chipsOffered: 4, answers: [limit(0), limit(0), lean(0)] });
    expect(r.factor).toBe(DEFAULT_MATCH_SETTINGS.interestFloor);
  });
  it('gives reason chips for the biggest losses only, at most two, and none below the threshold', () => {
    const r = matchInterest({ ticked: [chip('Orcas', 0)], chipsOffered: 4, answers: [limit(0, 'Needs a higher dive certification'), lean(0, 'No right-hand waves'), lean(0.9, 'tiny')] });
    expect(r.reasons.map((x) => x.message)).toEqual(['Not much for: Orcas', 'Needs a higher dive certification']);
    expect(matchInterest({ ticked: [], chipsOffered: 4, answers: [lean(0.9, 'tiny')] }).reasons).toEqual([]);
  });
  it('gives no chip to a question with no message, though it still lowers the score', () => {
    const r = matchInterest({ ticked: [], chipsOffered: 4, answers: [limit(0, '')] });
    expect(r.factor).toBe(0.65);
    expect(r.reasons).toEqual([]);
  });
  it('follows the settings it is given', () => {
    const harsher = mergeMatchSettings({ keepIfLimitMissed: 0.3, interestFloor: 0.2 });
    expect(matchInterest({ ticked: [], chipsOffered: 4, answers: [limit(0)] }, harsher).factor).toBeCloseTo(0.3);
  });
  it('reproduces the worked example: a place that scores 9 for a traveler who ticked only a chip it lacks', () => {
    expect(9 * matchInterest({ ticked: [chip('Big mountain climbs', 0)], chipsOffered: 4, answers: [] }).factor).toBeCloseTo(4.5);
  });
});

describe('the settings', () => {
  it('keeps only valid numbers in range and falls back to the defaults for the rest', () => {
    const s = mergeMatchSettings({ keepIfLeanMissed: 0.7, keepIfLimitMissed: 5, interestFloor: 'x', maxReasons: 3.4, bogus: 1 });
    expect(s.keepIfLeanMissed).toBe(0.7);
    expect(s.keepIfLimitMissed).toBe(DEFAULT_MATCH_SETTINGS.keepIfLimitMissed);
    expect(s.interestFloor).toBe(DEFAULT_MATCH_SETTINGS.interestFloor);
    expect(s.maxReasons).toBe(3);
    expect(mergeMatchSettings(null)).toEqual(DEFAULT_MATCH_SETTINGS);
  });
  it('refuses a floor higher than what a missed chip or Limit keeps', () => {
    expect(matchSettingsProblem(DEFAULT_MATCH_SETTINGS)).toBeNull();
    expect(matchSettingsProblem({ ...DEFAULT_MATCH_SETTINGS, interestFloor: 0.6 })).toContain('floor');
  });
});
