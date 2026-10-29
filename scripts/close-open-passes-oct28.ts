// 28 Oct 2026: marks the authoring passes that were never closed as finished, dated by their last generation. Bookkeeping only: nothing is
// applied or changed on any place. Checked first that no staged generation is newer than the live text (none is). Usage: npx tsx scripts/close-open-passes-oct28.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { authoringPasses } = await import('../src/lib/db/schema');
  const { sql, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const r = (await db.execute(sql`select p.id, max(g.created_at) as last from authoring_passes p left join content_generation_batches b on b.pass_id=p.id left join content_generations g on g.batch_id=b.id where p.finished_at is null group by p.id`)) as unknown as { rows?: Array<{ id: string; last: string | null }> };
  const list = r.rows ?? (r as unknown as Array<{ id: string; last: string | null }>);
  let n = 0;
  for (const x of list) {
    const [before] = await db.select().from(authoringPasses).where(eq(authoringPasses.id, x.id));
    const finishedAt = x.last ? new Date(x.last) : new Date();
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'authoring_pass', entityId: x.id, action: 'update', before, after: { ...before, finishedAt }, write: (tx) => tx.update(authoringPasses).set({ finishedAt }).where(eq(authoringPasses.id, x.id)) });
    n++;
  }
  console.log('closed', n, 'passes');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
