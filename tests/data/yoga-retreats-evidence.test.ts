import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/yoga-retreats-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const LINES = ['Yoga retreats:', 'Detox retreats:', 'Meditation and silent retreats:', 'Practice levels served:', 'Structure:', 'Styles:', 'Retreat lengths:'];

describe('Yoga Retreats evidence', () => {
  it('covers the 20 places with an evidence line per column', () => {
    expect(Object.keys(draft)).toHaveLength(20);
    for (const [p, d] of Object.entries(draft)) for (const l of LINES) expect(d.evidence as string, `${p} ${l}`).toContain(l);
  });
  it('every tick names its source', () => {
    for (const [p, d] of Object.entries(draft)) {
      const ev = d.evidence as string;
      expect(d.yogaRetreat, p).toBe(true);
      expect(ev, p).toMatch(/Yoga retreats: ticked\..*Source: https?:\/\//);
      if (d.detoxRetreat) expect(ev, p).toMatch(/Detox retreats: ticked\..*Source: https?:\/\//);
      else expect(ev, p).toContain('Detox retreats: left blank');
      if (d.meditationRetreat) expect(ev, p).toMatch(/Meditation and silent retreats: ticked\..*Source: https?:\/\//);
      else expect(ev, p).toContain('Meditation and silent retreats: left blank');
    }
  });
  it('Vipassana ticks come from the dhamma.org directory except one named silent-retreat operator', () => {
    const med = Object.entries(draft).filter(([, d]) => d.meditationRetreat).map(([p]) => p).sort();
    expect(med).toEqual(['algarve', 'bali', 'costa-rica', 'kerala', 'nepal', 'srilanka', 'tuscany']);
    for (const p of med.filter((x) => x !== 'algarve')) expect(draft[p].evidence as string, p).toContain('dhamma.org');
  });
  it('each place has levels and lengths, and values are from the allowed lists', () => {
    for (const [p, d] of Object.entries(draft)) {
      expect((d.practiceLevels as string[]).length, p).toBeGreaterThan(0);
      expect((d.retreatLengths as string[]).length, p).toBeGreaterThan(0);
      for (const v of d.practiceLevels as string[]) expect(['beginner', 'regular', 'teacher']).toContain(v);
      for (const v of d.retreatLengths as string[]) expect(['weekend', 'week', 'twoweeks']).toContain(v);
      for (const v of (d.yogaStyles as string[] | undefined) ?? []) expect(['gentle', 'vinyasa', 'hathaAshtanga']).toContain(v);
      for (const v of (d.retreatStructure as string[] | undefined) ?? []) expect(['full', 'balanced', 'free']).toContain(v);
    }
  });
});
