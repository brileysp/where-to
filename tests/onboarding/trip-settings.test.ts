import { describe, expect, it } from 'vitest';
import { allRegions, regionAllows, regionOfPlace, regionsForPlaces, REGION_KEYS } from '@/lib/onboarding/regions';
import { airportsFor, hasSubStep, originLabel, resolveOrigin, subChoices } from '@/lib/onboarding/origin';
import { daysFor, lengthFactor, lengthTier, travelShare } from '@/lib/onboarding/trip-length';
import { DEFAULT_MATCH_SETTINGS, matchSettingsProblem, mergeMatchSettings } from '@/lib/scoring/matchSettings';
import { milesBetween, estimateFlightHours } from '@/lib/onboarding/airports';

describe('regions', () => {
  it('puts places in the region the owner chose', () => {
    expect(regionOfPlace({ type: 'country', code: 'MEX' }, { lat: 19, lon: -99 })).toBe('na');
    expect(regionOfPlace({ type: 'country', code: 'CRI' }, { lat: 10, lon: -84 })).toBe('csa');
    expect(regionOfPlace({ type: 'country', code: 'JAM' }, { lat: 18, lon: -77 })).toBe('csa');
    expect(regionOfPlace({ type: 'us-state', code: 'HI' }, { lat: 20, lon: -156 })).toBe('na');
    expect(regionOfPlace({ type: 'us-state', code: 'AK' }, { lat: 64, lon: -150 })).toBe('na');
    expect(regionOfPlace({ type: 'us-state', code: 'PR' }, { lat: 18, lon: -66 })).toBe('csa');
    expect(regionOfPlace({ type: 'country', code: 'EGY' }, { lat: 27, lon: 33 })).toBe('af');
    expect(regionOfPlace({ type: 'country', code: 'JOR' }, { lat: 30, lon: 35 })).toBe('as');
    expect(regionOfPlace({ type: 'country', code: 'GEO' }, { lat: 41.7, lon: 44.8 })).toBe('eu');
    expect(regionOfPlace({ type: 'country', code: 'FJI' }, { lat: -17, lon: 178 })).toBe('oc');
    expect(regionOfPlace({ type: 'country', code: 'PYF' }, { lat: -17, lon: -149 })).toBe('oc');
    expect(regionOfPlace({ type: 'country', code: 'ATA' }, { lat: -65, lon: -62 })).toBeNull();
  });
  it('splits Turkey and Russia by where the place really is', () => {
    expect(regionOfPlace({ type: 'country', code: 'TUR' }, { lat: 41.0, lon: 28.98 })).toBe('eu'); // Istanbul
    expect(regionOfPlace({ type: 'country', code: 'TUR' }, { lat: 38.6, lon: 34.8 })).toBe('as'); // Cappadocia
    expect(regionOfPlace({ type: 'country', code: 'RUS' }, { lat: 59.9, lon: 30.3 })).toBe('eu'); // St Petersburg
    expect(regionOfPlace({ type: 'country', code: 'RUS' }, { lat: 43.1, lon: 131.9 })).toBe('as'); // Vladivostok
    expect(regionOfPlace({ type: 'country', code: 'RUS' }, { lat: 64.7, lon: -177.5 })).toBe('as'); // Chukotka
  });
  it('treats every region on, or none picked, as no preference', () => {
    expect(allRegions([])).toBe(true);
    expect(allRegions(REGION_KEYS)).toBe(true);
    expect(allRegions(['eu'])).toBe(false);
  });
  it('leaves out places in regions that are off, and keeps a regionless place only when everything is on', () => {
    expect(regionAllows(['eu', 'af'], 'eu')).toBe(true);
    expect(regionAllows(['eu', 'af'], 'as')).toBe(false);
    expect(regionAllows(['eu', 'af'], null)).toBe(false);
    expect(regionAllows(REGION_KEYS, null)).toBe(true);
    expect(regionAllows([], 'as')).toBe(true);
  });
  it('gives every real place a region or a deliberate none', () => {
    const r = regionsForPlaces({ istanbul: { lat: 41, lon: 28.98 }, antarctica: { lat: -65, lon: -62 }, maui: { lat: 20.8, lon: -156.3 } });
    expect(r.istanbul).toBe('eu');
    expect(r.antarctica).toBeNull();
    expect(r.maui).toBe('na');
  });
});

describe('home origin', () => {
  it('asks a second question only for the United States and Canada', () => {
    expect(hasSubStep('US')).toBe(true);
    expect(hasSubStep('CA')).toBe(true);
    expect(hasSubStep('GB')).toBe(false);
    expect(subChoices('US').length).toBe(51);
    expect(subChoices('CA').length).toBe(13);
    expect(subChoices('GB')).toEqual([]);
  });
  it('works out where flights start from', () => {
    expect(resolveOrigin({ country: 'US', sub: 'IL' })?.label).toBe('Illinois');
    expect(resolveOrigin({ country: 'US' })).toBeNull();
    expect(resolveOrigin({ country: 'CA', sub: 'ON' })?.label).toBe('Toronto, Ontario');
    expect(resolveOrigin({ country: 'JP' })?.label).toBe('Japan');
    expect(resolveOrigin({ country: 'ZZ' })).toBeNull();
    expect(resolveOrigin({ airport: 'ORD', country: 'US', sub: 'TX' })?.label).toContain('ORD');
  });
  it('labels the home plainly', () => {
    expect(originLabel({})).toBe('Not set');
    expect(originLabel({ country: 'US', sub: 'IL' })).toBe('Illinois, US');
    expect(originLabel({ country: 'CA', sub: 'QC' })).toBe('Montreal, Quebec, Canada');
    expect(originLabel({ country: 'GB' })).toBe('United Kingdom');
  });
  it('offers the airports of the chosen state or province', () => {
    expect(airportsFor('US', 'IL').map((a) => a.code)).toContain('ORD');
    expect(airportsFor('CA', 'ON').map((a) => a.code)).toContain('YYZ');
    expect(airportsFor('CA', 'NU')).toEqual([]);
    expect(airportsFor('GB', null)).toEqual([]);
  });
});

describe('trip length', () => {
  it('has four lengths with days', () => {
    expect([daysFor('wk'), daysFor('1w'), daysFor('2w'), daysFor('3w'), daysFor(null)]).toEqual([4, 7, 14, 21, null]);
  });
  it('counts the flights both ways plus airport time against the trip', () => {
    expect(travelShare(4, 10)).toBeCloseTo((20 + 8) / 96, 6);
  });
  it('is fine up to a quarter of the trip, a stretch to 45%, then mostly travel', () => {
    expect(lengthTier(7, 5)).toBe('ok'); // 18h of 168
    expect(lengthTier(4, 9)).toBe('stretch'); // 26h of 96 = 27%
    expect(lengthTier(4, 20)).toBe('far'); // 48h of 96 = 50%
    expect(lengthTier(21, 24)).toBe('ok');
  });
  it('keeps less of the score the more the flights eat the trip, and never hides a place', () => {
    expect(lengthFactor(4, 3)).toBe(1);
    expect(lengthFactor(4, 9)).toBe(DEFAULT_MATCH_SETTINGS.keepIfTripStretch);
    expect(lengthFactor(4, 20)).toBe(DEFAULT_MATCH_SETTINGS.keepIfTripFar);
    expect(lengthFactor(4, 20)).toBeGreaterThan(0);
  });
  it('gives sensible hours from a real home to real places', () => {
    const chicago = resolveOrigin({ country: 'US', sub: 'IL' })!;
    const bali = estimateFlightHours(milesBetween(chicago, { lat: -8.4, lon: 115.2 }));
    const cancun = estimateFlightHours(milesBetween(chicago, { lat: 21.2, lon: -86.8 }));
    expect(bali).toBeGreaterThan(18);
    expect(cancun).toBeLessThan(5);
  });
});

describe('trip length settings', () => {
  it('ship with the proposed numbers', () => {
    expect(DEFAULT_MATCH_SETTINGS.tripAirportHours).toBe(8);
    expect(DEFAULT_MATCH_SETTINGS.tripStretchShare).toBe(0.25);
    expect(DEFAULT_MATCH_SETTINGS.tripFarShare).toBe(0.45);
    expect(matchSettingsProblem(DEFAULT_MATCH_SETTINGS)).toBeNull();
  });
  it('refuse numbers that contradict each other', () => {
    expect(matchSettingsProblem({ ...DEFAULT_MATCH_SETTINGS, tripStretchShare: 0.5, tripFarShare: 0.4 })).toMatch(/lower than/);
    expect(matchSettingsProblem({ ...DEFAULT_MATCH_SETTINGS, keepIfTripStretch: 0.5, keepIfTripFar: 0.7 })).toMatch(/cannot keep more/);
  });
  it('are merged and rounded like the others', () => {
    const m = mergeMatchSettings({ tripAirportHours: 6.4, tripFarShare: 0.5 });
    expect(m.tripAirportHours).toBe(6);
    expect(m.tripFarShare).toBe(0.5);
  });
});
