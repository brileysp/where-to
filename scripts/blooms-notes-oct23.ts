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
  const K = 'wildflowerBlooms';
  const notes = 'First drafts of the Blooms and Fall Colors columns for all 40 places (proposal approved 23 Oct 2026, including the two ratings with no chip and counting off-spring flowering trees in the first rating). The six ratings, the timing and crowd levels, how you see it, the organised-event tick and the signature blooms were drafted by Claude from each place\'s live text and general knowledge; fall ratings are filled only where the text or general knowledge supports them (11 places) and are blank elsewhere until the fall-color step. The two ratings are against the best of that kind in the world. Nothing is marked source-checked. Three chips are live (Cherry and spring blossoms, Desert superblooms, Flower fields & farms); Fall foliage waits for the fall-color step.';
  const [er] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, K), eq(interestReviews.reviewerName, 'Claude (drafted columns)')));
  if (!er) {
    const values = { interestKey: K, placeId: null, reviewerName: 'Claude (drafted columns)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-22', notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  const todos: Array<{ title: string; detail: string }> = [
    { title: 'Check the drafted Blooms and Fall Colors columns', detail: 'Read each column top to bottom and fix what looks wrong. The three live chips read the blossom, desert and flower-field ratings; the three questions read timing, how you see it and crowds at the main bloom. Source-check the strongest claims (festival dates, superbloom years, whether a place has a real fall season).' },
    { title: 'Fall color step: score the fall-color places and connect the Fall foliage chip', detail: 'Owner approved on 23 Oct 2026. About 10 places already scored for blooms have a real fall season their text and monthly scores do not mention (Tokyo & Kyoto, Seoul, Hokkaido, Great Smoky Mountains, Rocky Mountain, Glacier & Waterton, North Cascades, Swiss Alps, Dolomites, Napa) and need rewritten text plus a second peak in their monthly curve. About 20 places are switched off for this interest but known for fall color (Vermont, Hudson Valley, Upper Peninsula, Acadia, Quebec City, Nova Scotia, Banff, Aspen, Whistler, Bavaria, Black Forest, Chamonix, Prague, Queenstown, the Patagonian lake districts and more): switch them on with a new curve and text, then connect the Fall foliage chip to the Fall color column. Start with the sweep list on the chip (New England, eastern Canada, Japan, Korea, Alps and Dolomites larches, Patagonia, Tasmania).' },
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
