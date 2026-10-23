// 23 Oct 2026: records how the Wind sports columns were drafted (one whole-interest review) and adds the to-dos for checking them.
// Safe to re-run: skips what already exists. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/wind-notes-oct22.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestReviews, interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const K = 'hotSprings';
  const notes = 'First drafts of the Hot Springs columns for all 27 places (plan approved 23 Oct 2026 after the owner\'s comments: no soaking-climate or pool-temperature columns because a place has neither one climate nor one pool heat; instead two lists of months, and the heat levels on offer). The natural outdoor pools rating, the onsen and geothermal spa ticks, bathing customs, water heat on offer, the cold and cool month lists and the signature springs were drafted by Claude from each place\'s live text and general knowledge. Nothing is marked source-checked. The three chips are live. Question 2 (cold months, cool weather) reads the month the traveler is going; with no month it asks for nothing.';
  const [er] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, K), eq(interestReviews.reviewerName, 'Claude (drafted columns)')));
  if (!er) {
    const values = { interestKey: K, placeId: null, reviewerName: 'Claude (drafted columns)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-22', notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  const todos: Array<{ title: string; detail: string }> = [
    { title: 'Check the drafted Hot Springs columns', detail: 'Read each column top to bottom and fix what looks wrong. The three live chips read the natural pools rating and the onsen and geothermal spa ticks; the three questions read bathing customs, the cold and cool month lists and the heat levels on offer. Source-check the strongest claims (springs that are open, closures, heat levels). Hokkaido and Tokyo & Kyoto need a close look at the onsen ticks and heat levels.' },
    { title: 'Possible Hot Springs planning columns', detail: 'Owner parked these on 23 Oct 2026: booking ahead and a status or closure note (Yellowstone\'s Boiling River closed since 2022, Copahue snowed in about May to November, Conundrum needs an overnight permit). The closures are already in the signature springs text.' },
  ];
  let made = 0;
  for (const t of todos) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, K), eq(interestTodos.title, t.title)));
    if (ex) continue;
    const values = { interestKey: K, title: t.title, detail: t.detail, status: 'idea' as const, source: 'Wind sports columns, 23 Oct 2026', doneAt: null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    made++;
  }
  console.log('review', er ? 'already there' : 'added', '| to-dos added', made);
  process.exit(0);
})();
