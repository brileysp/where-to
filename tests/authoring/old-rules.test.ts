import { describe, it, expect } from 'vitest';
import { oldRuleHits } from '@/lib/authoring/old-rules';

const cell = (overview: string, score: number) => ({ overview, blurbs: [{ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], text: 'A steady, good place to visit all year.' }], monthly_scores: new Array(12).fill(score) });

describe('old pipeline rules brought into the scanner', () => {
  it('flags self-rating words, but not "premier"', () => {
    expect(oldRuleHits(cell('A world-class destination with many sights to see and enjoy at any time of the year, which is why it stays popular.', 6.3), 'scenicLandscapes', 'somewhere').map((h) => h.id)).toContain('selfRating');
    expect(oldRuleHits(cell('A premier destination with many sights to see and enjoy at any time of the year, which is why it stays popular.', 6.3), 'scenicLandscapes', 'somewhere').map((h) => h.id)).not.toContain('selfRating');
  });
  it('blocks a 10 for a place that is not on the anchor list', () => {
    const hits = oldRuleHits(cell('Quiet overview text about a place that people visit for the views and the paths.', 10), 'scenicLandscapes', 'definitely-not-an-anchor');
    expect(hits.find((h) => h.id === 'tenOffAnchor')?.blocks).toBe(true);
  });
  it('is quiet for an ordinary cell', () => {
    expect(oldRuleHits(cell('Quiet overview text about a place that people visit for the views and the paths.', 6.3), 'scenicLandscapes', 'somewhere').filter((h) => h.blocks)).toEqual([]);
  });
});
