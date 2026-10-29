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
  const K = 'scenicLandscapes';
  const notes = 'First drafts of the Scenic Landscapes columns for all 200 places (plan approved 23 Oct 2026, with the owner\'s change that lakes, rivers and waterfalls and polar, glaciers and ice are two columns). Eleven new columns: seven landscape ratings (mountains, deserts and canyons, coasts, forests, cities and villages, lakes rivers and waterfalls, polar glaciers and ice), iconic draw, beyond the icons, ways to reach the best views and signature views; the Landscape photography column already existed. Ratings are for the place in a good season against the best of that kind in the world and were drafted by Claude from general knowledge and the place list, not source-checked. Five chips are live (Mountains, Deserts, Coasts, Forests, Landscape photography); Cities & villages reads its column but stays a draft because only five chips can be live. The gear question has no place column, as approved, so it is asked but changes nothing.';
  const [er] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, K), eq(interestReviews.reviewerName, 'Claude (drafted columns)')));
  if (!er) {
    const values = { interestKey: K, placeId: null, reviewerName: 'Claude (drafted columns)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-22', notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  const todos: Array<{ title: string; detail: string }> = [
    { title: 'Check the drafted Scenic Landscapes columns', detail: 'All 200 places are first drafts by Claude from general knowledge. Read the ratings for the places you know best and fix what looks wrong; the signature views text names the views each rating rests on. Nothing is source-checked.' },
    { title: 'Decide which five chips are live (Cities & villages is the draft)', detail: 'Six chips are approved but only five can be live. Landscape photography is live because it opens questions 3 and 4; Cities & villages already reads its column and can swap in for any other chip.' },
    { title: 'Reconcile Scenic monthly scores with the new ratings', detail: 'Peak monthly scores well below the best landscape rating: the city places (Chicago 5.0 vs 10, Venice 6.0 vs 10, Tokyo & Kyoto 6.0 vs 10, Paris and NYC 7.0 vs 10, Rajasthan 5.8, Barcelona 6.4), the beach and reef places (Maldives, Turks & Caicos, Fiji, Bahamas, Seychelles, Great Barrier Reef 10 vs 7 to 8), and Death Valley, Redwood and the Peruvian Amazon. Peak scores above the rating: Wales (Snowdonia) 9.2 vs 7, Lapland 8.4 vs 6, Northern Tanzania 7.8 vs 5, Maasai Mara 8.1 vs 5. Decide whether cities count as scenery in the score or only in the chip, then re-author where the columns say a score is wrong.' },
    { title: 'Fill Landscape photography for the 26 places without it', detail: 'The column exists for 174 places; the 26 left blank are mostly cities, Caribbean and beach places, plus Champagne and Bordeaux.' },
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
