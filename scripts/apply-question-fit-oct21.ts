// 21 Oct 2026: saves the owner-reviewed question-to-column rules (src/lib/onboarding/question-fit-rules.ts) and the proposed reason-chip messages into the admin,
// and adds the two to-dos from the review. Wording and approval are untouched. A reason-chip message the owner already typed is never overwritten.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-question-fit-oct21.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const TODOS = [
  { interestKey: 'diving', title: 'Fill in the Signature animals column for the rest of the places', detail: 'The "Which animal would make your trip?" question reads it, and only 48 of 111 diving places have it. Places without it are not marked down, so the question does little until it is filled (Animal (likelihood, months) format, one entry per animal).', status: 'ready_for_claude' as const },
  { interestKey: 'whaleWatching', title: 'Re-review the Boat style column', detail: 'The "What kind of boat feels right?" question reads it: small fast boat, mid-size, large ship, sailing boat. 94 of 124 places have a value; check them before the question goes live.', status: 'needs_you' as const },
];

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestQuestions, interestTodos } = await import('../src/lib/db/schema');
  const { QUESTION_FIT_RULES, PROPOSED_MISS_MESSAGES } = await import('../src/lib/onboarding/question-fit-rules');
  const { and, eq } = await import('drizzle-orm');
  for (const [id, rule] of Object.entries(QUESTION_FIT_RULES)) {
    const [ik, qk] = id.split('.');
    const where = and(eq(interestQuestions.interestKey, ik), eq(interestQuestions.questionKey, qk));
    const [q] = await db.select().from(interestQuestions).where(where);
    if (!q) throw new Error(`no question ${id}`);
    if (q.options.length !== rule.answers.length) throw new Error(`${id}: ${q.options.length} options but ${rule.answers.length} rule entries`);
    const miss = q.missMessage || PROPOSED_MISS_MESSAGES[id] || '';
    console.log(`${id}: rule for ${rule.answers.length} answers, reason chip "${miss}"${q.missMessage ? ' (kept)' : ''}`);
    if (apply) await db.update(interestQuestions).set({ fitRule: rule, missMessage: miss }).where(where);
  }
  for (const t of TODOS) {
    const existing = (await db.select().from(interestTodos).where(eq(interestTodos.interestKey, t.interestKey))).find((x) => x.title === t.title);
    console.log(`to-do ${t.interestKey}: ${t.title}${existing ? ' (already there)' : ''}`);
    if (apply && !existing) await db.insert(interestTodos).values({ ...t, source: 'Question mapping review, 21 Oct 2026' });
  }
  if (!apply) console.log('dry run: pass --apply to write');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
