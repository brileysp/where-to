// 18 Nov 2026, step 3 of docs/place-naming-plan.md: checks that the live JSON data files use place KEYS only. Fails when a file still has an old place id as a key, a whole value or a
// composite (acadia:hiking), or uses a p-number that is not a real place key. Same file set as scripts/rekey-place-files.ts (backups, archives and the hotel panel files are skipped).
// Usage: npx tsx scripts/check-place-keys-in-files.ts
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'; import { join, relative } from 'path';
import { rekeyJson, type RekeyStats } from '../src/lib/places/rekey';
const ROOT = join(__dirname, '..'); const map = JSON.parse(readFileSync(join(ROOT, 'scripts/data/place-keys-nov18.json'), 'utf8')).keys as Record<string, string>; const real = new Set(Object.values(map));
const SKIP = /(^|\/)(backups|archive|node_modules|\.cache|\.next)(\/|$)|before|backup/i; const EXCLUDE = /(^|\/)(place-keys-nov18\.json|hotel-quote-panel-[^/]*\.json)$/; const VALUES_ONLY = /(^|\/)hotel-place-map-nov15\.json$/;
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); const rel = relative(ROOT, p); if (SKIP.test(rel) || EXCLUDE.test(rel)) return []; return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : []; });
const strings = (v: unknown, out: string[], keys: boolean): void => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => strings(x, out, keys)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (keys) out.push(k); strings(x, out, keys); } };
const bad: string[] = []; let files = 0;
for (const r of ['docs', 'scripts/data', 'content/destinations', 'tests']) for (const f of existsSync(join(ROOT, r)) ? walk(join(ROOT, r)) : []) {
  let data: unknown; try { data = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; } files += 1; const rel = relative(ROOT, f);
  const s: RekeyStats = { keys: 0, values: 0, composites: 0 }; rekeyJson(data, map, s, { valuesOnly: VALUES_ONLY.test(rel) });
  if (s.keys || s.values || s.composites) bad.push(`${rel}: still has old ids (${s.keys} keys, ${s.values} values, ${s.composites} composites)`);
  const all: string[] = []; strings(data, all, !VALUES_ONLY.test(rel)); const unknown = [...new Set(all.flatMap((x) => (x.match(/(?<![A-Za-z0-9])p\d{4}(?![A-Za-z0-9])/g) ?? []).filter((k) => !real.has(k)).concat(/^p\d{4}$/.test(x) && !real.has(x) ? [x] : [])))];
  if (unknown.length) bad.push(`${rel}: p-numbers that are not place keys: ${unknown.slice(0, 5).join(', ')}`);
}
console.log(`${files} JSON files checked.`); if (bad.length) { console.log('PROBLEMS:\n  ' + bad.slice(0, 40).join('\n  ') + (bad.length > 40 ? `\n  ... and ${bad.length - 40} more` : '')); process.exit(1); }
console.log('Every checked data file uses place keys only.');
