// 22 Oct 2026 (owner: "remove malaria entirely, there will be a health and safety section later"): removes the Safari malaria question (q3) from the
// onboarding questions, keeping a backup of the row, and replaces the old "should malaria be a score input" to-do with the health and safety one.
// The malaria data column on the safari places is kept as data. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/remove-safari-malaria-oct22.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const s = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const [q] = await db.select().from(s.interestQuestions).where(and(eq(s.interestQuestions.interestKey, 'safari'), eq(s.interestQuestions.questionKey, 'q3')));
  const links = await db.select().from(s.interestQuestionChips).where(and(eq(s.interestQuestionChips.interestKey, 'safari'), eq(s.interestQuestionChips.questionKey, 'q3')));
  console.log('question:', q ? q.text : 'NOT FOUND', '| links:', links.length);
  const todos = await db.select().from(s.interestTodos);
  const old = todos.find((t) => t.title === 'Decide whether malaria should become a score input');
  console.log('old to-do:', old ? old.id.slice(0, 8) + ' ' + old.status : 'none');
  if (!apply) process.exit(0);
  if (q) {
    writeFileSync(join(__dirname, '..', 'docs', 'backups', 'safari-malaria-question-2026-10-22.json'), JSON.stringify({ note: 'Removed 22 Oct 2026 at the owner\'s request: malaria belongs to the future health and safety section, not to the Safari score.', question: q, links }, null, 2));
    await db.delete(s.interestQuestions).where(and(eq(s.interestQuestions.interestKey, 'safari'), eq(s.interestQuestions.questionKey, 'q3')));
  }
  const detail = 'Decided 22 Oct 2026: a "Health and safety" section will take into account danger from crime, war and civil unrest, plus disease and illness risks (malaria and the rest), for every place and whatever the traveler\'s interests. The Safari malaria question was removed (backup in docs/backups/safari-malaria-question-2026-10-22.json); the malaria data column on the 17 safari places is kept as data to reuse.';
  if (old) await db.update(s.interestTodos).set({ title: 'Build the Health and safety section', detail, status: 'idea', updatedAt: new Date() } as never).where(eq(s.interestTodos.id, old.id));
  else await db.insert(s.interestTodos).values({ interestKey: '_site', title: 'Build the Health and safety section', detail, status: 'idea', source: 'Owner decision, 22 Oct 2026', priority: 2 });
  console.log('done');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
