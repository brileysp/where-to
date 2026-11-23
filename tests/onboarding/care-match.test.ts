import { describe, it, expect } from 'vitest';
import { careMatch, CARE_NOTE_KEY } from '@/lib/onboarding/care-match';
import { DEFAULT_MATCH_SETTINGS as S } from '@/lib/scoring/matchSettings';
import type { TravelFacts } from '@/lib/onboarding/travel-facts';

const facts: TravelFacts = {
  maui: { kidsUnder5: 9, kids5to12: 9, kidsTeens: 8, fmtRoad: 8, fmtCruise: 4, englishEase: 10, dietVegetarian: 7, dietHalal: 1, accessMobility: 9, accessWheelchair: 8, localLanguages: [] },
  safari: { kidsUnder5: 2, kids5to12: 6, kidsTeens: 7, fmtRoad: 3, fmtTour: 10, englishEase: 8, dietVegetarian: 3, accessMobility: 5, accessWheelchair: 3 },
  lisbon: { kidsUnder5: 7, kids5to12: 7, kidsTeens: 8, fmtBase: 10, englishEase: 9, dietHalal: 7, accessMobility: 4, accessWheelchair: 2, localLanguages: ['pt'] },
  nodata: {},
};
const care = (c: Record<string, { o: string[]; firm?: boolean }>) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { o: v.o, firm: !!v.firm }]));

describe('careMatch', () => {
  it('does nothing when nothing is picked', () => {
    const r = careMatch({ care: {}, facts });
    expect(r.factors).toEqual({}); expect(r.hidden).toEqual({}); expect(r.notes).toEqual({});
  });
  it('never marks a place down for what it has no data on, and never raises a score', () => {
    const r = careMatch({ care: care({ kids: { o: ['u5'], firm: true } }), facts });
    expect(r.factors.nodata).toBeUndefined(); expect(r.hidden.nodata).toBeUndefined();
    for (const f of Object.values(r.factors)) expect(f).toBeLessThanOrEqual(1);
  });
  it('a nice-to-have kids pick lowers a poor place by the Lean keep share and leaves a good one alone', () => {
    const r = careMatch({ care: care({ kids: { o: ['u5'] } }), facts });
    expect(r.factors.maui).toBeUndefined();
    expect(r.factors.safari).toBeCloseTo(1 - (1 - S.keepIfLeanMissed) * (1 - 2 / S.chipFullMatchRating), 5);
    expect(r.hidden.safari).toBeUndefined();
    expect(r.notes.safari[CARE_NOTE_KEY].reasons[0].message).toBe('Hard with under-5s');
  });
  it('a firm kids pick sets the poor place aside and keeps the Limit share for the rest', () => {
    const r = careMatch({ care: care({ kids: { o: ['u5'], firm: true } }), facts });
    expect(r.hidden.safari).toBe('Hard with under-5s');
    expect(r.hidden.maui).toBeUndefined();
    expect(r.factors.safari).toBeCloseTo(1 - (1 - S.keepIfLimitMissed) * (1 - 2 / S.chipFullMatchRating), 5);
  });
  it('with children of several ages the weakest age decides', () => {
    const r = careMatch({ care: care({ kids: { o: ['k', 'u5'] } }), facts });
    expect(r.notes.safari[CARE_NOTE_KEY].reasons[0].message).toBe('Hard with under-5s');
    expect(r.notes.maui[CARE_NOTE_KEY].matches[0]).toBe('good for all your children');
  });
  it('several dietary needs must all be met: the hardest one decides', () => {
    const r = careMatch({ care: care({ food: { o: ['veg', 'halal'], firm: true } }), facts });
    expect(r.hidden.maui).toBe('Few halal options');
    expect(r.hidden.lisbon).toBeUndefined();
  });
  it('language: English needs the English rating, another language needs it in the place list', () => {
    const en = careMatch({ care: care({ lang: { o: ['en'] } }), facts });
    expect(en.factors.lisbon).toBeUndefined();
    const pt = careMatch({ care: care({ lang: { o: ['pt'], firm: true } }), facts });
    expect(pt.hidden.maui).toBe('Portuguese is not spoken here');
    expect(pt.hidden.lisbon).toBeUndefined();
    const both = careMatch({ care: care({ lang: { o: ['en', 'pt'] } }), facts });
    expect(both.factors.maui).toBeUndefined();
  });
  it('mobility has two levels, each with its own rating: a few steps, or a wheelchair or walker', () => {
    const steps = careMatch({ care: care({ access: { o: ['steps'], firm: true } }), facts });
    expect(steps.hidden.safari).toBeUndefined(); // 5 on the few-steps rating is workable
    expect(steps.hidden.lisbon).toBeUndefined(); // 4 is the bar
    const chair = careMatch({ care: care({ access: { o: ['chair'], firm: true } }), facts });
    expect(chair.hidden.safari).toBe('Hard to get around with a wheelchair or walker');
    expect(chair.hidden.lisbon).toBe('Hard to get around with a wheelchair or walker');
    expect(chair.hidden.maui).toBeUndefined();
    const both = careMatch({ care: care({ access: { o: ['steps', 'chair'], firm: true } }), facts });
    expect(both.hidden.lisbon).toBe('Hard to get around with a wheelchair or walker'); // the stricter level wins
  });
  it('how you travel is a wish: the best liked way decides and nothing is set aside', () => {
    const r = careMatch({ care: care({ how: { o: ['road', 'cruise'] } }), facts });
    expect(r.factors.maui).toBeUndefined();
    expect(r.factors.lisbon).toBeUndefined(); // no road or cruise rating: no data, a pass
    expect(r.factors.safari).toBeLessThan(1);
    expect(Object.keys(r.hidden)).toEqual([]);
  });
  it('stacked misses never push a place under the floor', () => {
    const r = careMatch({ care: care({ kids: { o: ['u5'], firm: true }, food: { o: ['halal'], firm: true }, access: { o: ['chair'], firm: true } }), facts: { x: { kidsUnder5: 0, dietHalal: 0, accessMobility: 0, accessWheelchair: 0 } } });
    expect(r.factors.x).toBe(S.interestFloor);
  });
  it('reasons are the biggest first and no more than the setting allows', () => {
    const r = careMatch({ care: care({ kids: { o: ['u5'] }, food: { o: ['halal'] }, access: { o: ['chair'] }, lang: { o: ['pt'] } }), facts: { x: { kidsUnder5: 0, dietHalal: 0, accessMobility: 0, accessWheelchair: 0, englishEase: 0, localLanguages: [] } } });
    expect(r.notes.x[CARE_NOTE_KEY].reasons.length).toBe(S.maxReasons);
  });
});
