import { describe, it, expect } from 'vitest';
import { interestsInGroup, nextUnseenGroup, pickerGroups, pickerInterests, relatedFor } from '@/lib/onboarding/interests';
import { orderedByLevel, toggleSpecific, togglePick, toggleTop, topCount } from '@/lib/onboarding/levels';
import { getOnboardingSettings } from '@/lib/onboarding/settings';
import { RELATED_INTERESTS } from '@/lib/onboarding/related-interests';

describe('the interest picker data', () => {
  it('has the four categories and the 47 real interests, none from the Value group', () => {
    expect(pickerGroups().map((g) => g.name)).toEqual(['Nature & Wildlife', 'Sports & Recreation', 'Culture & Discovery', 'Relaxation & Leisure']);
    expect(pickerInterests().length).toBe(47);
    expect(pickerInterests().some((i) => ['deals', 'crowds', 'roadtrip'].includes(i.key))).toBe(false);
  });
  it('every fixed first-eight interest exists in its own category', () => {
    for (const [group, keys] of Object.entries(getOnboardingSettings().primaryInterests)) {
      const inGroup = pickerInterests().filter((i) => i.group === group).map((i) => i.key);
      for (const k of keys) expect(inGroup, `${group}: ${k}`).toContain(k);
      expect(keys.length).toBe(8);
    }
  });
  it('a category lists its first eight in order, then the rest by audience tier', () => {
    const nature = interestsInGroup('Nature & Wildlife');
    expect(nature.slice(0, 8).map((i) => i.key)).toEqual(getOnboardingSettings().primaryInterests['Nature & Wildlife']);
    expect(nature.length).toBe(pickerInterests().filter((i) => i.group === 'Nature & Wildlife').length);
    const rest = nature.slice(8);
    const tier = { iconic: 0, popular: 1, enthusiast: 2, specialist: 3 } as Record<string, number>;
    for (let i = 1; i < rest.length; i++) expect(tier[rest[i - 1].tier]).toBeLessThanOrEqual(tier[rest[i].tier]);
  });
  it('uses the three shorter labels', () => {
    const label = (k: string) => pickerInterests().find((i) => i.key === k)?.label;
    expect(label('yogaRetreats')).toBe('Yoga & Wellness');
    expect(label('wildflowerBlooms')).toBe('Blooms & Colors');
    expect(label('mountaineering')).toBe('Climbing & Mountaineering');
  });
});

describe('people who pick these often add', () => {
  it('suggests the strongest neighbours first, never ones already picked', () => {
    expect(relatedFor(['hiking']).map((i) => i.key)).toEqual(RELATED_INTERESTS.hiking.slice(0, 4));
    expect(relatedFor(['hiking', 'trailRunning']).map((i) => i.key)).not.toContain('trailRunning');
  });
  it('adds up neighbours shared by several picks and stops at four', () => {
    const r = relatedFor(['hiking', 'mountaineering', 'campingBackcountry']);
    expect(r.length).toBe(4);
  });
  it('has nothing for an interest with no neighbours', () => {
    expect(relatedFor(['fishing'])).toEqual([]);
  });
  it('only points at interests that exist in the picker', () => {
    const keys = new Set(pickerInterests().map((i) => i.key));
    for (const [k, list] of Object.entries(RELATED_INTERESTS)) {
      expect(keys.has(k), k).toBe(true);
      for (const o of list) expect(keys.has(o), `${k} -> ${o}`).toBe(true);
    }
  });
});

describe('the next-category button', () => {
  const order = ['A', 'B', 'C', 'D'];
  it('names the first category after this one that has never been opened', () => {
    expect(nextUnseenGroup(order, 'A', { A: true })).toBe('B');
    expect(nextUnseenGroup(order, 'A', { A: true, B: true })).toBe('C');
    expect(nextUnseenGroup(order, 'B', { A: true, B: true, C: true })).toBe('D');
  });
  it('wraps round to an earlier category that was skipped', () => {
    expect(nextUnseenGroup(order, 'D', { B: true, C: true, D: true })).toBe('A');
  });
  it('is gone once every category has been opened', () => {
    expect(nextUnseenGroup(order, 'C', { A: true, B: true, C: true, D: true })).toBeNull();
  });
});

describe('levels and top interests', () => {
  it('a tap picks as Like and a second tap drops it', () => {
    expect(togglePick({}, 'hiking')).toEqual({ hiking: 'like' });
    expect(togglePick({ hiking: 'like' }, 'hiking')).toEqual({});
  });
  it('tapping a row makes it Top, and again returns it to Like', () => {
    const a = toggleTop({ hiking: 'like' }, 'hiking');
    expect(a).toEqual({ levels: { hiking: 'top' }, blocked: false });
    expect(toggleTop(a.levels, 'hiking').levels).toEqual({ hiking: 'like' });
  });
  it('a sixth Top changes nothing and asks for the popup', () => {
    let l: Record<string, 'like' | 'top'> = {};
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) l[k] = 'like';
    for (const k of ['a', 'b', 'c', 'd', 'e']) l = toggleTop(l, k).levels as typeof l;
    expect(topCount(l)).toBe(5);
    const r = toggleTop(l, 'f');
    expect(r.blocked).toBe(true);
    expect(r.levels).toEqual(l);
    // Freeing one lets the sixth in.
    const freed = toggleTop(l, 'a').levels;
    expect(toggleTop(freed, 'f').blocked).toBe(false);
  });
  it('lists top interests first and keeps pick order otherwise', () => {
    expect(orderedByLevel({ a: 'like', b: 'like', c: 'top', d: 'like' })).toEqual(['c', 'a', 'b', 'd']);
  });
  it('toggles a specific on and off', () => {
    const on = toggleSpecific({}, 'hiking', 'day-hikes');
    expect(on).toEqual({ hiking: ['day-hikes'] });
    expect(toggleSpecific(on, 'hiking', 'day-hikes')).toEqual({ hiking: [] });
  });
});
