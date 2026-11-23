// 13 Nov 2026: appends one sentence to every open "Review cadence" to-do saying the item now has a checklist of reasons and cannot be ticked done until each has a result.
// Idempotent. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/note-checklist-on-review-todos.ts [--apply]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { interestTodos } = await import('../src/lib/db/schema'); const { and, eq, ne } = await import('drizzle-orm');
  const { CADENCE_TODO_SOURCE } = await import('../src/lib/scoring/planning');
  const note = ' Open "Reasons to check" and give every reason a result: this item cannot be ticked done until each one has Checked, Changed or Does not apply.';
  const rows = await db.select().from(interestTodos).where(and(eq(interestTodos.source, CADENCE_TODO_SOURCE), ne(interestTodos.status, 'done')));
  const todo = rows.filter((r) => !r.detail.includes('Reasons to check'));
  console.log(`${rows.length} open review to-dos, ${todo.length} need the sentence${apply ? '' : ' (dry run)'}`);
  if (apply) for (const r of todo) await db.update(interestTodos).set({ detail: r.detail + note, updatedAt: new Date() }).where(eq(interestTodos.id, r.id));
  process.exit(0);
})();
