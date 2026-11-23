import { afterEach, describe, expect, it } from 'vitest';
import { activeInterestsWith } from '@/lib/scoring/active-interests';
import { EMPTY_OVERRIDES } from '@/lib/scoring/overrides';

const keys = (o = EMPTY_OVERRIDES) => activeInterestsWith(o).map((i) => i.key);

describe('active interests', () => {
  afterEach(() => { activeInterestsWith(EMPTY_OVERRIDES); });
  it('leaves out every interest flagged hidden in the code, with no list of names kept here', () => {
    const k = keys();
    for (const retired of ['landscapePhotography', 'nationalParks', 'familyFun', 'deals', 'crowds', 'roadtrip']) expect(k).not.toContain(retired);
    expect(k).toContain('hiking');
  });
  it('follows the admin: hiding one more interest removes it, unhiding a retired one brings it back', () => {
    expect(keys({ interests: { museumsArt: { hidden: true } }, personas: {} })).not.toContain('museumsArt');
    expect(keys({ interests: { deals: { hidden: false } }, personas: {} })).toContain('deals');
  });
});
