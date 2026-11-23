import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

// 13 Nov 2026: scripts that report on, count or make work for "the interests" must use getActiveInterests() (src/lib/scoring/active-interests.ts), not the raw SLIDERS array.
// The raw array still holds every retired interest (scoring needs their stored data), and scripts that built their own list or typed `key !== 'roadtrip'` kept letting retired
// interests into counts and "missing" lists. The files below are the ones that already read it raw; a new script must use the helper, or say why in a comment containing
// "raw-sliders-ok: <reason>", or be added to the baseline on purpose. The owner adds and retires interests, so no interest name is kept anywhere in this rule.
describe('scripts and the list of interests', () => {
  it('no new script reads the raw interest list', () => {
    const root = join(__dirname, '..', '..');
    const baseline = new Set<string>(JSON.parse(readFileSync(join(__dirname, 'raw-interest-list-baseline.json'), 'utf8')));
    const rx = /(?<![A-Za-z_])SLIDERS(?![A-Za-z_])/;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { if (name !== 'node_modules') walk(full); continue; }
        if (!/\.tsx?$/.test(name)) continue;
        const text = readFileSync(full, 'utf8');
        if (/raw-sliders-ok:/.test(text)) continue;
        const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
        const rel = relative(root, full);
        if (rx.test(code) && !baseline.has(rel)) offenders.push(rel);
      }
    };
    walk(join(root, 'scripts'));
    expect(offenders, 'These scripts read the raw SLIDERS list. Use getActiveInterests() from src/lib/scoring/active-interests.ts, or add a "raw-sliders-ok: reason" comment.').toEqual([]);
  });
});
