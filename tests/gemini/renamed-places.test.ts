import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadSkipList } from '../../src/lib/gemini/skip-list';

// A renamed or broadened place must be described by its whole new scope, never its old name: see docs/renamed-places.json.
const root = join(__dirname, '..', '..');
const renamed = (JSON.parse(readFileSync(join(root, 'docs', 'renamed-places.json'), 'utf8')) as { ids: Record<string, string> }).ids;

describe('renamed places and the snorkeling & diving run', () => {
  const facts = JSON.parse(readFileSync(join(root, 'docs', 'diving-facts.json'), 'utf8')) as Record<string, { scope?: string; facts?: string[] }>;
  const skipped = loadSkipList('diving');
  const inRun = Object.keys(renamed).filter((id) => !skipped.has(id));
  it('lists the renamed places', () => {
    expect(Object.keys(renamed).length).toBeGreaterThan(15);
    expect(renamed.borabora).toMatch(/French Polynesia/);
  });
  it('gives every renamed place that goes to Gemini a scope sheet', () => {
    const missing = inRun.filter((id) => !facts[id]?.scope?.trim());
    expect(missing).toEqual([]);
  });
  it('names the new wider scope, not only the old narrower name, in the scope sheet', () => {
    const tokens = (t: string) => new Set(t.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]+/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !['the', 'and', 'was'].includes(w)));
    const bad: string[] = [];
    for (const id of inRun) {
      const m = /^(.*) \(was (.*)\)$/.exec(renamed[id]);
      if (!m) continue;
      const oldTokens = tokens(m[2]);
      const added = [...tokens(m[1])].filter((w) => !oldTokens.has(w));
      const scope = (facts[id]?.scope ?? '').toLowerCase();
      if (added.length && !added.some((w) => scope.includes(w))) bad.push(id);
    }
    expect(bad).toEqual([]);
  });
  it('says plainly that French Polynesia is the whole territory', () => {
    expect(facts.borabora?.scope).toMatch(/whole territory/);
    expect(facts.borabora?.scope).toMatch(/Tuamotu/);
  });
});
