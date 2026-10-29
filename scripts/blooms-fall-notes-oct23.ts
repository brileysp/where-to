// 23 Oct 2026: closes the fall-color to-do on the Blooms and Fall Colors page and adds the follow-up to-dos. Safe to re-run.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/blooms-fall-notes-oct23.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestTodos, interestReviews } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const K = 'wildflowerBlooms';
  const [open] = await db.select().from(interestTodos).where(and(eq(interestTodos.interestKey, K), eq(interestTodos.title, 'Fall color step: score the fall-color places and connect the Fall foliage chip')));
  if (open && open.status !== 'done') {
    const next = { ...open, status: 'done' as const, doneAt: new Date() };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${K}:${open.id}`, action: 'update', before: open, after: next, write: (tx) => tx.update(interestTodos).set({ status: 'done', doneAt: new Date() }).where(eq(interestTodos.id, open.id)).returning() });
    console.log('closed the fall-color step to-do');
  }
  const todos = [
    { title: 'Read the new fall-color text and scores', detail: '31 places were written or rewritten by Claude on 23 Oct 2026 (13 existing places now include their fall season; 18 switched on: Vermont, Hudson Valley, Acadia, Quebec City, Nova Scotia, Upper Peninsula, Banff, Aspen, Denali, Black Forest, Bavaria, Chamonix, Torres del Paine, El Chalten, Argentine Lake District, Chilean Lake District, Queenstown, Beijing). Peak dates were checked against web searches but nothing is marked source-checked. Fall peaks are scored at the fall rating; places rated 5 or under for fall (Texas Hill Country, Cotswolds, Olympic) were left out of the monthly scores.' },
    { title: 'Re-check bloom scores that disagree with the new ratings', detail: 'Peak monthly scores well above the best rating: Canaries 10 (best rating 7), Glacier & Waterton 10 (8), Lapland 4.5 (2), Madeira 8.3 (6), Tasmania 8.2 (6), Ethiopia 6 (4), Namibia 7.6 (6), North Island 6.4 (5). Scores well below the rating: Atacama 4.2 and Death Valley 5.4 (both rare events; the score reflects the odds, so probably right), Dolomites 8 (9), Kyrgyzstan and Joshua Tree 5 (6). Re-author a score where the columns say it is wrong, as with the beaches.' },
    { title: 'Possible further fall-color places', detail: 'Not switched on: wine regions with real autumn vineyard color (Piedmont, Rioja, Champagne, Bordeaux, Tuscany), Prague, Yosemite, Zion & Bryce, Whistler, Ireland, Wales, Tbilisi & the Caucasus, Kyrgyzstan. Decide whether any is a real fall-color draw.' },
  ];
  let made = 0;
  for (const t of todos) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, K), eq(interestTodos.title, t.title)));
    if (ex) continue;
    const values = { interestKey: K, title: t.title, detail: t.detail, status: 'idea' as const, source: 'Fall-color step, 23 Oct 2026', doneAt: null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    made++;
  }
  const notes = 'Fall-color step (23 Oct 2026, owner approved): 13 places already scored for blooms were rewritten so their overview, monthly text and monthly scores include a fall season (Tokyo & Kyoto, Seoul, Hokkaido, Great Smoky Mountains, Rocky Mountain, North Cascades, Swiss Alps, Dolomites, Napa, Douro, Tasmania, Lake District, Scottish Highlands), and 18 places known for fall color were switched on with new text, scores and all twelve columns. Written directly by Claude (not the Gemini pipeline); peak dates were checked against web searches. The monthly scores are saved as both curve and overrides. The Fall foliage chip is now live, reading the Fall color column. Nothing is marked source-checked.';
  const [er] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, K), eq(interestReviews.reviewerName, 'Claude (fall-color step)')));
  if (!er) {
    const values = { interestKey: K, placeId: null, reviewerName: 'Claude (fall-color step)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-23', notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  console.log('to-dos added', made, '| review', er ? 'already there' : 'added');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
