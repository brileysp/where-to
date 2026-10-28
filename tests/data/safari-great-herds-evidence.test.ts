import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Ev = { rule: string; places: Record<string, { value: string; confidence: string; evidence: string; sources: string[] }>; leftBlank: Record<string, string> };
const root = join(__dirname, '..', '..');
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/safari-great-herds-evidence.json'), 'utf8')) as Ev;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/safari-herds-fill-draft.json'), 'utf8')) as Record<string, { herds: string }>;

describe('Safari Great herds fill (28 Oct 2026)', () => {
  it('every filled place has a value, a confidence, an evidence line and at least one source', () => {
    expect(Object.keys(ev.places)).toHaveLength(12);
    for (const [p, r] of Object.entries(ev.places)) {
      expect(['guaranteed', 'likely', 'possible', 'unlikely', 'notPresent'], p).toContain(r.value);
      expect(['high', 'medium', 'low'], p).toContain(r.confidence);
      expect(r.evidence.length, p).toBeGreaterThan(40);
      expect(r.sources.length, p).toBeGreaterThan(0);
      for (const s of r.sources) expect(s, p).toMatch(/^https:\/\//);
      expect(draft[p].herds, p).toBe(r.value);
    }
  });
  it('places left blank say why, and none is also filled', () => {
    for (const [p, why] of Object.entries(ev.leftBlank)) { expect(why.length, p).toBeGreaterThan(20); expect(ev.places[p], p).toBeUndefined(); }
  });
  it('keeps the anchors: a continuous 100,000+ migration is the only guaranteed', () => {
    expect(Object.values(ev.places).filter((r) => r.value === 'guaranteed')).toHaveLength(0);
    expect(ev.places.zambia.value).toBe('likely');
    expect(ev.places.rwanda.value).toBe('unlikely');
  });
});
