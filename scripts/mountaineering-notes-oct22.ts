// 22 Oct 2026: records how the Mountaineering columns were drafted (one whole-interest review) and adds the to-dos for checking them.
// Safe to re-run: skips what already exists. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/mountaineering-notes-oct22.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestReviews, interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const K = 'mountaineering';
  const notes = 'First drafts of the new Mountaineering columns for all 73 places (proposal approved 22 Oct 2026, with permits, closures, planning-ahead and non-technical summits added by the owner). The four ratings (bouldering, rock climbing, alpine, non-technical summits) are Claude judgments against the anchors on the proposal page, read from each place\'s live text and force-ranked per column; Kilimanjaro-type peaks count at a medium alpine level (3 to 5) and have their own non-technical summits rating. Via ferrata, levels, commitment, guide rules, gear rental and planning-ahead are general knowledge. Permit and closure notes are mostly taken from the live place text and marked as such; four were checked by web search (Kilimanjaro, Kinabalu, Mount Whitney, Mont Blanc Gouter) and reworded where the sources disagreed. Nothing is marked source-checked; the status notes go stale and need rechecking.';
  const [er] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, K), eq(interestReviews.reviewerName, 'Claude (drafted columns)')));
  if (!er) {
    const values = { interestKey: K, placeId: null, reviewerName: 'Claude (drafted columns)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-22', notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  const todos: Array<{ title: string; detail: string }> = [
    { title: 'Check the drafted Mountaineering columns', detail: 'Read each column top to bottom and fix what looks wrong. The biggest levers are the three ratings (two chips and one question read them) and the planning-ahead, permits and closure columns the owner called key. Source-check permits and lead times for the places where they decide a trip: Kilimanjaro (lead time is our estimate), Kinabalu (guide rule and quota), Aconcagua, Denali, Nepal peak permits, Taiwan lotteries, Mount Whitney, the Goûter hut.' },
    { title: 'Recheck the Mountaineering status and closure notes', detail: 'Most are copied from the live place text, not rechecked in Oct 2026. Recheck the ones that change: Stok Kangri closure, Cotopaxi volcanic alert, Lascar alert, Mallorca restrictions, hut opening dates, raptor closures.' },
    { title: 'Add a "Non-technical summits" chip to Mountaineering?', detail: 'The new Non-technical summits rating (Kilimanjaro, Kinabalu, Aconcagua, Toubkal and similar walk-up peaks) has no chip. A chip would need your approval and a draft wording (for example "Big summits, no climbing"). Not created.' },
  ];
  let made = 0;
  for (const t of todos) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, K), eq(interestTodos.title, t.title)));
    if (ex) continue;
    const values = { interestKey: K, title: t.title, detail: t.detail, status: 'idea' as const, source: 'Mountaineering columns, 22 Oct 2026', doneAt: null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    made++;
  }
  console.log('review', er ? 'already there' : 'added', '| to-dos added', made);
  process.exit(0);
})();
