import { describe, it, expect } from 'vitest';
import { convertMetersToFeet, hasMeters, metersToFeet } from '../../src/lib/text/length';

describe('convertMetersToFeet', () => {
  it('gives the standard dive limits the way divers say them', () => {
    expect(convertMetersToFeet('depths up to 18 m')).toBe('depths up to 60 ft');
    expect(convertMetersToFeet('Advanced divers, down to 30 m')).toBe('Advanced divers, down to 100 ft');
    expect(convertMetersToFeet('deep sites (down to 40 m)')).toBe('deep sites (down to 130 ft)');
  });
  it('converts ranges, spelled-out units and visibility', () => {
    expect(convertMetersToFeet('shallow sites (0-10 m)')).toBe('shallow sites (0-35 ft)');
    expect(convertMetersToFeet('depths of 5-20 meters')).toBe('depths of 15-65 ft');
    expect(convertMetersToFeet('visibility of 20 m or more')).toBe('visibility of 65 ft or more');
    expect(convertMetersToFeet('wrecks in about 4 to 32 m of water')).toBe('wrecks in about 15 to 105 ft of water');
    expect(convertMetersToFeet('typically 6-10 metres')).toBe('typically 20-35 ft');
    expect(convertMetersToFeet('a 3 m swell')).toBe('a 10 ft swell');
  });
  it('handles altitude with thousands separators', () => {
    expect(convertMetersToFeet('every dive is at about 1,560 m')).toBe('every dive is at about 5,120 ft');
  });
  it('leaves mm, km, minutes, months and other words alone', () => {
    const t = 'a 7 mm semi-dry suit, 70 km away, 10 minutes by boat, 6 months, 5mm gloves, 3,000-year-old forest';
    expect(convertMetersToFeet(t)).toBe(t);
  });
  it('is idempotent and rounds sensibly', () => {
    const once = convertMetersToFeet('from 5-30 m');
    expect(convertMetersToFeet(once)).toBe(once);
    expect(metersToFeet(0.5)).toBe(2);
    expect(hasMeters('visibility 30 m')).toBe(true);
    expect(hasMeters('visibility 100 ft')).toBe(false);
  });
});
