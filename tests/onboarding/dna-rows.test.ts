import { describe, it, expect } from 'vitest';
import { dnaRows, keepOn, rowHasChoices, type RowContext } from '@/lib/onboarding/dna-rows';
import { LEVEL_ORDER, setLevel } from '@/lib/onboarding/levels';
import { allBands, toggleBandChoice } from '@/lib/onboarding/care';

const base: RowContext = { dnaMode: false, bands: allBands(), care: {}, who: [], home: null, vibes: [], answerCount: 0, month: null, week: 0, maxHours: 0 };

describe('Travel DNA page rows', () => {
  it('lists the four bands, every "what else matters" item, who and the home airport; weather stays with the trip unless it is the Travel DNA path', () => {
    const trip = dnaRows(base);
    expect(trip.map((r) => r.key)).toEqual(['b_budget', 'b_weather', 'b_vibe', 'b_physical', 'c_kids', 'c_food', 'c_lang', 'c_how', 'c_deals', 'who', 'origin']);
    expect(trip.find((r) => r.key === 'b_weather')!.def).toBe(false);
    expect(trip.find((r) => r.key === 'who')!.def).toBe(false);
    expect(trip.find((r) => r.key === 'who')!.title).toBe('Who is going this time');
    const dna = dnaRows({ ...base, dnaMode: true });
    expect(dna.find((r) => r.key === 'b_weather')!.def).toBe(true);
    expect(dna.find((r) => r.key === 'who')!.def).toBe(true);
    expect(dna.find((r) => r.key === 'who')!.title).toBe('Who you usually travel with');
  });
  it('says "No preference" for an untouched band and lists a narrowed one', () => {
    const rows = dnaRows({ ...base, bands: toggleBandChoice(allBands(), 'budget', 'luxury') });
    expect(rows.find((r) => r.key === 'b_budget')!.summary).toBe('Luxury');
    expect(rows.find((r) => r.key === 'b_vibe')!.summary).toBe('No preference');
  });
  it('lists every care item, kept by default only for the lasting ones, and dates and flight limits under "this trip only"', () => {
    const rows = dnaRows({ ...base, care: { food: { o: ['vegan'], firm: true }, kids: { o: ['k'], firm: false } }, month: 9, week: 2, home: 'SFO', maxHours: 8, vibes: ['beach'], answerCount: 6 });
    expect(rows.find((r) => r.key === 'c_food')).toMatchObject({ def: true, summary: 'Vegan · must' });
    expect(rows.find((r) => r.key === 'c_kids')!.def).toBe(false);
    expect(rows.find((r) => r.key === 'when')).toMatchObject({ sec: 'trip', def: false, summary: 'Oct · week 2' });
    expect(rows.find((r) => r.key === 'limits')).toMatchObject({ sec: 'trip', def: false, summary: 'From SFO · under 8h' });
    expect(rows.find((r) => r.key === 'vibes')!.sec).toBe('taste');
    expect(rows.find((r) => r.key === 'ans')!.summary).toBe('6 answers saved');
    expect(rows.find((r) => r.key === 'origin')!.summary).toBe('San Francisco (SFO)');
  });
  it('a switch follows the traveler once they flip it, and the default until then', () => {
    expect(keepOn({}, 'x', true)).toBe(true);
    expect(keepOn({ x: false }, 'x', true)).toBe(false);
  });
  it('every "what else matters" row says "No preference" until something is picked, whatever the item', () => {
    const rows = dnaRows(base).filter((r) => r.key.startsWith('c_') || r.key === 'b_vibe' || r.key === 'b_physical');
    expect(rows.length).toBe(7);
    expect(rows.every((r) => r.summary === 'No preference')).toBe(true);
    expect(dnaRows({ ...base, care: { food: { o: [], firm: false } } }).find((r) => r.key === 'c_food')!.summary).toBe('No preference');
  });
  it('social vibe and physical demand are listed with the other "what matters" items; budget and weather stay under Open to', () => {
    const rows = dnaRows(base);
    expect(rows.filter((r) => r.sec === 'care').map((r) => r.key)).toEqual(['b_vibe', 'b_physical', 'c_food', 'c_lang', 'c_how']);
    expect(rows.filter((r) => r.sec === 'open').map((r) => r.key)).toEqual(['b_budget', 'b_weather']);
    expect(rows.filter((r) => r.sec === 'trip').map((r) => r.key)).toEqual(['c_kids', 'c_deals']);
  });
  it('opens a card by default only when it already holds choices', () => {
    const ctx = { ...base, subs: { hiking: ['day-hikes'], golf: [] }, bands: toggleBandChoice(allBands(), 'vibe', 'lively'), home: 'JFK' };
    expect(rowHasChoices('i:hiking', ctx)).toBe(true);
    expect(rowHasChoices('i:golf', ctx)).toBe(false);
    expect(rowHasChoices('b_vibe', ctx)).toBe(true);
    expect(rowHasChoices('b_budget', ctx)).toBe(false);
    expect(rowHasChoices('origin', ctx)).toBe(true);
    expect(rowHasChoices('who', ctx)).toBe(false);
  });
});

describe('setting a level on the Travel DNA page', () => {
  it('has the five levels in order', () => {
    expect(LEVEL_ORDER).toEqual(['off', 'cur', 'like', 'love', 'top']);
  });
  it('any level except Off opens the card, and Off removes the interest and closes it', () => {
    expect(setLevel({ hiking: 'cur' }, 'hiking', 'love')).toEqual({ levels: { hiking: 'love' }, blocked: false, open: true });
    expect(setLevel({}, 'golf', 'cur')).toEqual({ levels: { golf: 'cur' }, blocked: false, open: true });
    expect(setLevel({ hiking: 'top' }, 'hiking', 'off')).toEqual({ levels: {}, blocked: false, open: false });
  });
  it('a sixth Top is refused, but an existing Top can be set to Top again', () => {
    const five = { a: 'top', b: 'top', c: 'top', d: 'top', e: 'top', f: 'like' } as const;
    expect(setLevel({ ...five }, 'f', 'top')).toEqual({ levels: { ...five }, blocked: true, open: false });
    expect(setLevel({ ...five }, 'a', 'top').blocked).toBe(false);
  });
});

import { dnaTags } from '@/lib/onboarding/dna-rows';

describe('the tags on the saved screen', () => {
  const ctx = {
    bands: toggleBandChoice(allBands(), 'budget', 'luxury'),
    care: { food: { o: ['vegan'], firm: true } },
    vibes: ['beach', 'quiet', 'food', 'night'],
    levels: { hiking: 'top', golf: 'like' },
    subs: { hiking: ['day-hikes'] },
    chips: { hiking: [{ key: 'day-hikes', label: 'Day hikes' }] },
    interestOrder: ['hiking', 'golf'],
    interestName: (k: string) => ({ icon: k === 'hiking' ? '🥾' : '⛳', label: k === 'hiking' ? 'Hiking & Trekking' : 'Golf' }),
  };
  it('lists narrowed bands, three photo picks, interests with specifics, and lasting items', () => {
    expect(dnaTags(ctx)).toEqual(['💳 Luxury', 'Toes in the sand', 'Total quiet', 'Long lunches and market crawls', '🥾 Hiking & Trekking · Day hikes · top interest', '⛳ Golf', '🥗 Food needs: Vegan · must']);
  });
  it('says so when there is nothing yet, and counts interests beyond seven', () => {
    expect(dnaTags({ ...ctx, bands: allBands(), care: {}, vibes: [], interestOrder: [], levels: {}, subs: {} })).toEqual(['Open to anything so far']);
    const many = Array.from({ length: 9 }, (_, i) => `k${i}`);
    expect(dnaTags({ ...ctx, bands: allBands(), care: {}, vibes: [], interestOrder: many, levels: {}, interestName: () => ({ icon: '•', label: 'x' }) }).slice(-1)).toEqual(['+2 more interests']);
  });
});
