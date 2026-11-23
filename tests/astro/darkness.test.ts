import { describe, expect, it } from 'vitest';
import { darkHoursByMonth } from '../../src/lib/astro/darkness';

describe('darkHoursByMonth', () => {
  it('has no true night in midsummer north of about 48.5 degrees', () => {
    const scotland = darkHoursByMonth(57);
    expect(scotland[4]).toBe(0); expect(scotland[5]).toBe(0); expect(scotland[6]).toBe(0); expect(scotland[11]).toBeGreaterThan(11);
  });
  it('Paris has no true night in June and about 12 dark hours in December', () => {
    const paris = darkHoursByMonth(48.85);
    expect(paris[5]).toBe(0); expect(paris[11]).toBeGreaterThan(11.5);
  });
  it('the tropics barely change through the year', () => {
    const bali = darkHoursByMonth(-8.5);
    expect(Math.max(...bali) - Math.min(...bali)).toBeLessThan(2);
    expect(bali.every((h) => h > 8 && h < 11.5)).toBe(true);
  });
  it('Svalbard has about 15 dark hours in December and none from March to September', () => {
    const sv = darkHoursByMonth(78);
    expect(sv[11]).toBeGreaterThan(14); expect(sv[2]).toBe(0); expect(sv[5]).toBe(0);
  });
  it('is mirrored in the southern hemisphere', () => {
    const north = darkHoursByMonth(51); const south = darkHoursByMonth(-51);
    for (let m = 0; m < 12; m++) expect(Math.abs(north[m] - south[(m + 6) % 12])).toBeLessThan(0.6);
  });
});

import { lowestSunAltitudeByMonth } from '@/lib/astro/darkness';
describe('lowest point of the sun at night (owner, 15 Nov 2026: no stars is not the same as a few stars)', () => {
  it('Finnish Lapland has no stars in June, a few in April and August, and a fully dark sky in September', () => {
    const a = lowestSunAltitudeByMonth(66.5);
    expect(a[5]).toBeGreaterThan(-3);   // June: the sun is at or near the horizon at midnight
    expect(a[4]).toBeGreaterThan(-6);   // May: civil twilight all night, no stars
    expect(a[3]).toBeLessThan(-12);     // mid-April: most stars show
    expect(a[7]).toBeLessThan(-6);      // mid-August: a few of the brightest
    expect(a[8]).toBeLessThan(-18);     // mid-September: fully dark again
  });
  it('is symmetric for the southern hemisphere and always deep at the tropics', () => {
    expect(lowestSunAltitudeByMonth(-66.5)[11]).toBeGreaterThan(-3);
    expect(Math.max(...lowestSunAltitudeByMonth(0))).toBeLessThan(-60);
  });
});
