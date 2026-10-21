import { describe, it, expect } from 'vitest';
import { interestQuotas, isQuestionAsked, questionPlan, questionsToAsk, questionsWaitingOnDrafts } from '@/lib/onboarding/question-rules';

const photo = { key: 'q4', whenChips: ['photo'] };
const altitude = { key: 'q3', whenChips: ['multi', 'summit'] };
const always = { key: 'q1', whenChips: [] };

describe('which questions are asked', () => {
  it('asks a question with no chips of everyone', () => {
    expect(isQuestionAsked(always, [], [])).toBe(true);
    expect(isQuestionAsked(always, ['photo'], ['photo'])).toBe(true);
  });
  it('asks a chip-opened question only when one of its chips is ticked', () => {
    expect(isQuestionAsked(photo, [], ['photo'])).toBe(false);
    expect(isQuestionAsked(photo, ['photo'], ['photo'])).toBe(true);
    expect(isQuestionAsked(altitude, ['summit'], ['multi', 'summit'])).toBe(true); // any one of them
    expect(isQuestionAsked(altitude, ['easy'], ['easy', 'multi', 'summit'])).toBe(false);
  });
  it('never lets a draft chip open anything', () => {
    expect(isQuestionAsked(photo, ['photo'], [])).toBe(false);
  });
  it('keeps the order and accepts sets or lists', () => {
    const qs = [always, photo, altitude];
    expect(questionsToAsk(qs, new Set(['photo']), new Set(['photo', 'multi'])).map((q) => q.key)).toEqual(['q1', 'q4']);
    expect(questionsToAsk(qs, ['multi'], ['photo', 'multi']).map((q) => q.key)).toEqual(['q1', 'q3']);
  });
  it('lists questions that wait on draft chips only', () => {
    const chips = [{ key: 'photo', live: false }, { key: 'multi', live: true }, { key: 'summit', live: false }];
    expect(questionsWaitingOnDrafts([always, photo, altitude], chips).map((q) => q.key)).toEqual(['q4']);
    expect(questionsWaitingOnDrafts([altitude], [{ key: 'multi', live: false }, { key: 'summit', live: false }]).map((q) => q.key)).toEqual(['q3']);
    expect(questionsWaitingOnDrafts([altitude], [])).toHaveLength(1); // chips that no longer exist
  });
});

describe('how many questions each top interest gets', () => {
  it('follows the agreed shares', () => {
    expect(interestQuotas(5)).toEqual([2, 2, 2, 2, 2]);
    expect(interestQuotas(4)).toEqual([3, 3, 2, 2]);
    expect(interestQuotas(3)).toEqual([3, 3, 3]);
    expect(interestQuotas(2)).toEqual([4, 4]);
    expect(interestQuotas(1)).toEqual([10]);
    expect(interestQuotas(0)).toEqual([]);
    expect(interestQuotas(7)).toEqual([2, 2, 2, 2, 2]);
  });
  it('asks as many as there are when an interest has fewer than its share', () => {
    const plan = questionPlan(['hiking', 'surfing'], { hiking: 6, surfing: 2 });
    expect(plan.items).toEqual([{ interest: 'hiking', allowed: 4, ask: 4 }, { interest: 'surfing', allowed: 4, ask: 2 }]);
    expect(plan.total).toBe(6);
  });
  it('asks everything that applies, up to ten, for a single interest', () => {
    expect(questionPlan(['hiking'], { hiking: 7 }).total).toBe(7);
    expect(questionPlan(['hiking'], { hiking: 14 }).total).toBe(10);
    expect(questionPlan(['hiking'], {}).total).toBe(0);
  });
  it('totals ten, ten, nine and eight for five, four, three and two interests with plenty of questions', () => {
    const lots = (ks: string[]) => Object.fromEntries(ks.map((k) => [k, 20]));
    const t = (ks: string[]) => questionPlan(ks, lots(ks)).total;
    expect([t(['a', 'b', 'c', 'd', 'e']), t(['a', 'b', 'c', 'd']), t(['a', 'b', 'c']), t(['a', 'b'])]).toEqual([10, 10, 9, 8]);
  });
});
