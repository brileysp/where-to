import { describe, expect, it } from 'vitest';
import { TRAVEL_FACTS, TRAVEL_KEY } from '../../src/lib/admin/travel-needs/config';
import { FACT_GROUP_LABELS, factDefsFor, parseFact } from '../../src/lib/admin/interest-pages/config';

describe('traveler-needs columns', () => {
  it('are served by the fact editor under the pseudo-interest key', () => {
    expect(factDefsFor(TRAVEL_KEY)).toBe(TRAVEL_FACTS);
  });
  it('have unique keys, a known group, and a hint on every column', () => {
    const keys = TRAVEL_FACTS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of TRAVEL_FACTS) { expect(FACT_GROUP_LABELS[d.group]).toBeTruthy(); expect(d.hint?.length ?? 0).toBeGreaterThan(20); }
  });
  it('cover the five things onboarding asks about', () => {
    const keys = new Set(TRAVEL_FACTS.map((d) => d.key));
    for (const k of ['kidsUnder5', 'kids5to12', 'kidsTeens', 'fmtRoad', 'fmtTour', 'fmtCruise', 'fmtBase', 'englishEase', 'localLanguages', 'dietVegetarian', 'dietVegan', 'dietGlutenFree', 'dietHalal', 'dietKosher', 'accessMobility', 'accessWheelchair']) expect(keys.has(k)).toBe(true);
  });
  it('accept 0 to 10 ratings and reject the rest', () => {
    const d = TRAVEL_FACTS.find((x) => x.key === 'englishEase')!;
    expect(parseFact(d, 7.5)).toEqual({ ok: true, value: 7.5 });
    expect(parseFact(d, 11).ok).toBe(false);
    const l = TRAVEL_FACTS.find((x) => x.key === 'localLanguages')!;
    expect(parseFact(l, ['es', 'pt'])).toEqual({ ok: true, value: ['es', 'pt'] });
    expect(parseFact(l, ['klingon']).ok).toBe(false);
  });
});
