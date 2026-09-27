import { describe, expect, it } from 'vitest';
import { destinationSchema } from '../../scripts/content/destination-schema';
import { SLIDERS } from '@/lib/scoring/constants';

// 'deals'/'crowds' are computed sliders with no authored base value (see
// the REQUIRED_BASE_KEYS comment in destination-schema.ts) — every other
// slider key is required.
function makeValidBase(): Record<string, number> {
  const base: Record<string, number> = {};
  SLIDERS.forEach((s) => {
    if (s.formula !== 'deals' && s.formula !== 'crowds') base[s.key] = 5;
  });
  return base;
}

function makeValid(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-place',
    name: 'Test Place',
    region: 'Testland',
    emoji: '🧪',
    climate: 'temperate',
    about: 'A test destination.',
    base: makeValidBase(),
    dry: [1, 2, 3],
    wet: [7, 8],
    ...overrides,
  };
}

describe('destinationSchema', () => {
  it('accepts a minimal valid destination', () => {
    const result = destinationSchema.safeParse(makeValid());
    expect(result.success).toBe(true);
  });

  it('does not require base values for the computed deals/crowds sliders', () => {
    const base = makeValidBase();
    expect(base.deals).toBeUndefined();
    expect(base.crowds).toBeUndefined();
    const result = destinationSchema.safeParse(makeValid({ base }));
    expect(result.success).toBe(true);
  });

  it('rejects a destination missing a required base slider key', () => {
    const base = makeValidBase();
    delete base.wineSpirits;
    const result = destinationSchema.safeParse(makeValid({ base }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('wineSpirits'))).toBe(true);
    }
  });

  it('rejects an unknown key inside base (catches typos)', () => {
    const base = makeValidBase();
    base.wildlif = 5; // typo for 'wildlife'
    const result = destinationSchema.safeParse(makeValid({ base }));
    expect(result.success).toBe(false);
  });

  // Regression test for a real past bug: shopClosures is a boolean flag
  // combined with low_months at read time, not a month array.
  it('rejects shopClosures as an array', () => {
    const result = destinationSchema.safeParse(makeValid({ shopClosures: [4, 5] }));
    expect(result.success).toBe(false);
  });

  it('accepts shopClosures as a boolean', () => {
    const result = destinationSchema.safeParse(makeValid({ shopClosures: true }));
    expect(result.success).toBe(true);
  });

  it('rejects a typo\'d slider key in sliderCaps', () => {
    const result = destinationSchema.safeParse(makeValid({ sliderCaps: { wildlif: 4 } }));
    expect(result.success).toBe(false);
  });

  it('accepts a real slider key in sliderCaps', () => {
    const result = destinationSchema.safeParse(makeValid({ sliderCaps: { wildlifeViewing: 4 } }));
    expect(result.success).toBe(true);
  });

  it('rejects an unknown slider key in sliderEvents', () => {
    const result = destinationSchema.safeParse(
      makeValid({ sliderEvents: { hikingg: [{ label: 'x', weight: 3, months: { '6': 1 } }] } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a sliderEvents month key outside 1-12', () => {
    const result = destinationSchema.safeParse(
      makeValid({ sliderEvents: { hiking: [{ label: 'x', weight: 3, months: { '13': 1 } }] } }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts a well-formed sliderEvents entry', () => {
    const result = destinationSchema.safeParse(
      makeValid({ sliderEvents: { hiking: [{ label: 'Peak trail season', weight: 3, months: { '6': 0.5, '7': 1 } }] } }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects an invalid climate value', () => {
    const result = destinationSchema.safeParse(makeValid({ climate: 'sunny' }));
    expect(result.success).toBe(false);
  });

  it('rejects a month number outside 1-12', () => {
    const result = destinationSchema.safeParse(makeValid({ dry: [1, 13] }));
    expect(result.success).toBe(false);
  });

  it('rejects an invalid budget band key', () => {
    const result = destinationSchema.safeParse(makeValid({ budgetBands: ['cheap'] }));
    expect(result.success).toBe(false);
  });

  it('accepts real budget band keys', () => {
    const result = destinationSchema.safeParse(makeValid({ budgetBands: ['basic', 'comfortable'] }));
    expect(result.success).toBe(true);
  });

  it('rejects monthlyWeather with fewer than 12 entries', () => {
    const result = destinationSchema.safeParse(makeValid({ monthlyWeather: ['warm', 'warm'] }));
    expect(result.success).toBe(false);
  });

  it('accepts monthlyWeather with exactly 12 entries', () => {
    const result = destinationSchema.safeParse(makeValid({ monthlyWeather: new Array(12).fill('warm') }));
    expect(result.success).toBe(true);
  });

  it('rejects an unrecognized top-level field', () => {
    const result = destinationSchema.safeParse(makeValid({ extraField: 'nope' }));
    expect(result.success).toBe(false);
  });

  it('rejects an id that is not lowercase-kebab-case', () => {
    const result = destinationSchema.safeParse(makeValid({ id: 'Test_Place!' }));
    expect(result.success).toBe(false);
  });

  it('rejects an activityStyleTiers entry keyed by an unknown slider', () => {
    const result = destinationSchema.safeParse(
      makeValid({ activityStyleTiers: { notASlider: { mountains: 'signature' } } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an activityStyleTiers tier value outside the enum', () => {
    const result = destinationSchema.safeParse(
      makeValid({ activityStyleTiers: { scenicLandscapes: { mountains: 'amazing' } } }),
    );
    expect(result.success).toBe(false);
  });
});
