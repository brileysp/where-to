// 22 Oct 2026: records how the Wind sports columns were drafted (one whole-interest review) and adds the to-dos for checking them.
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
  const K = 'windSports';
  const notes = 'First drafts of the Wind sports columns for all 41 places (proposal approved 22 Oct 2026: wing foiling a rating like the other two, no wind reliability column, one optional rules column). The three ratings (windsurfing, kitesurfing, wing foiling) are Claude judgments against the anchors on the proposal page, read from each place\'s live text and force-ranked per column. Kind of water, levels, wind strength and gear rental come from the live text and general knowledge. The rules column is filled only for Maui, Dubai and Mallorca, from the live text and a county document or forum reports, and not rechecked; other places are blank because no rule is known and sourced. A web search found local summer kite exclusion zones elsewhere (Barcelona, Egmond aan Zee, the German Wadden Sea), which are not in the catalog. Nothing is marked source-checked.';
  const [er] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, K), eq(interestReviews.reviewerName, 'Claude (drafted columns)')));
  if (!er) {
    const values = { interestKey: K, placeId: null, reviewerName: 'Claude (drafted columns)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-22', notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  const todos: Array<{ title: string; detail: string }> = [
    { title: 'Check the drafted Wind sports columns', detail: 'Read each column top to bottom and fix what looks wrong. The three ratings feed three chips and the levels, water, wind and gear columns feed four questions. Source-check the strongest claims with wind guides and school sites (Windfinder, Wikipedia, kite and windsurf centers). Oaxaca (La Ventosa) is rated low because it has little infrastructure despite extreme wind; check that.' },
    { title: 'Fill the Wind sports rules column where rules are known', detail: 'Only Maui, Dubai and Mallorca have an entry. Real examples to confirm and add: Barcelona (kitesurfing barred from the swimming areas 1 June to 30 September), Egmond aan Zee in the Netherlands (designated activity beaches in summer), the German Wadden Sea (designated zones only), Tarifa and the Spanish and Italian beaches with seasonal zones. Check each against the local authority before adding.' },
  ];
  let made = 0;
  for (const t of todos) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, K), eq(interestTodos.title, t.title)));
    if (ex) continue;
    const values = { interestKey: K, title: t.title, detail: t.detail, status: 'idea' as const, source: 'Wind sports columns, 22 Oct 2026', doneAt: null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    made++;
  }
  console.log('review', er ? 'already there' : 'added', '| to-dos added', made);
  process.exit(0);
})();
