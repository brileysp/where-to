import { describe, expect, it } from 'vitest';
import { isCardEligible, passesBasicsFilters } from '@/lib/dna/eligibility';
import { cards, legacy } from './fixtures';
import { createInitialDNAState } from '@/lib/dna/state';
import { dimensions } from './fixtures';

const BAND_SCENARIOS: Array<{ name: string; bands: Record<string, string[]>; companions: string[] }> = [
  { name: 'everything open (default)', bands: { budget: ['basic', 'comfortable', 'highend', 'luxury'], weather: ['cold', 'cool', 'warm', 'hot'], vibe: ['secluded', 'easygoing', 'lively', 'highenergy'], physical: ['easy', 'moderate', 'active', 'challenging'] }, companions: [] },
  { name: 'luxury-only, no kids', bands: { budget: ['highend', 'luxury'], weather: ['cold', 'cool', 'warm', 'hot'], vibe: ['secluded', 'easygoing', 'lively', 'highenergy'], physical: ['easy', 'moderate', 'active', 'challenging'] }, companions: [] },
  { name: 'budget-only', bands: { budget: ['basic'], weather: ['cold', 'cool', 'warm', 'hot'], vibe: ['secluded', 'easygoing', 'lively', 'highenergy'], physical: ['easy', 'moderate', 'active', 'challenging'] }, companions: [] },
  { name: 'easy-only physical', bands: { budget: ['basic', 'comfortable', 'highend', 'luxury'], weather: ['cold', 'cool', 'warm', 'hot'], vibe: ['secluded', 'easygoing', 'lively', 'highenergy'], physical: ['easy'] }, companions: [] },
  { name: 'quiet-only vibe', bands: { budget: ['basic', 'comfortable', 'highend', 'luxury'], weather: ['cold', 'cool', 'warm', 'hot'], vibe: ['secluded', 'easygoing'], physical: ['easy', 'moderate', 'active', 'challenging'] }, companions: [] },
  { name: 'traveling with kids', bands: { budget: ['basic', 'comfortable', 'highend', 'luxury'], weather: ['cold', 'cool', 'warm', 'hot'], vibe: ['secluded', 'easygoing', 'lively', 'highenergy'], physical: ['easy', 'moderate', 'active', 'challenging'] }, companions: ['kids'] },
  { name: 'combined: luxury + easy + quiet, no kids', bands: { budget: ['highend', 'luxury'], weather: ['cold', 'cool', 'warm', 'hot'], vibe: ['secluded', 'easygoing'], physical: ['easy'] }, companions: [] },
];

describe('isCardEligible — unresolvedDeepDomains re-opens a domain outside a forced dive', () => {
  const cyclingDeep = cards.find((c) => c.stage === 'deep' && c.domain === 'Cycling')!;
  const surfingDeep = cards.find((c) => c.stage === 'deep' && c.domain === 'Surfing')!;

  it('a deep card is ineligible with no active dive and its domain not marked unresolved', () => {
    const state = createInitialDNAState(dimensions);
    expect(isCardEligible(cyclingDeep, state)).toBe(false);
  });

  it('becomes eligible once its domain is in unresolvedDeepDomains, with no active dive running', () => {
    const state = { ...createInitialDNAState(dimensions), unresolvedDeepDomains: ['Cycling'] };
    expect(isCardEligible(cyclingDeep, state)).toBe(true);
  });

  it('does not leak eligibility to a different domain', () => {
    const state = { ...createInitialDNAState(dimensions), unresolvedDeepDomains: ['Cycling'] };
    expect(isCardEligible(surfingDeep, state)).toBe(false);
  });
});

describe('passesBasicsFilters — exact diff vs legacy engine, across all cards and band scenarios', () => {
  for (const scenario of BAND_SCENARIOS) {
    it(`matches legacy for every card under "${scenario.name}"`, () => {
      const newState = { ...createInitialDNAState(dimensions), bands: scenario.bands as never, companions: scenario.companions };
      const legacyState = { bands: scenario.bands, companions: scenario.companions };

      for (const card of cards) {
        const legacyResult = legacy.passesBasicsFilters(card, legacyState);
        const newResult = passesBasicsFilters(card, newState);
        expect(newResult, `card ${card.id} under "${scenario.name}"`).toBe(legacyResult);
      }
    });
  }
});
