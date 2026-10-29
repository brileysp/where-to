import { describe, it, expect } from 'vitest';
import { allBands, careCount, carePicks, careSummary, CARE_ITEMS, careItemsFor, clearCare, isNarrowed, removePick, resetBand, setCareFirm, toggleBandChoice, toggleBandPill, toggleCareOption, toggleInList } from '@/lib/onboarding/care';

const item = (k: string) => CARE_ITEMS.find((c) => c.key === k)!;

describe('the Open-to pills', () => {
  it('start with everything selected, which means no preference', () => {
    const b = allBands();
    expect(b.budget).toEqual(['basic', 'comfortable', 'highend', 'luxury']);
    expect(isNarrowed(b, 'budget')).toBe(false);
  });
  it('switching one off narrows, switching it back keeps the band order, and the last one stays on', () => {
    let b = toggleBandPill(allBands(), 'weather', 'cold');
    expect(b.weather).toEqual(['cool', 'warm', 'hot']);
    b = toggleBandPill(b, 'weather', 'cold');
    expect(b.weather).toEqual(['cold', 'cool', 'warm', 'hot']);
    let one = allBands();
    for (const x of ['cold', 'cool', 'warm']) one = toggleBandPill(one, 'weather', x);
    expect(one.weather).toEqual(['hot']);
    expect(toggleBandPill(one, 'weather', 'hot').weather).toEqual(['hot']);
  });
});

describe('a band inside "What else matters"', () => {
  it('starts empty, picks add, and clearing the last one returns to no preference', () => {
    let b = toggleBandChoice(allBands(), 'vibe', 'lively');
    expect(b.vibe).toEqual(['lively']);
    b = toggleBandChoice(b, 'vibe', 'secluded');
    expect(b.vibe).toEqual(['secluded', 'lively']);
    b = toggleBandChoice(toggleBandChoice(b, 'vibe', 'secluded'), 'vibe', 'lively');
    expect(isNarrowed(b, 'vibe')).toBe(false);
    expect(resetBand(toggleBandChoice(allBands(), 'vibe', 'lively'), 'vibe').vibe.length).toBe(4);
  });
});

describe('the other "what else matters" items', () => {
  it('multi-select items hold several options and drop the item when the last goes', () => {
    let c = toggleCareOption({}, item('food'), 'vegan');
    c = toggleCareOption(c, item('food'), 'gf');
    expect(c.food.o).toEqual(['vegan', 'gf']);
    c = toggleCareOption(toggleCareOption(c, item('food'), 'vegan'), item('food'), 'gf');
    expect(c).toEqual({});
  });
  it('single-choice items hold one option', () => {
    const one = { key: 'one', icon: '1', name: 'One', detail: '', options: [['a', 'A'], ['b', 'B']] as Array<[string, string]>, multi: false };
    const c = toggleCareOption(toggleCareOption({}, one, 'a'), one, 'b');
    expect(c.one.o).toEqual(['b']);
    expect(toggleCareOption(c, one, 'b')).toEqual({});
  });
  it('the must-have switch only sticks to an item that exists, and Clear removes it', () => {
    expect(setCareFirm({}, 'kids', true)).toEqual({});
    const c = setCareFirm(toggleCareOption({}, item('kids'), 'k'), 'kids', true);
    expect(c.kids.firm).toBe(true);
    expect(clearCare(c, 'kids')).toEqual({});
  });
  it('the Travel DNA path asks only the lasting items', () => {
    expect(careItemsFor('dna').map((c) => c.key)).toEqual(['food', 'lang', 'how']);
    expect(careItemsFor('trip').length).toBe(6);
    // Step-free access and avoiding crowds were dropped: they repeat physical demand and social vibe.
    expect(careItemsFor('trip').map((c) => c.name)).not.toContain('Avoiding crowds');
    expect(careItemsFor('trip').map((c) => c.name)).not.toContain('Step-free access');
  });
});

describe('the summary and picks', () => {
  it('counts the items set, bands included', () => {
    const bands = toggleBandChoice(allBands(), 'physical', 'easy');
    const care = setCareFirm(toggleCareOption({}, item('food'), 'vegan'), 'food', true);
    expect(careCount(care, bands)).toBe(2);
    expect(careSummary(care, bands)).toEqual(['Physical demand: Easy for Anyone', 'Food needs: Vegan (must)']);
  });
  it('lists every selection and lets one be removed', () => {
    const bands = toggleBandChoice(allBands(), 'physical', 'easy');
    let care = toggleCareOption({}, item('kids'), 'k');
    care = toggleCareOption(care, item('kids'), 'u5');
    const picks = carePicks(care, bands, 'trip');
    expect(picks.map((p) => p.label)).toEqual(['Easy for Anyone', '5 to 12', 'Under 5']);
    const r = removePick(care, bands, picks[0]);
    expect(isNarrowed(r.bands, 'physical')).toBe(false);
    expect(removePick(care, bands, picks[1]).care.kids.o).toEqual(['u5']);
  });
  it('companions toggle on and off', () => {
    expect(toggleInList(['solo'], 'kids')).toEqual(['solo', 'kids']);
    expect(toggleInList(['solo', 'kids'], 'solo')).toEqual(['kids']);
  });
});
