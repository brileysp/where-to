// 18 Nov 2026 (step 4 of docs/place-naming-plan.md): turns the typed keys that scripts/rekey-place-code.ts left in code ('p0113' /* Myanmar */) into names looked up from the generated constant
// (PLACE.myanmar), and adds the import. After this no source or test file types a place key. Usage: npx tsx scripts/rekey-code-to-names.ts file.ts [...] (or --all for src and tests) [--dry]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'; import { join, relative, dirname, sep } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const ROOT = join(__dirname, '..');
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === 'node_modules' ? [] : statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [relative(ROOT, p)] : []; });
(async () => {
  const { db } = await import('../src/lib/db/client'); const { placeIdentity } = await import('../src/lib/db/schema');
  const slugOf = new Map<string, string>(((await db.select().from(placeIdentity)) as any[]).map((r) => [r.key, r.slug]));
  const dry = process.argv.includes('--dry'); const files = process.argv.includes('--all') ? [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))] : process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const name = (k: string) => { const s = slugOf.get(k); if (!s) throw new Error(`no slug for ${k}`); return /^[a-z][a-z0-9]*$/.test(s) ? `PLACE.${s}` : `PLACE['${s}']`; };
  const C = String.raw`\/\*[^*]*\*\/`; let total = 0;
  for (const f of files) {
    if (f.endsWith('keys.generated.ts') || f.startsWith('tests/places/') || f.startsWith('src/lib/places/')) continue;
    const raw = readFileSync(join(ROOT, f), 'utf8'); let n = 0;
    let t = raw.replace(new RegExp(String.raw`\['(p\d{4})'\s*${C}\]`, 'g'), (_m, k) => { n += 1; return `[${name(k)}]`; });
    t = t.replace(new RegExp(String.raw`'(p\d{4})'\s*:\s*${C}`, 'g'), (_m, k) => { n += 1; return `[${name(k)}]:`; });
    t = t.replace(new RegExp(String.raw`(^|[\s{,])(p\d{4})\s*:\s*${C}`, 'gm'), (_m, pre, k) => { n += 1; return `${pre}[${name(k)}]:`; });
    t = t.replace(new RegExp(String.raw`'(p\d{4})'\s*${C}`, 'g'), (_m, k) => { n += 1; return name(k); });
    if (!n) continue; total += n;
    if (!/from ['"](@\/|(\.\.\/)+src\/)lib\/places\/keys\.generated['"]/.test(t)) {
      const rel = f.startsWith('scripts/') ? `${relative(dirname(join(ROOT, f)), join(ROOT, 'src/lib/places/keys.generated')).split(sep).join('/')}` : '@/lib/places/keys.generated';
      const imp = `import { PLACE } from '${rel}';`; const all = [...t.matchAll(/^import[^;]*?from\s+['"][^'"]+['"];?[ \t]*$/gm)];
      if (all.length) { const last = all[all.length - 1]; const at = (last.index ?? 0) + last[0].length; t = t.slice(0, at) + '\n' + imp + t.slice(at); } else t = imp + '\n' + t;
    }
    console.log(`${f}: ${n}`); if (!dry) writeFileSync(join(ROOT, f), t);
  }
  console.log(`${total} typed keys ${dry ? 'would become' : 'became'} names.`); process.exit(0);
})();
