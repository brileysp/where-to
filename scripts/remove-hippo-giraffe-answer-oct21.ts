// 21 Oct 2026: the owner never picked "Hippo and giraffe"; it came from the original question list. Removes it from Safari's animal question.
// Editing the options clears the question's approval, as the admin does. A backup of the old row goes to docs/backups/.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/remove-hippo-giraffe-answer-oct21.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestQuestions } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const where = and(eq(interestQuestions.interestKey, 'safari'), eq(interestQuestions.questionKey, 'q1'));
  const [q] = await db.select().from(interestQuestions).where(where);
  if (!q.options.includes('Hippo and giraffe')) { console.log('already gone:', q.options); process.exit(0); }
  const options = q.options.filter((o) => o !== 'Hippo and giraffe');
  const columns = q.columns.filter((c) => c !== 'hippo' && c !== 'giraffe');
  console.log('before', q.options, q.columns, '\nafter ', options, columns);
  if (!apply) { console.log('dry run'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'safari-q1-before-hippo-removal-2026-10-21.json'), JSON.stringify(q, null, 2));
  await db.update(interestQuestions).set({ options, columns, approvedBy: '', approvedAt: null, updatedBy: 'Claude (removed at owner request, 21 Oct 2026)', updatedAt: new Date() }).where(where);
  console.log('saved');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
