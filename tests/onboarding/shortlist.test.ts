import { describe, it, expect, vi } from 'vitest';
import type { DnaCard } from '@/lib/dna/types';
import { PREFERENCE_ATTRIBUTES } from '@/lib/dna/profile';
import { SLIDERS } from '@/lib/scoring/constants';
import { INTEREST_TO_DNA_PICK, SINGLE_PICK_INFERRED_CAP, buildProfile, dnaPicksFor, weightsFor, weightsFromProfile } from '@/lib/onboarding/bridge';
import { VIBES } from '@/lib/onboarding/vibes';
import { applyFlightLimit, changedPositions, topIds } from '@/lib/onboarding/shortlist';
import { airportByCode } from '@/lib/onboarding/airports';
import { questionHint, pickQuestion, categoriesForInterest, INTEREST_CARD_CATEGORIES } from '@/lib/onboarding/questions';
import { CATEGORY_VISUALS } from '@/lib/dna/card-visuals';

// A stand-in ranking, so the question logic can be tested without the full place data: three places ordered by the traveler's weights.
vi.mock('@/lib/onboarding/shortlist', async (orig) => {
  const real = await orig<typeof import('@/lib/onboarding/shortlist')>();
  return {
    ...real,
    rankPlaces: (_d: unknown, w: Record<string, number>) =>
      [
        { d: { id: 'mountains' }, s: (w.hiking ?? 0) * 2 + (w.birding ?? 0) },
        { d: { id: 'beach' }, s: (w.beachesSwimming ?? 0) * 2 },
        { d: { id: 'city' }, s: (w.cityExploration ?? 0) * 2 },
      ].sort((a, b) => b.s - a.s),
  };
});

const card = (id: string, category: string, signals: Record<string, number>): DnaCard =>
  ({ id, short: id, title: id, description: '', category, tags: [], preferenceSignals: signals, dimensionSignals: {}, stage: 'broad', domain: null, niche: false, subdimensions: null, sampleDestinations: null, unlockMinPositive: null, unlockMinLove: null, diagnosticPurpose: null }) as DnaCard;

describe('joining the new flow to the existing Travel DNA engine', () => {
  it('only maps interests that exist, to picks the engine knows', () => {
    const keys = new Set(SLIDERS.map((s) => s.key));
    for (const [k, pick] of Object.entries(INTEREST_TO_DNA_PICK)) {
      expect(keys.has(k), k).toBe(true);
      expect(categoriesForInterest(k).length, `${k} -> ${pick}`).toBeGreaterThan(0);
    }
  });
  it('every interest-to-card-category entry names a real card category and a real interest', () => {
    const keys = new Set(SLIDERS.map((s) => s.key));
    for (const [k, cats] of Object.entries(INTEREST_CARD_CATEGORIES)) {
      expect(keys.has(k), k).toBe(true);
      for (const c of cats) expect(CATEGORY_VISUALS[c], `${k}: ${c}`).toBeDefined();
    }
    expect(categoriesForInterest('surfing')).toEqual(['Surfing']);
  });
  it('counts each older pick once however many interests point at it', () => {
    expect(dnaPicksFor({ hiking: 'like', campingBackcountry: 'top', golf: 'like' }).sort()).toEqual(['golf', 'outdoors']);
    expect(dnaPicksFor({ fineDining: 'like' })).toEqual([]);
  });
  it('photo picks only use attributes the engine has', () => {
    for (const v of VIBES) for (const attr of Object.keys(v.signals)) expect(PREFERENCE_ATTRIBUTES, `${v.key}: ${attr}`).toContain(attr);
  });
  it('a photo pick moves the profile the way a double-strength yes would', () => {
    const p = buildProfile({ levels: {}, who: [], bands: {}, vibes: ['beach'], answers: [] });
    expect(p.beach).toBeGreaterThan(2);
  });
  it('with two or more interests picked, only those count: nothing is inferred', () => {
    const w = weightsFor({ levels: { hiking: 'top', golf: 'like' }, who: [], bands: {}, vibes: ['wild'], answers: [] });
    expect(w.hiking).toBe(9.5);
    expect(w.golf).toBe(5);
    expect(w.birding).toBe(0);
    expect(w.wildlifeViewing).toBe(0);
    expect(Object.entries(w).filter(([, v]) => v > 0).map(([k]) => k).sort()).toEqual(['golf', 'hiking']);
  });
  it('with exactly one interest picked, the profile suggests a little, never more than the cap', () => {
    const w = weightsFor({ levels: { hiking: 'top' }, who: [], bands: {}, vibes: ['wild', 'trail'], answers: [] });
    expect(w.hiking).toBe(9.5);
    const others = Object.entries(w).filter(([k]) => k !== 'hiking').map(([, v]) => v);
    expect(Math.max(...others)).toBeLessThanOrEqual(SINGLE_PICK_INFERRED_CAP);
    expect(others.some((v) => v > 2)).toBe(true);
  });
  it('with nothing picked the profile decides everything, as before', () => {
    const w = weightsFor({ levels: {}, who: [], bands: {}, vibes: ['wild'], answers: [] });
    expect(Math.max(...Object.values(w))).toBeGreaterThan(SINGLE_PICK_INFERRED_CAP);
  });
  it('a love answer raises the interests that card is about', () => {
    const base = weightsFromProfile(buildProfile({ levels: {}, who: [], bands: {}, vibes: [], answers: [] }), {});
    const loved = weightsFor({ levels: {}, who: [], bands: {}, vibes: [], answers: [{ card: card('c', 'Birding', { birding: 3, remoteWilderness: 1 }), type: 'love' }] });
    expect(loved.birding).toBeGreaterThan(base.birding);
  });
});

describe('flight limits', () => {
  const ranked = [{ d: { id: 'near' }, s: 9 }, { d: { id: 'far' }, s: 8 }, { d: { id: 'unknown' }, s: 7 }] as never[];
  const sfo = airportByCode('SFO')!;
  const coords = { near: { lat: sfo.lat + 2, lon: sfo.lon }, far: { lat: -33.9, lon: 151.2 } };
  it('sets aside places beyond the limit, with the reason, and keeps places with no coordinates', () => {
    const r = applyFlightLimit(ranked, 'SFO', 8, coords);
    expect(r.kept.map((x) => x.d.id)).toEqual(['near', 'unknown']);
    expect(r.aside.length).toBe(1);
    expect(r.aside[0].d.id).toBe('far');
    expect(r.aside[0].why).toMatch(/^About \d+(\.5)? hours from SFO, over your 8-hour limit$/);
  });
  it('does nothing without a home or without a limit', () => {
    expect(applyFlightLimit(ranked, null, 8, coords).aside).toEqual([]);
    expect(applyFlightLimit(ranked, 'SFO', 0, coords).aside).toEqual([]);
  });
  it('counts places that moved', () => {
    expect(changedPositions(['a', 'b', 'c'], ['a', 'c', 'b'])).toBe(2);
    expect(topIds([{ d: { id: 'x' }, s: 1 }, { d: { id: 'y' }, s: 0 }] as never[], 1)).toEqual(['x']);
  });
});

describe('the next sharpen question', () => {
  const cards = [card('beach_a', 'Beach', { beach: 3 }), card('birding_a', 'Birding', { birding: 3 }), card('culture_a', 'Culture', { culture: 3 }), card('hiking_a', 'Hiking', { hiking: 3 })];
  const base = { levels: {}, who: [], bands: {}, vibes: [], answers: [] };
  it("asks about the traveler's own interests first, Top ones before the rest", () => {
    const q = pickQuestion({ input: { ...base, levels: { hiking: 'like', birding: 'top' } }, cards, seenCardIds: [], destinations: [], month: 5 })!;
    expect(q.lane).toBe(true);
    expect(q.card.category).toBe('Birding');
  });
  it('with no interests, asks whichever card would move the list most', () => {
    const q = pickQuestion({ input: base, cards, seenCardIds: [], destinations: [], month: 5 })!;
    expect(q.lane).toBe(false);
    expect(['hiking_a', 'beach_a', 'culture_a', 'birding_a']).toContain(q.card.id);
  });
  it('never repeats a card, and runs out', () => {
    const ctx = { input: base, cards: cards.slice(0, 1), seenCardIds: ['beach_a'], destinations: [], month: 5 };
    expect(pickQuestion(ctx)).toBeNull();
  });
  it('says how many places an answer would reshuffle, or a quieter hint when it would not', () => {
    expect(questionHint({ card: cards[0], lane: false, impact: 1.67 })).toBe('Your answer would reshuffle about 2 of your top 5.');
    expect(questionHint({ card: cards[0], lane: true, impact: 0 })).toBe('Goes into your Travel DNA. Sharpens future trips.');
    expect(questionHint({ card: cards[0], lane: false, impact: 0.2 })).toBe('Small effect on this list, saved for later.');
  });
});
