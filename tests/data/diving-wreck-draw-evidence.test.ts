import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const ev = JSON.parse(readFileSync(join(root, 'docs/evidence/diving-wreck-draw-evidence.json'), 'utf8')) as { places: Record<string, { addedDrawType: string; evidence: string; sources: string[] }> };
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/diving-wreck-draw-draft.json'), 'utf8')) as Record<string, { drawType: string[] }>;

describe('Diving wreck draw (28 Oct 2026)', () => {
  it('every place that gained wrecks has an evidence line and at least one source', () => {
    expect(Object.keys(ev.places).sort()).toEqual(['egypt', 'jordan', 'palau', 'palawan']);
    for (const [p, r] of Object.entries(ev.places)) {
      expect(r.addedDrawType, p).toBe('wrecks');
      expect(r.evidence.length, p).toBeGreaterThan(40);
      expect(r.sources.length, p).toBeGreaterThan(0);
      expect(draft[p].drawType, p).toContain('wrecks');
      expect(draft[p].drawType, p).toContain('reef');
    }
  });
});
