import { describe, it, expect } from 'vitest';
import { scoringChecks, withinCaps, lengthCaps, computeCompleteness, type PlaceInput, type InterestInput } from '@/lib/admin/interest-pages/completeness';

const BLURBS = Array.from({ length: 12 }, (_, i) => `Month ${i} text.`);

describe('scoringChecks', () => {
  it('fails granularity when more than 4 of 12 scores are whole or half numbers', () => {
    expect(scoringChecks([5, 5.5, 6, 6.5, 7, 7.5, 7, 6.5, 6, 5.5, 5, 4.5], BLURBS, []).granularity).toBe(false);
    expect(scoringChecks([5.1, 5.6, 6.2, 6.7, 7.3, 7.4, 6.9, 6.4, 5.8, 5.3, 4.9, 4.7], BLURBS, []).granularity).toBe(true);
  });
  it('allows a flat run at the ceiling or floor but not in mid-range', () => {
    const ceiling = [3.1, 3.4, 6.2, 8.4, 8.5, 8.6, 8.5, 6.1, 3.3, 2.9, 2.7, 2.8];
    expect(scoringChecks(ceiling, BLURBS, []).flat).toBe(true);
    const mid = [2.1, 3.0, 5.4, 5.5, 5.6, 5.5, 8.4, 9.2, 8.1, 4.3, 3.2, 2.4];
    expect(scoringChecks(mid, BLURBS, []).flat).toBe(false);
    const shared = BLURBS.map((_, i) => (i >= 2 && i <= 5 ? 'Same text all four months.' : `Month ${i} text.`));
    expect(scoringChecks(mid, shared, []).flat).toBe(true);
  });
  it('needs a cause for a jump of 1.5 or more, from a blurb or an event', () => {
    const jumpy = [2.1, 2.3, 2.6, 5.2, 5.7, 6.1, 6.4, 5.9, 5.3, 4.1, 3.2, 2.5];
    expect(scoringChecks(jumpy, BLURBS, []).jumps).toBe(false);
    const withCause = BLURBS.map((b, i) => (i === 3 ? 'Whale season begins and boats resume.' : b));
    expect(scoringChecks(jumpy, withCause, []).jumps).toBe(true);
    expect(scoringChecks(jumpy, BLURBS, [{ label: 'Calving', months: { '3': 1 } }]).jumps).toBe(true);
  });
});

describe('length caps', () => {
  it('follows the peak-score table', () => {
    expect(lengthCaps(3.9)).toEqual({ overview: 280, monthly: 180 });
    expect(lengthCaps(8.6)).toEqual({ overview: 550, monthly: 326 });
    const monthly = [1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 6, 2];
    expect(withinCaps('x'.repeat(500), BLURBS, monthly)).toBe(true);
    expect(withinCaps('x'.repeat(600), BLURBS, monthly)).toBe(false);
    expect(withinCaps('', BLURBS, monthly)).toBe(false);
  });
});

function place(over: Partial<PlaceInput> = {}): PlaceInput {
  return { id: 'p', na: false, overview: 'An overview.', blurbs: BLURBS, authored: true, monthly: [5.1, 5.6, 6.2, 6.7, 7.3, 7.4, 6.9, 6.4, 5.8, 5.3, 4.9, 4.7], events: [], staged: false, facts: {}, placeReviewed: false, ...over };
}
function input(over: Partial<InterestInput> = {}): InterestInput {
  return { places: [place({ id: 'a' }), place({ id: 'b' })], factDefs: [], hasDefinition: true, hasTen: true, hasDirective: true, hasRulesTab: true, ideasCount: 1, wideReviewed: false, ...over };
}

describe('computeCompleteness', () => {
  it('scores a fully done interest with no columns on the other four parts, with verification as the gap', () => {
    const c = computeCompleteness(input());
    expect(c.parts.data).toBeNull();
    expect(c.parts.verify).toBe(0);
    expect(c.score).toBe(Math.round((50 * 100 + 10 * 100 + 10 * 0 + 10 * 100) / 80));
    expect(c.gains[0].label).toMatch(/Source-check 2 places/);
  });
  it('ignores N/A places entirely and gives half credit for a whole-interest review', () => {
    const c = computeCompleteness(input({ places: [place({ id: 'a' }), place({ id: 'n', na: true, overview: '' })], wideReviewed: true }));
    expect(c.parts.content).toBe(100);
    expect(c.parts.verify).toBe(50);
  });
  it('counts only filled non-checkbox data cells', () => {
    const defs = [{ key: 'n', label: 'N', type: 'int', group: 'data' }, { key: 'ok', label: 'OK', type: 'bool', group: 'draw' }] as InterestInput['factDefs'];
    const c = computeCompleteness(input({ factDefs: defs, places: [place({ id: 'a', facts: { n: 3 } }), place({ id: 'b', facts: {} })] }));
    expect(c.parts.data).toBe(50);
    expect(c.gains.some((g) => /empty cell/.test(g.label))).toBe(true);
  });
  it('does not count blank animal lists against a place, but asks for at least one animal', () => {
    const defs = [
      ...['predators', 'herbivores', 'primates'].map((key) => ({ key, label: key, type: 'text', group: 'species', animals: true })),
      { key: 'density', label: 'Density', type: 'rating', group: 'experience' },
    ] as InterestInput['factDefs'];
    const c = computeCompleteness(input({ factDefs: defs, places: [place({ id: 'a', facts: { predators: 'Lion (likely)', density: 7 } }), place({ id: 'b', facts: { herbivores: 'Elk (likely)', density: 5 } })] }));
    expect(c.parts.data).toBe(100);
    const c2 = computeCompleteness(input({ factDefs: defs, places: [place({ id: 'a', facts: { predators: 'Lion (likely)', density: 7 } }), place({ id: 'b', facts: {} })] }));
    // place b: no animal and no density = 0 of 2 cells; place a: 2 of 2
    expect(c2.parts.data).toBe(50);
  });
  it('gives an interest with no text a low score and lists what to do', () => {
    const empty = place({ overview: '', blurbs: null, authored: false, monthly: [] });
    const c = computeCompleteness(input({ places: [empty, { ...empty, id: 'b' }], hasDefinition: false, hasTen: false, hasDirective: false, hasRulesTab: false, ideasCount: 0 }));
    expect(c.score).toBeLessThan(25);
    expect(c.parts.content).toBe(0);
    expect(c.parts.scoring).toBe(0);
    expect(c.gains[0].points).toBeGreaterThan(0.5);
    expect(c.gains).toHaveLength(3);
  });
});
