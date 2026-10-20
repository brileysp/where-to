import { describe, it, expect } from 'vitest';
import { backTarget, buildPath, canContinueFromDoor, chooseDoor, emptyDoors, nextScreen, progressPercent } from '@/lib/onboarding/path';

const doors = (over: Partial<ReturnType<typeof emptyDoors>>) => ({ ...emptyDoors(), ...over });

describe('first screen choices', () => {
  it('keeps each pair exclusive', () => {
    let d = emptyDoors();
    d = chooseDoor(d, 'love');
    expect(d).toEqual(doors({ love: true }));
    d = chooseDoor(d, 'open');
    expect(d).toEqual(doors({ open: true }));
    d = chooseDoor(d, 'window');
    d = chooseDoor(d, 'flex');
    expect(d).toEqual(doors({ open: true, flex: true }));
    expect(chooseDoor(d, 'flex')).toEqual(d);
  });
  it('needs both questions answered before Continue', () => {
    expect(canContinueFromDoor(emptyDoors())).toBe(false);
    expect(canContinueFromDoor(doors({ love: true }))).toBe(false);
    expect(canContinueFromDoor(doors({ flex: true }))).toBe(false);
    expect(canContinueFromDoor(doors({ love: true, flex: true }))).toBe(true);
    expect(canContinueFromDoor(doors({ open: true, window: true }))).toBe(true);
  });
});

describe('the screens a person sees', () => {
  it('interests lead: with something I love to do, interests and top interests come before any timing screen', () => {
    expect(buildPath('trip', doors({ love: true, flex: true }))).toEqual(['door', 'love', 'rank', 'when', 'essentials']);
    expect(buildPath('trip', doors({ love: true, window: true }))).toEqual(['door', 'love', 'rank', 'when', 'logistics', 'essentials']);
  });
  it('the month picker comes first only for a great trip with a specific window', () => {
    expect(buildPath('trip', doors({ open: true, window: true }))).toEqual(['door', 'when', 'logistics', 'essentials', 'vibes']);
  });
  it('a great trip with flexible timing asks the basics and photo picks first, the month last', () => {
    expect(buildPath('trip', doors({ open: true, flex: true }))).toEqual(['door', 'essentials', 'vibes', 'when']);
  });
  it('the Travel DNA path has no trip screens', () => {
    expect(buildPath('dna', emptyDoors())).toEqual(['love', 'rank', 'dnabasics', 'cards', 'dnasum']);
    expect(buildPath('dna', doors({ window: true, love: true }))).toEqual(['love', 'rank', 'dnabasics', 'cards', 'dnasum']);
  });
});

describe('moving through the path', () => {
  const d = doors({ love: true, window: true });
  it('Continue goes to the next screen and, from the last, to the shortlist', () => {
    expect(nextScreen('trip', d, 'door')).toBe('love');
    expect(nextScreen('trip', d, 'rank')).toBe('when');
    expect(nextScreen('trip', d, 'when')).toBe('logistics');
    expect(nextScreen('trip', d, 'essentials')).toBe('results');
  });
  it('the Travel DNA path ends on its last screen', () => {
    expect(nextScreen('dna', d, 'love')).toBe('rank');
    expect(nextScreen('dna', d, 'dnasum')).toBeNull();
  });
  it('Back goes to the previous screen; from the first Travel DNA screen it starts over', () => {
    expect(backTarget('trip', d, 'logistics')).toEqual({ kind: 'screen', screen: 'when' });
    expect(backTarget('trip', d, 'when')).toEqual({ kind: 'screen', screen: 'rank' });
    expect(backTarget('trip', d, 'door')).toEqual({ kind: 'none' });
    expect(backTarget('dna', d, 'love')).toEqual({ kind: 'restart' });
    expect(backTarget('dna', d, 'cards')).toEqual({ kind: 'screen', screen: 'dnabasics' });
  });
  it("the first screen shows a fixed quarter; later screens show their place in the person's own path", () => {
    expect(progressPercent('trip', emptyDoors(), 'door')).toBe(25);
    const flex = doors({ open: true, flex: true });
    expect(progressPercent('trip', flex, 'essentials')).toBe(50);
    expect(progressPercent('trip', flex, 'when')).toBe(100);
    expect(progressPercent('dna', emptyDoors(), 'love')).toBe(20);
  });
});

import { answerMessage, isShortlistLocked, questionsToUnlock } from '@/lib/onboarding/lock';

describe('the shortlist teaser lock', () => {
  it('is locked until ten answers, unless nothing is left to ask or the traveler is returning', () => {
    expect(isShortlistLocked({ answered: 0, hasQuestion: true, returning: false })).toBe(true);
    expect(isShortlistLocked({ answered: 9, hasQuestion: true, returning: false })).toBe(true);
    expect(isShortlistLocked({ answered: 10, hasQuestion: true, returning: false })).toBe(false);
    expect(isShortlistLocked({ answered: 1, hasQuestion: false, returning: false })).toBe(false);
    expect(isShortlistLocked({ answered: 0, hasQuestion: true, returning: true })).toBe(false);
    expect(questionsToUnlock(2)).toBe(8);
    expect(questionsToUnlock(12)).toBe(0);
  });
  it('names no place while locked, and says when the list opens', () => {
    expect(answerMessage({ answered: 2, locked: true, mover: { name: 'Maui', by: 2 } })).toBe('Saved. 8 more to unlock your list');
    expect(answerMessage({ answered: 10, locked: false, mover: { name: 'Maui', by: 2 } })).toBe('Your full list is unlocked');
    expect(answerMessage({ answered: 12, locked: false, mover: { name: 'Maui', by: 2 } })).toBe('Maui moved up 2');
    expect(answerMessage({ answered: 12, locked: false, mover: { name: 'Maui', by: -1 } })).toBe('Maui moved down 1');
    expect(answerMessage({ answered: 12, locked: false, mover: null })).toBe('Saved. The order held.');
  });
});
