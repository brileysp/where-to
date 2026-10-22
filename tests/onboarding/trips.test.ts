import { describe, expect, it } from 'vitest';
import { allBands, toggleBandChoice } from '@/lib/onboarding/care';
import { defaultTripName, effectiveTrip, newTrip, nextYearFor, overridesFor, parseTrip, tripSummary, withMonth, withName, withYear } from '@/lib/onboarding/trips';

const OCT_2026 = new Date(2026, 9, 21);
const id = '3f6c0b6e-1c2d-4a5b-8c7d-9e0f1a2b3c4d';

describe('the year of a trip', () => {
  it('is the next time that month comes round', () => {
    expect(nextYearFor(8, OCT_2026)).toBe(2027); // September
    expect(nextYearFor(9, OCT_2026)).toBe(2026); // this month
    expect(nextYearFor(11, OCT_2026)).toBe(2026); // December
    expect(nextYearFor(0, OCT_2026)).toBe(2027);
  });
});

describe('trip names', () => {
  it('default to "[first name]’s [month] [year] trip"', () => {
    expect(defaultTripName('Brendan', 8, 2027)).toBe('Brendan’s September 2027 trip');
  });
  it('fall back gracefully without a name or a month', () => {
    expect(defaultTripName(null, 8, 2027)).toBe('My September 2027 trip');
    expect(defaultTripName('  ', 2, 2027)).toBe('My March 2027 trip');
    expect(defaultTripName('Brendan', null, null)).toBe('Brendan’s trip');
  });
  it('follow the month until the traveler renames the trip', () => {
    const t = newTrip({ id, first: 'Brendan', month: 8, now: OCT_2026 });
    expect(t.name).toBe('Brendan’s September 2027 trip');
    expect(withMonth(t, 11, 'Brendan', OCT_2026).name).toBe('Brendan’s December 2026 trip');
    const mine = withName(t, '  Honeymoon  ', 'Brendan');
    expect(mine.name).toBe('Honeymoon');
    expect(mine.nameAuto).toBe(false);
    expect(withMonth(mine, 2, 'Brendan', OCT_2026).name).toBe('Honeymoon');
  });
  it('go back to automatic when the name is cleared, and are never longer than 60 characters', () => {
    const t = withName(newTrip({ id, first: 'Brendan', month: 8, now: OCT_2026 }), 'x', 'Brendan');
    const back = withName(t, '   ', 'Brendan');
    expect(back.nameAuto).toBe(true);
    expect(back.name).toBe('Brendan’s September 2027 trip');
    expect(withName(t, 'a'.repeat(200), 'Brendan').name.length).toBe(60);
  });
});

describe('editing the year', () => {
  it('can be set by hand, then stays when the month changes, and the automatic name follows it', () => {
    let t = newTrip({ id, first: 'Brendan', month: 8, now: OCT_2026 });
    t = withYear(t, 2028, 'Brendan');
    expect(t.name).toBe('Brendan’s September 2028 trip');
    t = withMonth(t, 3, 'Brendan', OCT_2026);
    expect(t.year).toBe(2028);
    expect(t.name).toBe('Brendan’s April 2028 trip');
  });
  it('follows the month while it has not been edited', () => {
    const t = withMonth(newTrip({ id, first: 'B', month: 8, now: OCT_2026 }), 11, 'B', OCT_2026);
    expect(t.year).toBe(2026);
  });
});

describe('what a trip inherits', () => {
  const profile = { who: ['solo'], bands: toggleBandChoice(allBands(), 'budget', 'luxury'), care: { food: { o: ['vegan'], firm: true } }, maxHours: 0 };
  it('uses the profile for everything the trip has not changed', () => {
    const e = effectiveTrip(profile, { overrides: {} });
    expect(e.who).toEqual(['solo']);
    expect(e.bands.budget).toEqual(['luxury']);
    expect(e.care.food.o).toEqual(['vegan']);
    expect(e.maxHours).toBe(0);
  });
  it('lets a trip change who, budget, dietary needs and the flight limit without touching the others', () => {
    const e = effectiveTrip(profile, { overrides: { who: ['kids'], care: { food: { o: ['halal'], firm: false } }, maxHours: 8 } });
    expect(e.who).toEqual(['kids']);
    expect(e.care.food.o).toEqual(['halal']);
    expect(e.bands.budget).toEqual(['luxury']);
    expect(e.maxHours).toBe(8);
  });
  it('saves only what differs from the profile', () => {
    const same = overridesFor(profile, { who: ['solo'], bands: profile.bands, care: profile.care, maxHours: 0 });
    expect(same).toEqual({});
    const diff = overridesFor(profile, { who: ['kids'], bands: profile.bands, care: { ...profile.care, kids: { o: ['k'], firm: false } }, maxHours: 4 });
    expect(diff).toEqual({ who: ['kids'], care: { kids: { o: ['k'], firm: false } }, maxHours: 4 });
  });
  it('treats an item the trip cleared as an override', () => {
    const o = overridesFor(profile, { who: ['solo'], bands: profile.bands, care: {}, maxHours: 0 });
    expect(o.care).toEqual({ food: { o: [], firm: false } });
    expect(effectiveTrip(profile, { overrides: o }).care.food.o).toEqual([]);
  });
});

describe('parseTrip', () => {
  it('cleans what it is given', () => {
    const t = parseTrip({ id, name: ' My trip ', month: 8, year: 2027, week: 9, length: 'forever', continents: ['eu', 'mars'], overrides: { who: ['solo', 'dog'], maxHours: 5 } })!;
    expect(t.name).toBe('My trip');
    expect(t.week).toBe(0);
    expect(t.length).toBeNull();
    expect(t.continents).toEqual(['eu']);
    expect(t.overrides).toEqual({ who: ['solo'] });
  });
  it('refuses a trip without a proper id, and names a nameless one', () => {
    expect(parseTrip({ id: 'x', name: 'a' })).toBeNull();
    expect(parseTrip(null)).toBeNull();
    expect(parseTrip({ id, month: 2, year: 2027 })!.name).toBe('My March 2027 trip');
  });
  it('round trips a trip', () => {
    const t = newTrip({ id, first: 'Brendan', month: 8, now: OCT_2026, length: '1w', continents: ['eu', 'af'] });
    expect(parseTrip(JSON.parse(JSON.stringify(t)))).toEqual(t);
  });
  it('saves "all continents" as an empty list', () => {
    expect(parseTrip({ id, continents: ['na', 'csa', 'eu', 'af', 'as', 'oc'] })!.continents).toEqual([]);
  });
});

describe('tripSummary', () => {
  it('reads like a short line', () => {
    const t = newTrip({ id, first: 'B', month: 8, now: OCT_2026, length: '1w', continents: ['eu'] });
    expect(tripSummary(t, () => '1 week', () => 'Europe')).toBe('Sep 2027 · 1 week · Europe');
    expect(tripSummary({ month: null, year: null, length: null, continents: [] }, () => '', () => '')).toBe('Any time, anywhere');
  });
});
