// 13 Nov 2026: loads the reasons that apply to every interest (scripts/data/stale-site-factors.json) as interest_stale_factors rows under the site key '_site'. Every interest's review
// asks them (once per reason's own interval) and an interest can opt out of one. Skips if site-wide reasons already exist. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-site-stale-factors.ts [--apply]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { interestStaleFactors, STALE_SITE_KEY, STALE_CATEGORIES, STALE_CHECKERS } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const list = JSON.parse(readFileSync(join(__dirname, 'data', 'stale-site-factors.json'), 'utf8')) as Array<{ category: string; statement: string; howToCheck: string; checker: string; checkEvery: string | null }>;
  for (const f of list) { if (!(STALE_CATEGORIES as readonly string[]).includes(f.category)) throw new Error(`bad category ${f.category}`); if (!(STALE_CHECKERS as readonly string[]).includes(f.checker)) throw new Error(`bad checker ${f.checker}`); }
  const have = await db.select({ id: interestStaleFactors.id }).from(interestStaleFactors).where(eq(interestStaleFactors.interestKey, STALE_SITE_KEY));
  if (have.length) { console.log(`${have.length} site-wide reasons already exist; nothing to do`); process.exit(0); }
  console.log(`${apply ? 'adding' : 'would add'} ${list.length} site-wide reasons`);
  if (apply) await db.insert(interestStaleFactors).values(list.map((f, i) => ({ interestKey: STALE_SITE_KEY, category: f.category as (typeof STALE_CATEGORIES)[number], statement: f.statement, howToCheck: f.howToCheck, checker: f.checker as (typeof STALE_CHECKERS)[number], checkEvery: (['weekly', 'monthly', 'quarterly', 'annually'] as const).find((e) => e === f.checkEvery) ?? null, sortOrder: i })));
  process.exit(0);
})();
