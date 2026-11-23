import { describe, expect, it } from 'vitest';
import { askedThisRound, factorStatus, reviewGateMessage, roundProgress, summarize, cadenceDays, type StaleCheckRow } from '@/lib/admin/stale-checks';
import { CADENCE_TODO_SOURCE } from '@/lib/scoring/planning';

const now = new Date('2026-11-13T12:00:00Z');
const daysAgo = (n: number): StaleCheckRow => ({ result: 'checked', note: '', checkedBy: 'x', checkedAt: new Date(now.getTime() - n * 86_400_000).toISOString(), todoId: null });

describe('staleness checklist rules', () => {
  it('a reason is current inside its interval and overdue after it', () => {
    // evergreen 3 = monthly (31 days), 6 = quarterly, 9 = annually
    expect(factorStatus({ last: daysAgo(10), checkEvery: null }, 3, now)).toBe('current');
    expect(factorStatus({ last: daysAgo(40), checkEvery: null }, 3, now)).toBe('overdue');
    expect(factorStatus({ last: daysAgo(40), checkEvery: null }, 6, now)).toBe('current');
    expect(factorStatus({ last: null, checkEvery: null }, 6, now)).toBe('never');
  });
  it('a reason\'s own schedule beats the interest\'s', () => {
    expect(factorStatus({ last: daysAgo(100), checkEvery: 'annually' }, 3, now)).toBe('current'); // yearly taxonomy update in a monthly interest
    expect(factorStatus({ last: daysAgo(40), checkEvery: 'monthly' }, 9, now)).toBe('overdue');
    expect(cadenceDays('weekly')).toBe(7);
  });
  it('counts only active reasons toward a round', () => {
    const base = { last: null, checkEvery: null };
    const p = roundProgress([{ ...base, active: true, thisRound: daysAgo(0) }, { ...base, active: true, thisRound: null }, { ...base, active: false, thisRound: null }], 6, now);
    expect(p).toEqual({ total: 2, done: 1, missing: 1 });
  });
  it('stops a review to-do being ticked done while reasons are unchecked, and only that kind of to-do', () => {
    expect(reviewGateMessage(CADENCE_TODO_SOURCE, { total: 6, done: 4, missing: 2 })).toMatch(/2 of 6 reasons/);
    expect(reviewGateMessage(CADENCE_TODO_SOURCE, { total: 6, done: 6, missing: 0 })).toBeNull();
    expect(reviewGateMessage(CADENCE_TODO_SOURCE, { total: 0, done: 0, missing: 0 })).toBeNull(); // no reasons written: nothing to ask
    expect(reviewGateMessage('Usage page, 14 Oct 2026', { total: 6, done: 0, missing: 6 })).toBeNull();
  });
  it('asks a site-wide reason only when it is due for that interest, never when opted out', () => {
    const site = { active: true, inherited: true, thisRound: null, checkEvery: 'annually' as const };
    expect(askedThisRound({ ...site, last: null }, 6, now)).toBe(true); // never checked for this interest
    expect(askedThisRound({ ...site, last: daysAgo(100) }, 6, now)).toBe(false); // checked inside its own yearly interval
    expect(askedThisRound({ ...site, last: daysAgo(400) }, 6, now)).toBe(true); // overdue
    expect(askedThisRound({ ...site, last: daysAgo(400), thisRound: daysAgo(0) }, 6, now)).toBe(true); // already answered this round: still counts as asked and done
    expect(askedThisRound({ ...site, last: null, optedOut: true }, 6, now)).toBe(false);
    expect(askedThisRound({ active: true, last: daysAgo(1), checkEvery: null, thisRound: null }, 6, now)).toBe(true); // the interest's own reasons are always asked
  });
  it('counts site-wide reasons in progress only when asked', () => {
    const site = { active: true, inherited: true, checkEvery: 'annually' as const, thisRound: null };
    const p = roundProgress([{ ...site, last: null }, { ...site, last: daysAgo(30) }, { ...site, last: null, optedOut: true }, { active: true, last: null, checkEvery: null, thisRound: daysAgo(0) }], 6, now);
    expect(p).toEqual({ total: 2, done: 1, missing: 1 });
  });
  it('summarizes for the grid', () => {
    const s = summarize([
      { active: true, howToCheck: 'x', checkEvery: null, last: daysAgo(5) },
      { active: true, howToCheck: '', checkEvery: null, last: daysAgo(400) },
      { active: true, howToCheck: '', checkEvery: null, last: null },
      { active: false, howToCheck: '', checkEvery: null, last: null },
    ], 6, now);
    expect(s).toEqual({ total: 3, current: 1, overdue: 1, never: 1, noHow: 2 });
  });
});
