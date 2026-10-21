import { describe, expect, it } from 'vitest';
import { onboardingV2Allowed, onboardingV2On } from '@/lib/features';

describe('feature switches', () => {
  it('is off when nothing is set', () => {
    expect(onboardingV2On(undefined)).toBe(false);
    expect(onboardingV2On({})).toBe(false);
    expect(onboardingV2Allowed({}, undefined)).toBe(false);
  });
  it('is on only for the value 1', () => {
    expect(onboardingV2On({ onboardingV2: 1 })).toBe(true);
    expect(onboardingV2On({ onboardingV2: 0 })).toBe(false);
    expect(onboardingV2On({ onboardingV2: 2 })).toBe(false);
  });
  it('lets everyone in when on, whatever the address says', () => {
    expect(onboardingV2Allowed({ onboardingV2: 1 }, undefined)).toBe(true);
  });
  it('lets only the right preview code in while off', () => {
    const v = { onboardingV2: 0, previewCode: 482913 };
    expect(onboardingV2Allowed(v, '482913')).toBe(true);
    expect(onboardingV2Allowed(v, '482914')).toBe(false);
    expect(onboardingV2Allowed(v, undefined)).toBe(false);
    expect(onboardingV2Allowed(v, ['482913'])).toBe(false);
  });
  it('ignores a missing or too-short preview code', () => {
    expect(onboardingV2Allowed({}, '0')).toBe(false);
    expect(onboardingV2Allowed({ previewCode: 5 }, '5')).toBe(false);
  });
});
