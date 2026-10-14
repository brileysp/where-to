// Deletes the 24 rewrite to-dos closed on 13 Oct 2026 because the current text already fit the widened place (owner asked for them gone).
// Usage: npx tsx scripts/delete-works-as-is-todos.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = (await db.select().from(interestTodos)).filter((t) => t.status === 'done' && t.detail.includes('Text check 13 Oct 2026: closed.'));
  console.log(`${rows.length} to-dos to delete`);
  if (apply) {
    writeFileSync(join(__dirname, '..', 'docs', 'backups', 'works-as-is-todos-deleted-2026-10-13.json'), JSON.stringify(rows, null, 1));
    for (const t of rows) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'delete', before: t, after: null, write: (tx) => tx.delete(interestTodos).where(eq(interestTodos.id, t.id)).returning() });
    console.log('deleted');
  }
  process.exit(0);
})();
