import { describe, expect, it } from 'vitest';
import { evaluateInterest, summarize, type InterestFacts } from '@/lib/interests/definition-of-done';

const done: InterestFacts = {
  key: 'x', label: 'X', family: true, authored: true, applicable: 100, text: 100, passes: 1, passesFinished: 1, factNoteOn: '2026-11-09', ownerReviews: 1,
  ruleSections: 4, handBuiltRules: false, na: 5, naReason: 5, defs: 6, chips: 4, chipsLive: 4, chipsApproved: 4, questions: 3, questionsApproved: 3, planningApproved: true,
  wording: { filler: 0, offers: 0, promo: 0, contrast: 0, thisInterest: 0, total: 0 },
};

describe('definition of done', () => {
  it('has no gaps for a finished interest', () => {
    expect(summarize(evaluateInterest(done)).gaps).toEqual([]);
  });
  it('reports each missing record', () => {
    const f: InterestFacts = { ...done, passes: 0, passesFinished: 0, factNoteOn: '', ruleSections: 0, ownerReviews: 0, na: 3, naReason: 1, text: 50 };
    const ids = summarize(evaluateInterest(f)).gaps.map((g) => g.id).sort();
    expect(ids).toEqual(['factnote', 'na', 'ownerReview', 'pass', 'rules', 'text']);
  });
  it('treats an unfinished pass as a gap', () => {
    expect(summarize(evaluateInterest({ ...done, passes: 2, passesFinished: 1 })).gaps.map((g) => g.id)).toEqual(['pass']);
  });
  it('counts wording hits as a gap for family interests but only as information for older ones', () => {
    const hits = { filler: 3, offers: 5, promo: 0, contrast: 0, thisInterest: 0, total: 6 };
    expect(summarize(evaluateInterest({ ...done, wording: hits })).gaps.map((g) => g.id)).toEqual(['wording']);
    const s = summarize(evaluateInterest({ ...done, family: false, wording: hits }));
    expect(s.gaps).toEqual([]);
    expect(s.info.map((g) => g.id)).toEqual(['wording']);
  });
  it('accepts a hand-built rules page', () => {
    expect(summarize(evaluateInterest({ ...done, ruleSections: 0, handBuiltRules: true })).gaps).toEqual([]);
  });
  it('never claims the owner marks are done or missing', () => {
    expect(evaluateInterest(done).find((r) => r.id === 'ownerMarks')?.state).toBe('unknown');
  });
});
