import { describe, expect, it } from 'vitest';
import { barPoints, barTotal, BAR_CAPS, deeperItems, dnaPercent, firstUnansweredGate, gateItems, gatePercent, newItems, qid, toUnlock, type BarInput } from '@/lib/onboarding/live-questions';
import type { MatchSetups, OnboardingQuestion } from '@/lib/onboarding/live-types';

const q = (key: string, whenChips: string[] = []): OnboardingQuestion => ({ key, text: `Question ${key}`, options: ['A', 'B', 'C'], maxPicks: 1, kind: 'lean', whenChips, order: 0 });
const setup = (questions: OnboardingQuestion[], chips: string[]): MatchSetups[string] => ({
  content: { chips: chips.map((key) => ({ key, label: key, live: true })), questions: questions.map((x) => ({ key: x.key, kind: x.kind, whenChips: x.whenChips, missMessage: '' })) },
  questions,
});
const setups: MatchSetups = {
  diving: setup([q('q1'), q('q2'), q('q3'), q('q4', ['wrecks']), q('q5')], ['wrecks', 'reefs']),
  safari: setup([q('q1'), q('q2'), q('q3', ['walking']), q('q4')], ['walking', 'migration']),
  hiking: setup([q('q1'), q('q2', ['huts'])], ['huts', 'easy']),
};

describe('gateItems', () => {
  it('takes each top interest its share of always-asked questions, in order', () => {
    // Two top interests share 4 each, so they can use every always-asked question they have.
    const g = gateItems(['diving', 'safari'], setups);
    expect(g.map((x) => qid(x.interest, x.q.key))).toEqual(['diving.q1', 'diving.q2', 'diving.q3', 'diving.q5', 'safari.q1', 'safari.q2', 'safari.q4']);
  });
  it('cuts to the share when there are more top interests (four: 3, 3, 2, 2)', () => {
    const g = gateItems(['diving', 'safari', 'hiking', 'birding'], setups);
    expect(g.filter((x) => x.interest === 'diving')).toHaveLength(3);
    expect(g.filter((x) => x.interest === 'safari')).toHaveLength(3);
    expect(g.filter((x) => x.interest === 'hiking')).toHaveLength(1); // hiking has one always-asked question
  });
  it('skips top interests with no questions and never hands their share to another', () => {
    const g = gateItems(['birding', 'diving'], setups);
    expect(g.every((x) => x.interest === 'diving')).toBe(true);
    expect(g).toHaveLength(4); // two interests: 4 each, diving has 4 always-asked
  });
  it('never includes a question a chip has to open', () => {
    expect(gateItems(['diving', 'safari', 'hiking'], setups).some((x) => x.q.whenChips.length > 0)).toBe(false);
  });
});

describe('firstUnansweredGate', () => {
  const gate = gateItems(['diving', 'safari'], setups);
  it('finds the first one not answered or skipped', () => {
    expect(firstUnansweredGate(gate, {}, {})).toBe(0);
    expect(firstUnansweredGate(gate, { diving: { q1: [0] } }, {})).toBe(1);
    expect(firstUnansweredGate(gate, { diving: { q1: [0] } }, { 'diving.q2': true })).toBe(2);
  });
  it('is the gate length when all are done', () => {
    const qa = { diving: { q1: [0], q2: [0], q3: [0], q5: [0] }, safari: { q1: [0], q2: [0], q4: [0] } };
    expect(firstUnansweredGate(gate, qa, {})).toBe(gate.length);
  });
});

describe('deeperItems', () => {
  const gate = gateItems(['diving', 'safari'], setups);
  it('is empty-ish before chips: only chip-opened questions need a ticked chip', () => {
    const none = deeperItems(['diving', 'safari', 'hiking'], setups, {}, {}, {}, gate);
    expect(none.filter((x) => !x.optional)).toHaveLength(0);
  });
  it('adds the questions a ticked chip opens, with the chip that opened them, before the optional ones', () => {
    const items = deeperItems(['diving', 'safari', 'hiking'], setups, { diving: ['wrecks'], hiking: ['huts'] }, {}, {}, gate);
    expect(items.slice(0, 2).map((x) => [qid(x.interest, x.q.key), x.because])).toEqual([['diving.q4', 'wrecks'], ['hiking.q2', 'huts']]);
    expect(items.slice(2).every((x) => x.optional)).toBe(true);
    expect(items.slice(2).map((x) => qid(x.interest, x.q.key))).toEqual(['hiking.q1']);
  });
  it('leaves out what is answered or skipped', () => {
    const items = deeperItems(['diving', 'hiking'], setups, { diving: ['wrecks'], hiking: ['huts'] }, { diving: { q4: [1] } }, { 'hiking.q2': true }, gate);
    expect(items.map((x) => qid(x.interest, x.q.key))).toEqual(['hiking.q1']);
  });
  it('ignores a chip that is not one of the interest\'s live chips', () => {
    expect(deeperItems(['diving'], setups, { diving: ['not-a-chip'] }, {}, {}, gate).filter((x) => !x.optional)).toHaveLength(0);
  });
});

describe('newItems', () => {
  it('asks the always-asked questions and those a ticked chip opened, for new interests only', () => {
    const items = newItems(['hiking'], setups, { hiking: ['huts'] }, {}, {});
    expect(items.map((x) => qid(x.interest, x.q.key))).toEqual(['hiking.q1', 'hiking.q2']);
    expect(newItems(['hiking'], setups, {}, {}, {}).map((x) => x.q.key)).toEqual(['q1']);
  });
  it('skips answered and skipped ones, and interests with no questions', () => {
    expect(newItems(['hiking', 'birding'], setups, { hiking: ['huts'] }, { hiking: { q1: [0] } }, { 'hiking.q2': true })).toEqual([]);
  });
});

describe('the DNA bar', () => {
  const base: BarInput = { keys: ['diving', 'safari'], added: [], setups, qa: {}, ticked: {}, chipsDone: false, marks: 0, newChipped: [] };
  it('totals every question, one point per interest, and the caps for the extra steps', () => {
    const caps = BAR_CAPS.interests + BAR_CAPS.marks + BAR_CAPS.newChips + BAR_CAPS.newQuestions;
    expect(barTotal(base)).toBe(5 + 4 + 2 + caps);
  });
  it('starts at 0 and counts answers', () => {
    expect(dnaPercent(base)).toBe(0);
    expect(barPoints({ ...base, qa: { diving: { q1: [0], q2: [1] }, safari: { q1: [0] } } })).toBe(3);
  });
  it('counts an interest\'s chips only once the chip step is done, and only if something is ticked', () => {
    const t = { ...base, ticked: { diving: ['wrecks'], safari: [] } };
    expect(barPoints(t)).toBe(0);
    expect(barPoints({ ...t, chipsDone: true })).toBe(1);
  });
  it('caps each extra step so no one step fills the bar', () => {
    const lots = { ...base, added: ['a', 'b', 'c', 'd', 'e', 'f'], marks: 99, newChipped: ['a', 'b', 'c', 'd', 'e', 'f'] };
    expect(barPoints(lots)).toBe(BAR_CAPS.interests + BAR_CAPS.marks + BAR_CAPS.newChips);
  });
  it('counts answers to added interests up to their cap, and never answers outside the traveler\'s interests', () => {
    const qa = { hiking: { q1: [0], q2: [0] }, birding: { q1: [0] } };
    expect(barPoints({ ...base, added: ['hiking'], qa })).toBe(1 + 2);
  });
  it('puts the gate at its share of the bar and counts questions to unlock', () => {
    expect(gatePercent(7, base)).toBeCloseTo((7 / barTotal(base)) * 100, 6);
    expect(toUnlock(7, 0)).toBe(7);
    expect(toUnlock(7, 4)).toBe(3);
    expect(toUnlock(7, 9)).toBe(0);
  });
});
