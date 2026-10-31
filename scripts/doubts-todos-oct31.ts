// 31 Oct 2026: build-queue to-dos for the 31 place-interest pairs switched on from the 47 N/A doubts (scripts/data/na-doubts-rulings-oct31.json). Usage: npx tsx scripts/doubts-todos-oct31.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const plan = JSON.parse(readFileSync(join(__dirname, 'data', 'na-doubts-rulings-oct31.json'), 'utf8')) as { A: string[][] };
  const by = new Map<string, string[]>();
  for (const [k, , name] of plan.A) by.set(k, [...(by.get(k) ?? []), name]);
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  let made = 0;
  for (const [k, names] of by) {
    const title = `Build ${names.length} switched-on ${k} places (N/A doubts, 31 Oct 2026)`;
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, k), eq(interestTodos.title, title)));
    if (ex) continue;
    const values = { interestKey: k, title, detail: `Ruled "switch on" from the 47 N/A doubts, with a placeholder score of 1 and no month curve or columns yet: ${names.join(', ')}. Each needs a real score, month curve and columns.`, status: 'idea' as const, source: 'N/A doubts, 31 Oct 2026', priority: 2 };
    made++;
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${k}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
  }
  console.log(`${apply ? 'created' : 'would create'} ${made} to-dos (${[...by].map(([k, v]) => `${k} ${v.length}`).join(', ')})`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
