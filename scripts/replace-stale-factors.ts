// 13 Nov 2026: swaps the seeded reasons of some interests for rewritten ones (scripts/data/stale-factors-redo-nov13.json: nine interests whose reasons named individual venues,
// which our texts never do). Refuses to touch an interest whose old reasons already have a recorded check, so no history is lost. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/replace-stale-factors.ts [--apply]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { interestStaleFactors, interestStaleChecks, STALE_CATEGORIES, STALE_CHECKERS } = await import('../src/lib/db/schema');
  const { eq, inArray } = await import('drizzle-orm'); const { getActiveInterests } = await import('../src/lib/scoring/active-interests');
  const redo = JSON.parse(readFileSync(join(__dirname, 'data', 'stale-factors-redo-nov13.json'), 'utf8')) as Record<string, Array<{ category: string; statement: string; howToCheck: string; checker: string; checkEvery: string | null }>>;
  const active = new Set((await getActiveInterests()).map((i) => i.key));
  let swapped = 0, added = 0;
  for (const [key, list] of Object.entries(redo)) {
    if (!active.has(key)) { console.log(`skip ${key}: not active`); continue; }
    for (const f of list) { if (!(STALE_CATEGORIES as readonly string[]).includes(f.category)) throw new Error(`${key}: bad category ${f.category}`); if (!(STALE_CHECKERS as readonly string[]).includes(f.checker)) throw new Error(`${key}: bad checker ${f.checker}`); }
    const old = await db.select({ id: interestStaleFactors.id }).from(interestStaleFactors).where(eq(interestStaleFactors.interestKey, key));
    const checks = old.length ? await db.select({ id: interestStaleChecks.id }).from(interestStaleChecks).where(inArray(interestStaleChecks.factorId, old.map((o) => o.id))) : [];
    if (checks.length) { console.log(`skip ${key}: ${checks.length} checks already recorded against the old reasons`); continue; }
    console.log(`${key}: replace ${old.length} old reasons with ${list.length}`);
    swapped += old.length; added += list.length;
    if (apply) {
      await db.delete(interestStaleFactors).where(eq(interestStaleFactors.interestKey, key));
      await db.insert(interestStaleFactors).values(list.map((f, i) => ({ interestKey: key, category: f.category as (typeof STALE_CATEGORIES)[number], statement: f.statement, howToCheck: f.howToCheck, checker: f.checker as (typeof STALE_CHECKERS)[number], checkEvery: (['weekly', 'monthly', 'quarterly', 'annually'] as const).find((e) => e === f.checkEvery) ?? null, sortOrder: i })));
    }
  }
  console.log(`${apply ? 'replaced' : 'would replace'} ${swapped} old reasons with ${added} new ones`);
  process.exit(0);
})();
