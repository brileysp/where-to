// 18 Nov 2026, step 3 of docs/place-naming-plan.md: in TypeScript files, replaces a string literal that IS an old place id ('bagan', "punta-cana") with the key plus the label as a comment
// ('p0113' /* Myanmar */), so the code stays readable. Only whole literals are touched. Run on named files; prints every change. Step 4 replaces these typed ids with lookups.
// Usage: npx tsx scripts/rekey-place-code.ts (file.ts [file.ts ...] | --all) [--dry]   (--all = every .ts/.tsx under src and tests)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'; import { join, relative } from 'path';
const ROOT = join(__dirname, '..'); const map = JSON.parse(readFileSync(join(ROOT, 'scripts/data/place-keys-nov18.json'), 'utf8')).keys as Record<string, string>;
const labels = new Map<string, string>((JSON.parse(readFileSync(join(ROOT, '.cache/place-rows.json'), 'utf8')) as any[]).map((r) => [r.id, r.name]));
const dry = process.argv.includes('--dry'); let total = 0;
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === 'node_modules' ? [] : statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [relative(ROOT, p)] : []; });
const files = process.argv.includes('--all') ? [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))] : process.argv.slice(2).filter((a) => !a.startsWith('--'));
for (const f of files) {
  const raw = readFileSync(join(ROOT, f), 'utf8'); let n = 0;
  const next = raw.replace(/(['"])([a-z][a-z0-9-]*)\1(\s*:)?/g, (m, q, id, colon) => { if (!Object.prototype.hasOwnProperty.call(map, id)) return m; n += 1; const label = (labels.get(map[id]) ?? id).replace(/\*\//g, ''); return colon ? `'${map[id]}'${colon} /* ${label} */` : `'${map[id]}' /* ${label} */`; });
  // Unquoted object keys such as `rivieramaya: 10` (ids without a hyphen can be written bare).
  const next2 = next.replace(/(^|[\s{,])([a-z][a-z0-9]*)(\s*:)(?!:)/gm, (m, pre, id, colon) => { if (!Object.prototype.hasOwnProperty.call(map, id)) return m; n += 1; const label = (labels.get(map[id]) ?? id).replace(/\*\//g, ''); return `${pre}${map[id]}${colon} /* ${label} */`; });
  // Dotted property access with an id as the name, such as `draft.tanzania[col]` or `ev.places.zambia.value`.
  const next3 = next2.replace(/(\?)?\.([a-z][a-z0-9]*)\b(?!\s*\()/g, (m, q, id) => { if (!Object.prototype.hasOwnProperty.call(map, id)) return m; n += 1; const label = (labels.get(map[id]) ?? id).replace(/\*\//g, ''); return `${q ?? ''}${q ? '.' : ''}['${map[id]}' /* ${label} */]`; });
  if (n) { total += n; console.log(`${f}: ${n} literals`); if (!dry) writeFileSync(join(ROOT, f), next3); }
}
console.log(`${total} literals ${dry ? 'would be ' : ''}rewritten.`);
