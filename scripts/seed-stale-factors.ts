// 13 Nov 2026: loads the "why correct data goes stale" reasons (scripts/data/stale-factors-seed.json, from the owner's staleness review of 13 Nov 2026) into
// interest_stale_factors, one row per reason. Interests that already have reasons are left alone, and an interest that is not active (admin overrides included) is skipped.
// Dry run unless --apply. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-stale-factors.ts [--apply]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { interestStaleFactors } = await import('../src/lib/db/schema');
  const { getActiveInterests } = await import('../src/lib/scoring/active-interests'); const { STALE_CATEGORIES } = await import('../src/lib/db/schema');
  const seed = JSON.parse(readFileSync(join(__dirname, 'data', 'stale-factors-seed.json'), 'utf8')) as Record<string, Array<{ category: string; statement: string }>>;
  const active = new Set((await getActiveInterests()).map((i) => i.key));
  const have = new Set((await db.select({ k: interestStaleFactors.interestKey }).from(interestStaleFactors)).map((r) => r.k));
  let rowsToAdd = 0, interests = 0; const skipped: string[] = [];
  for (const [key, list] of Object.entries(seed)) {
    if (!active.has(key)) { skipped.push(`${key} (not active)`); continue; }
    if (have.has(key)) { skipped.push(`${key} (already has reasons)`); continue; }
    for (const f of list) if (!(STALE_CATEGORIES as readonly string[]).includes(f.category)) throw new Error(`${key}: unknown category ${f.category}`);
    interests++; rowsToAdd += list.length;
    if (apply) await db.insert(interestStaleFactors).values(list.map((f, i) => ({ interestKey: key, category: f.category as (typeof STALE_CATEGORIES)[number], statement: f.statement, sortOrder: i })));
  }
  const missing = [...active].filter((k) => !seed[k] && !have.has(k));
  console.log(`${apply ? 'added' : 'would add'} ${rowsToAdd} reasons for ${interests} interests. Skipped: ${skipped.join(', ') || 'none'}.`);
  console.log(missing.length ? `Active interests with no reasons in the seed: ${missing.join(', ')}` : 'Every active interest has reasons.');
  process.exit(0);
})();
