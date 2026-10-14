import { describe, expect, it } from 'vitest';
import { imperialToDisplay, metricToImperial, unitsForCountry } from '@/lib/text/units';

describe('metric to imperial (the stored form)', () => {
  const cases: Array<[string, string]> = [
    ['about 75km from Hobart', 'about 47 miles from Hobart'],
    ['the dolerite Totem Pole (65m), Candlestick', 'the dolerite Totem Pole (215 ft), Candlestick'],
    ['climbing peaks above 6,000m has been prohibited', 'climbing peaks above 19,690 ft has been prohibited'],
    ['Gangkhar Puensum (7,570m) remains', 'Gangkhar Puensum (24,840 ft) remains'],
    ['the 400m quartzite wall of Frenchmans', 'the 1,310-foot quartzite wall of Frenchmans'],
    ["Paklenica's 350m Anića Kuk wall, about an hour", "Paklenica's 1,150-foot Anića Kuk wall, about an hour"],
    ['sport crags at Omiš, 20–25km from Split', 'sport crags at Omiš, 12-16 miles from Split'],
    ['wind can exceed 100 km/h.', 'wind can exceed 60 mph.'],
    ['the high 8,000m peaks are still early', 'the high 26,250-foot peaks are still early'],
    ['about 200km north. Frankenjura', 'about 125 miles north. Frankenjura'],
    ['Zambia\'s largest park at 22,400 km² — one', 'Zambia\'s largest park at 8,650 sq mi — one'],
    ['A 40km Lake Erie sand spit', 'A 25-mile Lake Erie sand spit'],
    ['a 12km scrambling traverse', 'a 7.5-mile scrambling traverse'],
    ['rides over 200 meters on a good day', 'rides over 655 ft on a good day'],
    ['Tanzania below 1,800 m, Ethiopia', 'Tanzania below 5,910 ft, Ethiopia'],
    ['Peak summer heat regularly tops 40°C (104°F) in Seville', 'Peak summer heat regularly tops 104°F in Seville'],
  ];
  for (const [from, to] of cases) it(from, () => expect(metricToImperial(from)).toBe(to));
  it('leaves wetsuit millimeters, words and plain text alone', () => {
    for (const t of ['a 7 mm semi-dry suit', 'the 4/3 mm wetsuit', 'a 5mm hood', 'Mont Blanc is a mountain', 'about 3 hours by boat', '1.5M birds', 'room 5m2']) expect(metricToImperial(t)).toBe(t);
  });
});

describe('display units by home country', () => {
  const us = unitsForCountry('US');
  const fr = unitsForCountry('FR');
  const gb = unitsForCountry('GB');
  it('picks units', () => {
    expect(us).toEqual({ temp: 'F', distance: 'mi', length: 'ft' });
    expect(fr).toEqual({ temp: 'C', distance: 'km', length: 'm' });
    expect(gb).toEqual({ temp: 'C', distance: 'mi', length: 'm' });
    expect(unitsForCountry('BS').temp).toBe('F');
    expect(unitsForCountry(null)).toEqual(us);
  });
  it('leaves US text untouched for a US visitor', () => {
    const t = 'Water is 72°F, waves 4-6 ft, 5 miles north.';
    expect(imperialToDisplay(t, us)).toBe(t);
  });
  it('converts for a metric visitor', () => {
    expect(imperialToDisplay('Water is 72°F, waves 4-6 ft, 5 miles north.', fr)).toBe('Water is 22°C, waves 1.2-1.8 m, 8 km north.');
    expect(imperialToDisplay('48-57°F and 28 to 36°F', fr)).toBe('9-14°C and -2 to 2°C');
    expect(imperialToDisplay('dives to 100 ft, 15-65 ft visibility', fr)).toBe('dives to 30 m, 5-20 m visibility');
    expect(imperialToDisplay('a 1,310-foot wall, a 25-mile spit, winds of 60 mph', fr)).toBe('a 400-metre wall, a 40-kilometre spit, winds of 95 km/h');
    expect(imperialToDisplay('peaks above 19,690 ft', fr)).toBe('peaks above 6,000 m');
  });
  it('the UK gets Celsius and metres but keeps miles', () => {
    expect(imperialToDisplay('72°F, 100 ft deep, 5 miles away', gb)).toBe('22°C, 30 m deep, 5 miles away');
  });
  it('does not touch wetsuit millimeters or other words', () => {
    expect(imperialToDisplay('a 4/3 mm wetsuit in 58°F water, 3 hours by boat, 5 soft drinks', fr)).toBe('a 4/3 mm wetsuit in 14°C water, 3 hours by boat, 5 soft drinks');
  });
});

import { isCountryCode, regionFromAcceptLanguage } from '@/lib/units/countries';
describe('guessing the home country', () => {
  it('reads the region from Accept-Language', () => {
    expect(regionFromAcceptLanguage('en-GB,en;q=0.9')).toBe('GB');
    expect(regionFromAcceptLanguage('fr-CA,fr;q=0.8,en-US;q=0.5')).toBe('CA');
    expect(regionFromAcceptLanguage('en')).toBeNull();
    expect(regionFromAcceptLanguage('zh-Hant-TW')).toBe('TW');
    expect(regionFromAcceptLanguage(null)).toBeNull();
  });
  it('knows real country codes only', () => {
    expect(isCountryCode('US')).toBe(true);
    expect(isCountryCode('XX')).toBe(false);
    expect(isCountryCode('us')).toBe(false);
  });
});
