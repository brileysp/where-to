import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Ev = Record<string, { found: boolean; beach?: boolean; ranch?: boolean; trek?: boolean; levels?: string[]; lengths?: string[]; operators?: Array<{ name: string; url: string; says: string }> }>;
const root = join(__dirname, '..', '..');
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/horseback-evidence.json'), 'utf8')) as Ev;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/horseback-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;

describe('Horseback evidence', () => {
  it('covers all 34 places, and every filled place names at least one operator with a page', () => {
    expect(Object.keys(ev)).toHaveLength(34);
    for (const [p, r] of Object.entries(ev)) {
      expect(typeof draft[p].evidence, p).toBe('string');
      if (!r.found) { expect(draft[p].riderLevels, p).toBeUndefined(); continue; }
      expect(r.operators!.length, p).toBeGreaterThan(0);
      for (const o of r.operators!) { expect(o.url, p).toMatch(/^https:\/\//); expect(o.says.length, `${p} ${o.name}`).toBeGreaterThan(10); }
      expect(draft[p].evidence as string, p).toContain(r.operators![0].name);
    }
  });
  it('matches the saved facts file and uses only legal values', () => {
    for (const [p, r] of Object.entries(ev)) {
      expect(!!draft[p].beachRides, p).toBe(!!r.beach);
      expect(!!draft[p].ranchStays, p).toBe(!!r.ranch);
      expect(!!draft[p].multiDayTreks, p).toBe(!!r.trek);
      for (const l of (draft[p].riderLevels as string[] | undefined) ?? []) expect(['beginner', 'confident', 'expert'], p).toContain(l);
      for (const l of (draft[p].rideLengths as string[] | undefined) ?? []) expect(['hours', 'day', 'days', 'week'], p).toContain(l);
    }
  });
  it('a multi-day trek means days or a week is offered', () => {
    for (const [p, r] of Object.entries(ev)) if (r.trek) expect(r.lengths!.some((l) => l === 'days' || l === 'week'), p).toBe(true);
  });
  it('keeps the checked anchors', () => {
    expect(draft['botswana'].riderLevels).toEqual(['expert']);
    expect(draft['kenya'].multiDayTreks).toBe(true);
    expect(draft['andalucia'].beachRides).toBe(true);
    expect(draft['ladakh'].riderLevels).toBeUndefined();
    expect(draft['uluru'].riderLevels).toBeUndefined();
  });
});

describe('Horseback local horse culture', () => {
  type Culture = Record<string, { rating: number; signals: Array<{ kind: string; page: string; url: string }> }>;
  const culture = JSON.parse(readFileSync(join(root, 'docs/evidence/horseback-culture-evidence.json'), 'utf8')) as Culture;
  it('covers all 34 places and the rating follows the signal count', () => {
    expect(Object.keys(culture)).toHaveLength(34);
    for (const [p, c] of Object.entries(culture)) {
      const n = c.signals.length;
      expect(c.rating, p).toBe(n === 0 ? 0 : n === 1 ? 4 : n === 2 ? 7 : 10);
      expect(draft[p].localHorseCulture, p).toBe(c.rating);
      for (const s of c.signals) { expect(s.url, p).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//); expect(['breed', 'event', 'tradition'], p).toContain(s.kind); }
      expect(draft[p].evidence as string, p).toContain('Local horse culture:');
    }
  });
  it('keeps the checked anchors', () => {
    expect(draft['mongolia'].localHorseCulture).toBe(10);
    expect(draft['andalucia'].localHorseCulture).toBe(10);
    expect(draft['kenya'].localHorseCulture).toBe(0);
  });
});
