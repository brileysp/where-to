// 13 Nov 2026: writes the owner-approved "how to check" lines into interest_stale_factors. Input is a JSON file { "<interest>:<index>": { text, checker, every, ok } } exported
// from the review page's database (index = the reason's position when it was seeded = its sort_order). Only lines marked ok are loaded, and a line is only written when the
// factor's own how-to-check is still empty or --overwrite is given, so edits made in the admin since are never lost. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/load-howto-lines.ts --file=scripts/data/howto-approved-nov13.json [--apply] [--overwrite]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const apply = process.argv.includes('--apply'); const overwrite = process.argv.includes('--overwrite'); const file = arg('file');
  if (!file) { console.log('Usage: --file=approved.json [--apply] [--overwrite]'); process.exit(1); }
  const { db } = await import('../src/lib/db/client'); const { interestStaleFactors, STALE_CHECKERS } = await import('../src/lib/db/schema'); const { and, eq } = await import('drizzle-orm');
  const src = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { text: string; checker: string; every: string; ok?: boolean }>;
  let loaded = 0, skippedNotOk = 0, skippedFilled = 0, missing = 0;
  for (const [id, v] of Object.entries(src)) {
    if (!v.ok) { skippedNotOk++; continue; }
    const [key, idx] = id.split(':'); const order = Number(idx);
    const [f] = await db.select().from(interestStaleFactors).where(and(eq(interestStaleFactors.interestKey, key), eq(interestStaleFactors.sortOrder, order)));
    if (!f) { missing++; console.log('no reason for', id); continue; }
    if (f.howToCheck.trim() && !overwrite) { skippedFilled++; continue; }
    if (!(STALE_CHECKERS as readonly string[]).includes(v.checker)) throw new Error(`${id}: unknown checker ${v.checker}`);
    const every = (['weekly', 'monthly', 'quarterly', 'annually'] as const).find((e) => e === v.every) ?? null;
    loaded++;
    if (apply) await db.update(interestStaleFactors).set({ howToCheck: v.text.trim(), checker: v.checker as (typeof STALE_CHECKERS)[number], checkEvery: every, updatedAt: new Date() }).where(eq(interestStaleFactors.id, f.id));
  }
  console.log(`${apply ? 'loaded' : 'would load'} ${loaded}; not approved ${skippedNotOk}; already had text ${skippedFilled}; no matching reason ${missing}`);
  process.exit(0);
})();
