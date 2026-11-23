// 18 Nov 2026 (step 4 of docs/place-naming-plan.md): writes src/lib/places/keys.generated.ts, a constant PLACE that maps every current slug, every retired slug and every old id to its key,
// so code and tests can say PLACE.myanmar instead of typing a key. TypeScript then refuses a name that does not exist. Re-run after a slug changes or a place is added:
// PLACE_ROWS_FRESH=1 npx tsx scripts/generate-place-keys.ts [--check]   (--check only reports whether the file is up to date)
import { readFileSync, writeFileSync, existsSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client'); const s = await import('../src/lib/db/schema');
  const ident = (await db.select().from(s.placeIdentity)) as any[]; const sr = (await db.select().from(s.placeSlugRedirects)) as any[]; const ir = (await db.select().from(s.placeIdRedirects)) as any[];
  const { buildKeysFile } = await import('../src/lib/places/keys-file'); const text = buildKeysFile({ identity: ident, slugRedirects: sr, idRedirects: ir });
  const file = join(__dirname, '..', 'src/lib/places/keys.generated.ts');
  if (process.argv.includes('--check')) { const same = existsSync(file) && readFileSync(file, 'utf8') === text; console.log(same ? 'keys.generated.ts is up to date.' : 'keys.generated.ts is OUT OF DATE: run scripts/generate-place-keys.ts'); process.exit(same ? 0 : 1); }
  writeFileSync(file, text); console.log(`Wrote the names for ${ident.length} places.`); process.exit(0);
})();
