import { describe, it, expect } from 'vitest';
import { AIRPORTS, airportByCode, estimateFlightHours, milesBetween, searchAirports } from '@/lib/onboarding/airports';

describe('airport data', () => {
  it('has a unique code per airport and sensible coordinates', () => {
    expect(new Set(AIRPORTS.map((a) => a.code)).size).toBe(AIRPORTS.length);
    expect(AIRPORTS.length).toBeGreaterThan(300);
    for (const a of AIRPORTS) {
      expect(a.code).toMatch(/^[A-Z]{3}$/);
      expect(Math.abs(a.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(a.lon)).toBeLessThanOrEqual(180);
    }
  });
  it('tells apart the airports of a city that has several', () => {
    expect(airportByCode('LHR')!.region).toBe('England (Heathrow)');
    expect(airportByCode('LGW')!.region).toBe('England (Gatwick)');
    expect(airportByCode('SFO')!.region).toBe('California, US');
  });
});

describe('searching', () => {
  it('shows nothing before two letters', () => {
    expect(searchAirports('')).toEqual([]);
    expect(searchAirports('s')).toEqual([]);
  });
  it('finds cities by their start, best first, and shows every airport of a city', () => {
    expect(searchAirports('san').map((a) => a.code).slice(0, 3)).toEqual(expect.arrayContaining(['SAN', 'SFO']));
    expect(searchAirports('san').every((a) => a.city.toLowerCase().includes('san') || a.region.toLowerCase().includes('san') || a.code.toLowerCase().startsWith('san'))).toBe(true);
    const ny = searchAirports('new york').map((a) => a.code);
    expect(ny).toEqual(expect.arrayContaining(['JFK', 'LGA']));
    const lon = searchAirports('london').map((a) => a.code);
    expect(lon).toEqual(expect.arrayContaining(['LHR', 'LGW', 'STN']));
  });
  it('finds an airport by its code', () => {
    expect(searchAirports('jfk')[0].code).toBe('JFK');
    expect(searchAirports('SFO')[0].code).toBe('SFO');
  });
  it('ranks a city that starts with the text above one where the text is a later word', () => {
    const r = searchAirports('san');
    const firstCity = r[0].city.toLowerCase();
    expect(firstCity.startsWith('san')).toBe(true);
  });
  it('matches region words only from three letters, and never returns more than six', () => {
    expect(searchAirports('texas').map((a) => a.code)).toEqual(expect.arrayContaining(['DFW']));
    expect(searchAirports('ca').every((a) => a.city.toLowerCase().includes('ca') || a.code.toLowerCase().startsWith('ca') || a.city.toLowerCase().split(/[^a-z]+/).some((w) => w.startsWith('ca')))).toBe(true);
    expect(searchAirports('ma').length).toBeLessThanOrEqual(6);
  });
  it('says so by returning nothing when nothing matches', () => {
    expect(searchAirports('zzzz')).toEqual([]);
  });
});

describe('flight hours', () => {
  it('measures the great-circle distance', () => {
    const jfk = airportByCode('JFK')!;
    const lax = airportByCode('LAX')!;
    expect(Math.round(milesBetween(jfk, lax))).toBeGreaterThan(2400);
    expect(Math.round(milesBetween(jfk, lax))).toBeLessThan(2500);
  });
  it('turns distance into half-hours', () => {
    expect(estimateFlightHours(2475)).toBe(5.5);
    expect(estimateFlightHours(100)).toBe(1);
    expect(estimateFlightHours(5000)).toBe(10.5);
  });
});
