import { describe, it, expect } from 'vitest';
import type { DnaCard } from '@/lib/dna/types';
import { allBands, toggleBandChoice } from '@/lib/onboarding/care';
import { fromTravelProfile, parseTravelProfile, toTravelProfile, type FlowChoices } from '@/lib/onboarding/profile';

const card = (id: string): DnaCard => ({ id, short: id, title: id, description: '', category: 'Beach', tags: [], preferenceSignals: {}, dimensionSignals: {}, stage: 'broad', domain: null, niche: false, subdimensions: null, sampleDestinations: null, unlockMinPositive: null, unlockMinLove: null, diagnosticPurpose: null });

const choices: FlowChoices = {
  levels: { hiking: 'top', golf: 'like' },
  subs: { hiking: ['day-hikes'], surfing: ['learn-to-surf'], golf: [] },
  bands: toggleBandChoice(toggleBandChoice(allBands(), 'budget', 'luxury'), 'weather', 'warm'),
  care: { food: { o: ['vegan'], firm: true }, kids: { o: ['k'], firm: false } },
  who: ['partner'],
  home: 'SFO',
  vibes: ['beach'],
  answers: [{ card: card('c1'), type: 'love' }],
  month: 9,
  week: 2,
  maxHours: 8,
};

describe('what gets saved', () => {
  it('trip: keeps interests, the lasting care items, budget and home; leaves weather, kids, who and dates with the trip', () => {
    const p = toTravelProfile(choices, {}, false);
    expect(p.levels).toEqual({ hiking: 'top', golf: 'like' });
    expect(p.subs).toEqual({ hiking: ['day-hikes'] });
    expect(p.bands.budget).toEqual(['luxury']);
    expect(p.bands.weather).toEqual(allBands().weather);
    expect(p.care).toEqual({ food: { o: ['vegan'], firm: true } });
    expect(p.who).toEqual([]);
    expect(p.home).toBe('SFO');
    expect(p.vibes).toEqual(['beach']);
    expect(p.answers).toEqual([{ cardId: 'c1', type: 'love' }]);
    expect(p.month).toBeNull();
    expect(p.maxHours).toBe(0);
  });
  it('flipping a switch changes what is kept, either way', () => {
    const p = toTravelProfile(choices, { b_weather: true, who: true, when: true, limits: true, c_food: false, origin: false }, false);
    expect(p.bands.weather).toEqual(['warm']);
    expect(p.who).toEqual(['partner']);
    expect(p.month).toBe(9);
    expect(p.week).toBe(2);
    expect(p.maxHours).toBe(8);
    expect(p.care).toEqual({});
    expect(p.home).toBeNull();
  });
  it('Travel DNA path: keeps who and weather by default', () => {
    const p = toTravelProfile(choices, {}, true);
    expect(p.who).toEqual(['partner']);
    expect(p.bands.weather).toEqual(['warm']);
  });
  it('round-trips through a saved profile, dropping answers whose card is gone', () => {
    const p = toTravelProfile(choices, {}, false);
    expect(fromTravelProfile(p, [card('c1')]).answers.map((a) => a.card.id)).toEqual(['c1']);
    expect(fromTravelProfile(p, []).answers).toEqual([]);
    expect(fromTravelProfile(p, [card('c1')]).levels).toEqual(p.levels);
  });
});

describe('reading a saved profile safely', () => {
  it('drops unknown interests, levels, options and a sixth Top, and refuses garbage', () => {
    expect(parseTravelProfile(null)).toBeNull();
    expect(parseTravelProfile({ v: 2 })).toBeNull();
    const p = parseTravelProfile({
      v: 1,
      levels: { hiking: 'top', golf: 'nonsense', madeUp: 'like', surfing: 'top', diving: 'top', birding: 'top', safari: 'top', sailing: 'top' },
      subs: { hiking: ['day-hikes', 7], golf: ['x'] },
      bands: { budget: ['luxury', 'bogus'], weather: [] },
      care: { food: { o: ['vegan', 'pizza'], firm: true }, how: { o: ['road'], firm: true }, deals: { o: ['off'], firm: true }, nothing: { o: [] } },
      who: ['partner', 'dog'],
      home: 'sfo',
      vibes: ['beach', 'nope'],
      answers: [{ cardId: 'c1', type: 'love' }, { cardId: 'c2', type: 'maybe' }, 'x'],
      month: 14,
      week: 3,
      maxHours: 99,
    })!;
    expect(p.levels.golf).toBeUndefined();
    expect(p.levels.madeUp).toBeUndefined();
    expect(Object.values(p.levels).filter((l) => l === 'top').length).toBe(5);
    expect(p.levels.sailing).toBe('love');
    expect(p.subs).toEqual({ hiking: ['day-hikes'] });
    expect(p.bands.budget).toEqual(['luxury']);
    expect(p.bands.weather).toEqual(allBands().weather);
    // 'Deals' is no longer an item (it became the peak or off peak scale), so a saved one is dropped.
    expect(p.care).toEqual({ food: { o: ['vegan'], firm: true }, how: { o: ['road'], firm: false } });
    expect(p.who).toEqual(['partner']);
    expect(p.home).toBe('SFO');
    expect(p.vibes).toEqual(['beach']);
    expect(p.answers).toEqual([{ cardId: 'c1', type: 'love' }]);
    expect(p.month).toBeNull();
    expect(p.week).toBe(0);
    expect(p.maxHours).toBe(0);
  });
});

describe('where you live, how long, and which continents', () => {
  const trip: FlowChoices = { ...choices, homeCountry: 'US', homeSub: 'IL', length: '1w', continents: ['eu', 'af'] };
  it('keeps where you live by default, and the length and continents with the dates', () => {
    const p = toTravelProfile(trip, {}, false);
    expect(p.homeCountry).toBe('US');
    expect(p.homeSub).toBe('IL');
    expect(p.length).toBeNull();
    expect(p.continents).toEqual([]);
    const kept = toTravelProfile(trip, { when: true }, false);
    expect(kept.length).toBe('1w');
    expect(kept.continents).toEqual(['eu', 'af']);
  });
  it('saves "all continents" as an empty list', () => {
    const all = toTravelProfile({ ...trip, continents: ['na', 'csa', 'eu', 'af', 'as', 'oc'] }, { when: true }, false);
    expect(all.continents).toEqual([]);
  });
  it('can be switched to this trip only', () => {
    const p = toTravelProfile(trip, { origin: false }, false);
    expect(p.homeCountry).toBeNull();
    expect(p.homeSub).toBeNull();
  });
  it('round trips through the stored copy', () => {
    const saved = toTravelProfile(trip, { when: true }, false);
    const back = parseTravelProfile(JSON.parse(JSON.stringify(saved)))!;
    expect(back.homeCountry).toBe('US');
    expect(back.homeSub).toBe('IL');
    expect(back.length).toBe('1w');
    expect(back.continents).toEqual(['eu', 'af']);
    const choicesBack = fromTravelProfile(back, []);
    expect(choicesBack.length).toBe('1w');
    expect(choicesBack.continents).toEqual(['eu', 'af']);
    expect(choicesBack.homeSub).toBe('IL');
  });
  it('cleans anything odd from storage or the browser', () => {
    const odd = parseTravelProfile({ v: 1, levels: {}, homeCountry: 'zz', homeSub: 'IL', length: 'forever', continents: ['eu', 'mars', 7] })!;
    expect(odd.homeCountry).toBeNull();
    expect(odd.homeSub).toBeNull();
    expect(odd.length).toBeNull();
    expect(odd.continents).toEqual(['eu']);
    const noSub = parseTravelProfile({ v: 1, levels: {}, homeCountry: 'GB', homeSub: 'IL' })!;
    expect(noSub.homeCountry).toBe('GB');
    expect(noSub.homeSub).toBeNull();
    const badState = parseTravelProfile({ v: 1, levels: {}, homeCountry: 'CA', homeSub: 'TX' })!;
    expect(badState.homeSub).toBeNull();
  });
  it('profiles saved before these settings existed still load', () => {
    const old = parseTravelProfile({ v: 1, levels: { hiking: 'top' }, home: 'SFO' })!;
    expect(old.homeCountry).toBeNull();
    expect(old.length).toBeNull();
    expect(old.continents).toEqual([]);
  });
});
