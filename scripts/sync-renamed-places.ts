// 18 Nov 2026, step 6 of docs/place-naming-plan.md: rebuilds docs/renamed-places.json from the label history. Usage: PLACE_ROWS_FRESH=1 npx tsx scripts/sync-renamed-places.ts [--check]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { syncRenamedPlacesFile } = await import('../src/lib/places/renamed-sync'); const check = process.argv.includes('--check');
  const { changed } = await syncRenamedPlacesFile({ check });
  console.log(check ? (changed ? 'docs/renamed-places.json is OUT OF DATE: run scripts/sync-renamed-places.ts' : 'docs/renamed-places.json matches the label history.') : (changed ? 'docs/renamed-places.json rebuilt from the label history.' : 'docs/renamed-places.json already matches the label history.'));
  process.exit(check && changed ? 1 : 0);
})();
