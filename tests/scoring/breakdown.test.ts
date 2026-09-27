import { describe, expect, it } from 'vitest';
import { topInterestChips } from '@/lib/scoring/breakdown';

describe('topInterestChips', () => {
  it('lists the traveller’s interests highest weight first, whatever the slider order', () => {
    const keys = topInterestChips({ birding: 5, wildlifeViewing: 9, scenicLandscapes: 8, hiking: 6, campingBackcountry: 5 }).map((s) => s.key);
    expect(keys.slice(0, 3)).toEqual(['wildlifeViewing', 'scenicLandscapes', 'hiking']);
  });

  it('shows fewer chips for a single-minded profile and never more than six', () => {
    expect(topInterestChips({ wildlifeViewing: 10, hiking: 3 }).map((s) => s.key)).toEqual(['wildlifeViewing']);
    const broad = Object.fromEntries(['wildlifeViewing', 'birding', 'hiking', 'scenicLandscapes', 'campingBackcountry', 'stargazing', 'fishing'].map((k) => [k, 8]));
    expect(topInterestChips(broad).length).toBe(6);
  });

  it('never includes a hidden slider', () => {
    expect(topInterestChips({ nationalParks: 10, hiking: 9 }).map((s) => s.key)).not.toContain('nationalParks');
  });
});
