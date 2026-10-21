import { describe, expect, it } from 'vitest';
import { liveMatch } from '@/lib/onboarding/live-factors';
import type { MatchSetups } from '@/lib/onboarding/live-types';
import { ASKS_NOTHING } from '@/lib/scoring/matchTable';

const setups: MatchSetups = {
  diving: {
    content: {
      chips: [{ key: 'wrecks', label: 'Wrecks', live: true }, { key: 'reefs', label: 'Reefs', live: true }],
      questions: [{ key: 'q1', kind: 'limit', whenChips: [], missMessage: 'Water too cold' }],
    },
    questions: [{ key: 'q1', text: 'Cold?', options: ['Warm only', 'Any'], maxPicks: 1, kind: 'limit', whenChips: [], order: 0 }],
  },
};
const fits = {
  diving: {
    cozumel: { chips: { wrecks: 9, reefs: 9 }, answers: { q1: [1, ASKS_NOTHING] } },
    iceland: { chips: { wrecks: 0, reefs: 2 }, answers: { q1: [0, ASKS_NOTHING] } },
  },
};

describe('liveMatch', () => {
  it('changes nothing until the traveler ticks a chip or answers', () => {
    const m = liveMatch({ interests: ['diving'], setups, fits, ticked: {}, qa: {} });
    expect(m.factors).toEqual({});
    expect(m.notes).toEqual({});
  });
  it('lowers only the places that miss, with the reason', () => {
    const m = liveMatch({ interests: ['diving'], setups, fits, ticked: {}, qa: { diving: { q1: [0] } } });
    expect(m.factors.cozumel).toBeUndefined();
    expect(m.factors.iceland.diving).toBeLessThan(1);
    expect(m.notes.iceland.diving.reasons[0].message).toBe('Water too cold');
  });
  it('notes a full chip match without lowering anything', () => {
    const m = liveMatch({ interests: ['diving'], setups, fits, ticked: { diving: ['wrecks'] }, qa: {} });
    expect(m.factors.cozumel).toBeUndefined();
    expect(m.notes.cozumel.diving.matches).toEqual(['Wrecks']);
    expect(m.factors.iceland.diving).toBeLessThan(1);
  });
  it('skips interests the traveler does not have, or that have no setup', () => {
    expect(liveMatch({ interests: ['hiking'], setups, fits, ticked: { hiking: ['x'] }, qa: {} }).factors).toEqual({});
  });
  it('never goes below the floor, and the answer to "asks for nothing" skips the question', () => {
    const m = liveMatch({ interests: ['diving'], setups, fits, ticked: { diving: ['wrecks'] }, qa: { diving: { q1: [1] } } });
    expect(m.factors.iceland.diving).toBeGreaterThanOrEqual(0.3);
  });
});
