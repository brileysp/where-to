import { describe, expect, it } from 'vitest';
import { interestMatchFor, type MatchChipDef, type MatchQuestionDef } from '@/lib/scoring/interestMatch';
import { QUESTION_FIT_RULES } from '@/lib/onboarding/question-fit-rules';
import { factDefsFor } from '@/lib/admin/interest-pages/config';

const defs = factDefsFor('hiking');
const chips: MatchChipDef[] = [
  { key: 'day-hikes', label: 'Day hikes', live: true, drivers: [{ column: 'dayHikeRating' }] },
  { key: 'multi-day-treks', label: 'Multi-day treks', live: true, drivers: [{ column: 'trekRating' }] },
  { key: 'hut-to-hut', label: 'Hut-to-hut', live: true, drivers: [{ column: 'ways', option: 'hutTreks' }] },
  { key: 'draft', label: 'Draft chip', live: false, drivers: [] },
];
const altitude: MatchQuestionDef = { key: 'q3', kind: 'limit', whenChips: ['day-hikes', 'multi-day-treks', 'hut-to-hut'], fitRule: QUESTION_FIT_RULES['hiking.q3'], missMessage: 'Higher than you like', approved: true };
const booking: MatchQuestionDef = { key: 'q4', kind: 'limit', whenChips: [], fitRule: QUESTION_FIT_RULES['hiking.q4'], missMessage: 'Needs booking ahead', approved: true };
const high = { dayHikeRating: 8, trekRating: 9, ways: ['dayHikes', 'hutTreks'], altitude: 'high', bookingAhead: 'months' };

describe('interestMatchFor', () => {
  it('changes nothing when nothing is ticked or answered', () => {
    const m = interestMatchFor({ chips, questions: [altitude, booking], ticked: [], answers: {}, facts: high, defs });
    expect(m.factor).toBe(1);
    expect(m.checked).toBe(0);
  });
  it('a ticked chip the place is good at keeps everything and earns a match', () => {
    const m = interestMatchFor({ chips, questions: [], ticked: ['day-hikes'], answers: {}, facts: high, defs });
    expect(m.factor).toBe(1);
    expect(m.matches).toEqual(['Day hikes']);
  });
  it('a limit answer the place misses lowers the score and gives a reason', () => {
    const m = interestMatchFor({ chips, questions: [booking], ticked: [], answers: { q4: [0] }, facts: high, defs });
    expect(m.factor).toBeCloseTo(0.65, 5);
    expect(m.reasons[0].message).toBe('Needs booking ahead');
    expect(m.checked).toBe(1);
  });
  it('a question opened by chips is ignored while none of them is ticked, and counts once one is', () => {
    const off = interestMatchFor({ chips, questions: [altitude], ticked: [], answers: { q3: [0] }, facts: high, defs });
    expect(off.factor).toBe(1);
    expect(off.checked).toBe(0);
    const on = interestMatchFor({ chips, questions: [altitude], ticked: ['day-hikes'], answers: { q3: [0] }, facts: high, defs });
    expect(on.checked).toBe(1);
    expect(on.factor).toBeLessThan(1);
  });
  it('a draft chip cannot be ticked, an unapproved or unmapped question does not count, and a place with no data is a pass', () => {
    expect(interestMatchFor({ chips, questions: [], ticked: ['draft'], answers: {}, facts: high, defs }).factor).toBe(1);
    expect(interestMatchFor({ chips, questions: [{ ...booking, approved: false }], ticked: [], answers: { q4: [0] }, facts: high, defs }).checked).toBe(0);
    expect(interestMatchFor({ chips, questions: [{ ...booking, fitRule: null }], ticked: [], answers: { q4: [0] }, facts: high, defs }).checked).toBe(0);
    const empty = interestMatchFor({ chips, questions: [booking], ticked: ['day-hikes'], answers: { q4: [0] }, facts: {}, defs });
    expect(empty.factor).toBe(1);
  });
  it('never raises the score', () => {
    const m = interestMatchFor({ chips, questions: [altitude, booking], ticked: ['hut-to-hut'], answers: { q3: [2], q4: [1] }, facts: high, defs });
    expect(m.factor).toBeLessThanOrEqual(1);
  });
});

describe('matchFromFits agrees with interestMatchFor', () => {
  const places = [
    high,
    { dayHikeRating: 3, trekRating: 2, ways: ['dayHikes'], altitude: 'low', bookingAhead: 'none' },
    { dayHikeRating: 6, ways: [], altitude: 'veryHigh', bookingAhead: 'weeks' },
    {},
  ];
  const content = {
    chips: chips.map((c) => ({ key: c.key, label: c.label, live: c.live })),
    questions: [altitude, booking].map((q) => ({ key: q.key, kind: q.kind, whenChips: q.whenChips, missMessage: q.missMessage })),
  };
  const cases = [
    { ticked: [] as string[], answers: {} as Record<string, number[]> },
    { ticked: ['day-hikes'], answers: { q3: [0], q4: [0] } },
    { ticked: ['hut-to-hut', 'multi-day-treks'], answers: { q3: [1, 2], q4: [1] } },
    { ticked: ['draft'], answers: { q3: [3], q4: [2] } },
    { ticked: ['day-hikes'], answers: { q3: [9], q4: [] } },
  ];
  it('gives the same factor, reasons and matches for every place and every set of picks', async () => {
    const { buildPlaceFits, matchFromFits } = await import('@/lib/scoring/matchTable');
    for (const facts of places) {
      const fits = buildPlaceFits(chips, [altitude, booking], facts as never, defs);
      for (const c of cases) {
        const direct = interestMatchFor({ chips, questions: [altitude, booking], ticked: c.ticked, answers: c.answers, facts: facts as never, defs });
        const viaTable = matchFromFits({ content, fits, ticked: c.ticked, answers: c.answers });
        expect(viaTable).toEqual(direct);
      }
    }
  });
  it('treats a place with no table as a pass', async () => {
    const { matchFromFits } = await import('@/lib/scoring/matchTable');
    expect(matchFromFits({ content, fits: undefined, ticked: ['day-hikes'], answers: { q3: [0], q4: [0] } }).factor).toBe(1);
  });
});
