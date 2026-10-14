import { describe, expect, it } from 'vitest';
import { ownNameDistanceIssues, placeNameTokens } from '@/lib/gemini/place-name-check';

describe('own-name distance check', () => {
  it('flags the Whistler and Sonoma cases', () => {
    expect(ownNameDistanceIssues('Vancouver & Whistler', ['Boat trips departing from Vancouver—about two hours south of Whistler—find them.']).length).toBe(1);
    expect(ownNameDistanceIssues('Napa & Sonoma', ['Trips from Bodega Bay, about an hour to an hour and a half west of Sonoma.']).length).toBe(1);
  });
  it('leaves distances from somewhere else alone', () => {
    expect(ownNameDistanceIssues('Dominican Republic', ['Samaná is roughly a two-hour drive from Santo Domingo.'])).toEqual([]);
    expect(ownNameDistanceIssues('Vancouver & Whistler', ['Orcas feed in the Salish Sea from May to October.'])).toEqual([]);
  });
  it('does not check single-name places, where distance from the city is useful', () => {
    expect(ownNameDistanceIssues('Lisbon', ['Dolphin trips run from Setúbal, about an hour south of Lisbon.'])).toEqual([]);
  });
  it('ignores generic words in names', () => {
    expect(placeNameTokens('Banff & Jasper National Parks')).toEqual(['Banff', 'Jasper']);
  });
});
