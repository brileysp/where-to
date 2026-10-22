import { describe, expect, it } from 'vitest';
import { TRUTHS, runTruths } from '@/lib/truths/truths';
import { emptyContext, type TruthContext } from '@/lib/truths/context';
import { UNSELECTED_CHIPS } from '@/lib/truths/decisions';
import { QUESTION_FIT_RULES } from '@/lib/onboarding/question-fit-rules';

const byId = (id: string) => TRUTHS.find((t) => t.id === id)!;
const ok = (id: string, ctx: TruthContext) => byId(id).check(ctx).ok;

const chip = (o: Partial<TruthContext['chips'][number]> = {}) => ({ interestKey: 'hiking', chipKey: 'day-hikes', label: 'Day hikes', status: 'live' as const, drivers: [{ column: 'dayHikeRating' }], needsColumn: '', approvedBy: 'owner', approvedAt: '2026-10-21', ...o });
const question = (o: Partial<TruthContext['questions'][number]> = {}) => ({ interestKey: 'hiking', questionKey: 'q3', text: 'How high?', options: ['Low', 'Mid', 'High', 'Any'], maxPicks: 1, missMessage: 'Higher than you like', fitRule: null, approvedBy: 'owner', approvedAt: '2026-10-21', ...o });
const place = (o: Partial<TruthContext['places'][number]> = {}) => ({ id: 'p1', name: 'Place', region: 'Region', emoji: 'x', baseScores: {}, curves: {}, naSliders: [], naReasons: {}, overview: {}, monthly: {}, ...o });

describe('the known truths', () => {
  it('have unique ids, a plain statement, and cover every area', () => {
    expect(new Set(TRUTHS.map((t) => t.id)).size).toBe(TRUTHS.length);
    for (const t of TRUTHS) expect(t.says.length, t.id).toBeGreaterThan(20);
    expect(new Set(TRUTHS.map((t) => t.area)).size).toBe(6);
    expect(TRUTHS.length).toBeGreaterThanOrEqual(45);
  });
  it('never break on empty data', () => {
    for (const o of runTruths(emptyContext())) expect(o.detail ?? '', o.truth.id).not.toMatch(/check itself broke/);
  });
  it('hold for the matching rules (they need no data)', () => {
    for (const o of runTruths(emptyContext()).filter((x) => x.truth.area === 'Matching' && x.truth.id !== 'M12')) expect(o.status, o.truth.id).toBe('pass');
  });
  it('can fail: an unapproved chip or question', () => {
    expect(ok('C01', { ...emptyContext(), chips: [chip({ approvedAt: null })] })).toBe(false);
    expect(ok('C01', { ...emptyContext(), chips: [chip()] })).toBe(true);
    expect(ok('C02', { ...emptyContext(), questions: [question({ approvedAt: null })] })).toBe(false);
  });
  it('can fail: a chip or answer the owner removed comes back', () => {
    const [ik, ck, label] = UNSELECTED_CHIPS[0];
    expect(ok('C03', { ...emptyContext(), chips: [chip({ interestKey: ik, chipKey: ck, label })] })).toBe(false);
    expect(ok('C04', { ...emptyContext(), questions: [question({ interestKey: 'safari', questionKey: 'q1', options: ['Lion', 'Hippo and giraffe'] })] })).toBe(false);
    expect(ok('C04', { ...emptyContext(), questions: [question({ interestKey: 'safari', questionKey: 'q1', options: ['Lion', 'Tiger'] })] })).toBe(true);
  });
  it('can fail: a live chip with no measure, a bad pick limit, a rule that no longer matches its answers', () => {
    expect(ok('C05', { ...emptyContext(), chips: [chip({ drivers: [] })] })).toBe(false);
    expect(ok('C09', { ...emptyContext(), questions: [question({ maxPicks: 9 })] })).toBe(false);
    expect(ok('C08', { ...emptyContext(), questions: [question({ fitRule: { answers: [null] } })] })).toBe(false);
  });
  it('can fail: a removed interest still on a place, a score out of range, a missing N/A reason', () => {
    expect(ok('P04', { ...emptyContext(), places: [place({ naSliders: ['spectatorSports'] })] })).toBe(false);
    expect(ok('P02', { ...emptyContext(), places: [place({ baseScores: { hiking: 11 } })] })).toBe(false);
    expect(ok('P03', { ...emptyContext(), places: [place({ naSliders: ['safari'] })] })).toBe(false);
    expect(ok('P03', { ...emptyContext(), places: [place({ naSliders: ['safari'], naReasons: { safari: { reason: 'A city.' } } })] })).toBe(true);
  });
  it('can fail: text rules', () => {
    expect(ok('T01', { ...emptyContext(), places: [place({ overview: { birding: 'Thousands of atlantic puffin nest here.' } })] })).toBe(false);
    expect(ok('T01', { ...emptyContext(), places: [place({ overview: { birding: 'Thousands of Atlantic Puffins nest here.' } })] })).toBe(true);
    expect(ok('T03', { ...emptyContext(), places: [place({ overview: { hiking: 'A 12 km ridge walk.' } })] })).toBe(false);
    expect(ok('T04', { ...emptyContext(), places: [place({ overview: { hiking: 'Colour-coded routes.'.toLowerCase() } })] })).toBe(false);
    expect(ok('T04', { ...emptyContext(), places: [place({ overview: { birding: 'The London Wetland Centre is close.' } })] })).toBe(true);
    expect(ok('T05', { ...emptyContext(), places: [place({ overview: { wildlifeViewing: 'Grey seals haul out here.' } })] })).toBe(false);
    expect(ok('T06', { ...emptyContext(), places: [place({ overview: { birding: 'Common Starlings and Griffon Vultures wheel overhead.' } })] })).toBe(false);
    expect(ok('T06', { ...emptyContext(), places: [place({ overview: { birding: 'European Starlings, Eurasian Griffons and Little Ringed Plovers wheel overhead.' } })] })).toBe(true);
    expect(ok('T06', { ...emptyContext(), places: [place({ overview: { birding: 'European Pied Flycatchers and Rüppell\'s Griffon Vultures.' } })] })).toBe(true);
  });
  it('can fail: the coast rule', () => {
    expect(ok('P09', { ...emptyContext(), places: [place({ naSliders: ['beachesSwimming'] })] })).toBe(false);
    expect(ok('P09', { ...emptyContext(), places: [place({ naSliders: ['surfing', 'diving'] })] })).toBe(false);
    expect(ok('P09', { ...emptyContext(), places: [place({ id: 'copenhagen', naSliders: ['surfing', 'diving'] })] })).toBe(true);
    expect(ok('P09', { ...emptyContext(), places: [place({ naSliders: ['surfing'] })] })).toBe(true);
  });
  it('can fail: the crowd and price tiers', () => {
    expect(ok('P10', { ...emptyContext(), places: [place({ peakIntensity: 'mild' })] })).toBe(false);
    expect(ok('P10', { ...emptyContext(), places: [place({ peakIntensity: 'mild', priceSwing: 'extreme' })] })).toBe(true);
  });
  it('can fail: a saved rule that differs from the code, but not when only the key order differs', () => {
    const rule = QUESTION_FIT_RULES['hiking.q3'];
    const reordered = JSON.parse(JSON.stringify(rule, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)));
    const mk = (r: unknown) => ({ ...emptyContext(), questions: Object.keys(QUESTION_FIT_RULES).map((id) => { const [ik, qk] = id.split('.'); return question({ interestKey: ik, questionKey: qk, fitRule: id === 'hiking.q3' ? (r as never) : (QUESTION_FIT_RULES[id] as never) }); }) });
    expect(ok('A04', mk(reordered))).toBe(true);
    expect(ok('A04', mk({ answers: [null, null, null, null] }))).toBe(false);
  });
});
