import { describe, it, expect } from 'vitest';
import { convertTemperaturesToF, hasCelsius, cToF } from '../../src/lib/text/temperature';

describe('convertTemperaturesToF', () => {
  it('converts single values and ranges in every spelling used in the blurbs', () => {
    expect(convertTemperaturesToF('Water is about 22°C.')).toBe('Water is about 72°F.');
    expect(convertTemperaturesToF('around 13 C, requiring a drysuit')).toBe('around 55°F, requiring a drysuit');
    expect(convertTemperaturesToF('between 22 and 29 degrees Celsius')).toBe('between 72 and 84°F');
    expect(convertTemperaturesToF('(water is 10 to 17 degrees celsius)')).toBe('(water is 50 to 63°F)');
    expect(convertTemperaturesToF('warm 27-30°C water')).toBe('warm 81-86°F water');
    expect(convertTemperaturesToF('the -2 to 2°C water')).toBe('the 28 to 36°F water');
    expect(convertTemperaturesToF('(8-16 C) kelp')).toBe('(46-61°F) kelp');
    expect(convertTemperaturesToF('regularly 40°C+')).toBe('regularly 104°F+');
    expect(convertTemperaturesToF('35°C-plus heat')).toBe('95°F-plus heat');
  });
  it('collapses a figure that already has the other unit in brackets', () => {
    expect(convertTemperaturesToF('exceeds 40°C (104°F), severely')).toBe('exceeds 104°F, severely');
    expect(convertTemperaturesToF('about 38°F (3°C) water')).toBe('about 38°F water');
  });
  it('leaves Fahrenheit, plain numbers and other letters alone', () => {
    const t = 'Water is a steady 72°F with a 3,000-year-old forest at 30 m, 2 C-class wrecks and vitamin C.';
    expect(convertTemperaturesToF(t)).toBe(t.replace('2 C-class', '2 C-class'));
    expect(hasCelsius('Water is 72°F')).toBe(false);
    expect(hasCelsius('Water is 22°C')).toBe(true);
  });
  it('does not touch climbing grades', () => {
    const t = 'from beginner-friendly lines to 8c+ projects and Font 8C+ boulders, 6c routes';
    expect(convertTemperaturesToF(t)).toBe(t);
  });
  it('is idempotent', () => {
    const once = convertTemperaturesToF('from 12°C in winter to 20°C in summer');
    expect(convertTemperaturesToF(once)).toBe(once);
    expect(cToF(0)).toBe(32);
  });
});
