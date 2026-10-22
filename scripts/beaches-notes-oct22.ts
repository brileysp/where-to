// 22 Oct 2026: records how the Beaches & Swimming columns were drafted (one whole-interest review) and adds the to-dos for checking them.
// Safe to re-run: skips what already exists. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/beaches-notes-oct22.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestReviews, interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const K = 'beachesSwimming';
  const notes = 'First drafts of the seven new columns for all 128 places where Beaches applies (proposal approved 22 Oct 2026). The five ratings (calm water, resort beaches, white sand, remote and empty beaches, wild coastlines) are Claude judgments against the anchors on the proposal page, force-ranked per column; they are not source-checked. Sea temperature is from ocean climatology and the place\'s live beach text; six places were spot-checked against weather-stats.com, seatemperatu.re and similar pages (Algarve, Cornwall, Cape Town, Dubai, Sardinia, Hokkaido), and about 24 temperate figures were raised 1 to 3 degrees afterwards. seatemperature.org blocks automated reads. How you reach the best beaches is general knowledge. Nothing is marked source-checked.';
  const [er] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, K), eq(interestReviews.reviewerName, 'Claude (drafted columns)')));
  if (!er) {
    const values = { interestKey: K, placeId: null, reviewerName: 'Claude (drafted columns)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-22', notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  const todos: Array<{ title: string; detail: string }> = [
    { title: 'Check the drafted Beaches columns', detail: 'The five ratings and the access column are first drafts (not source-checked). Read each column top to bottom and fix what looks wrong; the biggest levers are Calm swimming water and Resort beaches, which two chips and one question read. Then source-check sea temperature for the places where it matters most (the Mediterranean and Atlantic coasts, where one figure hides a big seasonal swing).' },
    { title: 'Beach scores disagree with the beach columns for a few places', detail: 'Andalucía (score 1) and Bordeaux (score 1) have real coasts (Costa del Sol and Cádiz; Arcachon and Lacanau) and were rated for them, so their chips would match while the place score is low. Marrakech & Atlas (score 5) was rated as having no beaches, since the coast (Essaouira) is outside the place name. Decide whether those three places should be rescoped, and whether lake-and-river places with a beach score of 2 to 3 (Berlin, Bavaria, Lake District, Vermont) should stay applicable.' },
    { title: 'Write the Beaches text and review the scores for 18 newly switched-on places', detail: 'The coast rule (22 Oct 2026) switched Beaches on for Iceland, Edinburgh, Norwegian Fjords, Southeast Alaska, Falkland Islands, Rome, Lofoten, Oaxaca, Namibia, Seoul, New York City, Napa & Sonoma, Faroe Islands, Amsterdam, Vancouver & Whistler, Cambodia, Myanmar and Milford Sound & Fiordland. Each has a first-draft curve (peaks from 0.5 to 7.5, Oaxaca highest) and drafted columns, but no written text. Oaxaca (7.5) is the one most worth a careful look, since its surf score is 6.' },
    { title: 'Beaches removed from 24 inland places (22 Oct 2026)', detail: 'Owner rule: too far from the coast for surfing means too far for a beach. Berlin, Bhutan, South Luangwa, Great Smoky Mountains, Lake District, Nepal, Laos, Yosemite, Chilean Lake District, Rioja, Sedona, Black Forest, Badlands, Chiang Mai, Tbilisi, Queenstown, Sequoia & Kings Canyon, Budapest, Zion & Bryce, Victoria Falls & Hwange, Cotswolds, Okavango Delta, Pantanal and Cusco are now N/A with a stored reason. Their beach text, curves and drafted columns are backed up in docs/backups/beaches-inland-removed-2026-10-22.json. Copenhagen and Acadia stay (coastal, no surf). Polar diving-only places (Antarctica, Svalbard, Greenland, Tierra del Fuego, Churchill) and Pakistan stay N/A for beaches. Known truth P09 guards the rule.' },
  ];
  let made = 0;
  for (const t of todos) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, K), eq(interestTodos.title, t.title)));
    if (ex) continue;
    const values = { interestKey: K, title: t.title, detail: t.detail, status: 'idea' as const, source: 'Beaches columns, 22 Oct 2026', doneAt: null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    made++;
  }
  console.log('review', er ? 'already there' : 'added', '| to-dos added', made);
  process.exit(0);
})();
