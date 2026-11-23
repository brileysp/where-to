import { describe, expect, it } from 'vitest';
import { KEY_PATTERN, alphaSortKey, assignKeys, draftAnchors, draftLevel, keyForNumber, parseWasLabel, slugify } from '@/lib/places/identity';

// 18 Nov 2026: owner's decision after the "Bagan" mistakes: "p0012 format, alphabetical". A place key never changes and is never reused; the label is free to change.
describe('place keys', () => {
  it('are a letter and four digits', () => {
    expect(keyForNumber(12)).toBe('p0012');
    expect(KEY_PATTERN.test('p0012')).toBe(true);
    expect(KEY_PATTERN.test('12')).toBe(false);
    expect(() => keyForNumber(0)).toThrow();
  });
  it('are assigned alphabetically by label with accents folded and case ignored', () => {
    const k = assignKeys([{ id: 'x1', label: 'Zermatt' }, { id: 'x2', label: 'Ålesund' }, { id: 'x3', label: 'bali' }, { id: 'bagan', label: 'Myanmar' }]);
    expect(k).toEqual({ x2: 'p0001', x3: 'p0002', bagan: 'p0003', x1: 'p0004' });
    expect(alphaSortKey('Ålesund')).toBe('alesund');
  });
  it('never change once assigned, and a new place gets the next number', () => {
    const first = assignKeys([{ id: 'a', label: 'Aruba' }, { id: 'b', label: 'Bali' }]);
    const later = assignKeys([{ id: 'a', label: 'Zzz renamed' }, { id: 'b', label: 'Aaa renamed' }, { id: 'c', label: 'Berlin' }], first);
    expect(later.a).toBe(first.a); expect(later.b).toBe(first.b); expect(later.c).toBe('p0003');
  });
});

describe('place labels, slugs and drafts', () => {
  it('makes a readable slug from the label', () => {
    expect(slugify('Myanmar')).toBe('myanmar');
    expect(slugify('Nice & the French Riviera')).toBe('nice-and-the-french-riviera');
    expect(slugify('El Chaltén & El Calafate')).toBe('el-chalten-and-el-calafate');
  });
  it('reads the older label from a renamed-places entry (the Bagan case)', () => {
    expect(parseWasLabel('Myanmar (was Bagan)')).toBe('Bagan');
    expect(parseWasLabel("Northern Ireland (was Belfast & the Giant's Causeway)")).toBe("Belfast & the Giant's Causeway");
    expect(parseWasLabel('Myanmar')).toBeNull();
  });
  it('drafts anchors and level for the owner to confirm', () => {
    expect(draftAnchors('Zermatt & the Swiss Alps')).toEqual(['Zermatt', 'the Swiss Alps']);
    expect(draftAnchors('Myanmar')).toEqual(['Myanmar']);
    expect(draftLevel('country')).toBe('country'); expect(draftLevel('island')).toBe('area'); expect(draftLevel('state_province')).toBe('region'); expect(draftLevel('city')).toBe('city');
  });
});
