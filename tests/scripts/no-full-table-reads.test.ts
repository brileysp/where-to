import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

// 9 Nov 2026: a plain `db.select().from(places)` downloads every place (several MB). Scripts started with PLACE_ROWS_SNAPSHOT=1 are answered from the disk copy
// (src/lib/db/script-place-snapshot.ts), but a new script that forgets the flag would burn the free plan's egress again. The files below are the ones that
// already did it; a new file must use getPrimaryPlaceRows(), a filtered select, or be added to the baseline on purpose.
describe('full reads of the places table', () => {
  it('no new file reads the whole table directly', () => {
    const root = join(__dirname, '..', '..');
    const baseline = new Set<string>(JSON.parse(readFileSync(join(__dirname, 'full-read-baseline.json'), 'utf8')));
    const rx = /\.select\(\)\s*\.from\(places\)(?!\s*\.(where|limit|orderBy|innerJoin|leftJoin|\$dynamic))/;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { if (name !== 'node_modules') walk(full); continue; }
        if (!/\.tsx?$/.test(name)) continue;
        const rel = relative(root, full);
        if (rx.test(readFileSync(full, 'utf8')) && !baseline.has(rel)) offenders.push(rel);
      }
    };
    walk(join(root, 'scripts'));
    walk(join(root, 'src'));
    expect(offenders).toEqual([]);
  });
});
