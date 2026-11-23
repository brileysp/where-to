// 31 Oct 2026: build-queue to-dos for the 360 cells switched on in the N/A second pass (scripts/data/na-second-pass-oct31.json). Usage: npx tsx scripts/second-pass-todos-oct31.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const WHY: Record<string, string> = { trailRunning: 'Trail Running is now applicable everywhere Hiking is (the old N/A only meant few routes were mapped)', geologyVolcanoes: 'Geology is now applicable everywhere except cities with nothing notable', mountaineering: 'Mountaineering now counts rock climbing: switched on wherever the map lists any climbing', mountainBiking: 'Mountain Biking is now applicable wherever any graded trail, bike trail, park, tour or 3+ bike rentals are listed' };
(async () => {
  const apply = process.argv.includes('--apply');
  const plan = JSON.parse(readFileSync(join(__dirname, 'data', 'na-second-pass-oct31.json'), 'utf8')) as { A: string[][] };
  const by = new Map<string, number>();
  for (const [k] of plan.A) by.set(k, (by.get(k) ?? 0) + 1);
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  let made = 0;
  for (const [k, n] of by) {
    const title = `Score the ${n} places switched on in the N/A second pass (31 Oct 2026)`;
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, k), eq(interestTodos.title, title)));
    if (ex) continue;
    const values = { interestKey: k, title, detail: `${WHY[k]}. ${n} places have a placeholder score of 1 and no month curve or columns yet; the list is in scripts/data/na-second-pass-oct31.json.`, status: 'idea' as const, source: 'N/A second pass, 31 Oct 2026', priority: 2 };
    made++;
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${k}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
  }
  console.log(`${apply ? 'created' : 'would create'} ${made} to-dos`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
