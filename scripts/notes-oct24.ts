// 24 Oct 2026: records how the Street Food, Luxury Hotels and Road Cycling columns, Istanbul diving and the diving Signature animals column were drafted,
// adds the to-dos for checking them, and closes the diving Signature animals to-do. Safe to re-run. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/notes-oct24.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const NOTES: Record<string, string> = {
  streetFood: 'First drafts of the new Street Food columns (food adventurousness, illness risk, eating style, signature foods) for all 198 places, plus the five chips now live and four question rules (24 Oct 2026, plan approved 23 Oct with Hygiene renamed Illness risk). The 106 places with a real street-food scene have all four columns including signature foods; the other 92 (parks, remote places) carry only a country-level default for the three question columns so the questions can be checked everywhere. Drafted by Claude from general knowledge and the CDC-style regional pattern for travelers\' illness; nothing is marked source-checked.',
  luxuryHotels: 'First drafts of the seven Luxury Hotels columns for all 200 places, the three chips live and three question rules (24 Oct 2026, plan approved 23 Oct with the Signature hotels column dropped). The dream-stay question only adds a match and never marks a place down. Drafted by Claude from general knowledge; nothing is marked source-checked.',
  cyclingRoad: 'First drafts of the ten Road Cycling columns for all 196 places, the four chips live and four question rules (24 Oct 2026, plan approved 23 Oct with Big mountain climbs counted as Iconic climbs). Signature rides are written for the places with a real cycling scene. Drafted by Claude from general knowledge; nothing is marked source-checked.',
};
const TODOS: Array<{ interestKey: string; title: string; detail: string }> = [
  { interestKey: 'streetFood', title: 'Check the drafted Street Food columns', detail: 'Read each column top to bottom. Illness risk and eating style are judgements (low for Japan, Singapore and Europe; some for most of Southeast Asia and Latin America; high where the street food is rough on visitors). The 92 places with no street scene carry only a country default.' },
  { interestKey: 'luxuryHotels', title: 'Check the drafted Luxury Hotels columns', detail: 'Read the four ratings and the villa market choice top to bottom. The three chip ratings count as a full match at 7 or more, so check who sits at 7 or above.' },
  { interestKey: 'cyclingRoad', title: 'Check the drafted Road Cycling columns', detail: 'Read the ratings, the iconic climb counts (the chip is full at 5) and the signature rides. Rental and touring support are judgements for many places.' },
  { interestKey: 'birding', title: 'Check the drafted Habitats column', detail: 'Filled 24 Oct 2026 for all 200 places from each place\'s headline birds and general knowledge, with a few habitats per place (not all eight). 35 places have Open ocean and seabird colonies, which is what the Seabirds and pelagic trips chip reads. Read down that option first: a place is only ticked when colonies or pelagic trips are a real reason to go.' },
  { interestKey: 'diving', title: 'Check the drafted Signature animals', detail: 'Filled 24 Oct 2026 from the animals each place\'s live text names; many places are blank on purpose (lakes, wrecks, Iceland, ice). Likelihoods and months follow the wording of the text and are not source-checked.' },
];
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestReviews, interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  for (const [K, notes] of Object.entries(NOTES)) {
    const [er] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, K), eq(interestReviews.reviewerName, 'Claude (drafted columns)')));
    if (er) continue;
    const values = { interestKey: K, placeId: null, reviewerName: 'Claude (drafted columns)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-24', notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${K}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  let made = 0;
  for (const t of TODOS) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, t.interestKey), eq(interestTodos.title, t.title)));
    if (ex) continue;
    const values = { ...t, status: 'idea' as const, source: 'Columns and fill, 24 Oct 2026', doneAt: null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${t.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    made++;
  }
  const open = (await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'diving'))).filter((t) => t.title.startsWith('Fill in the Signature animals') && t.status !== 'done');
  for (const t of open) {
    const detail = `${t.detail}\n\nDone 24 Oct 2026: filled for the places where the live text names animals worth a trip (73 of 112 places); the rest are blank on purpose (owner: lakes, wrecks, Iceland and similar have none).`;
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'update', before: t, after: { ...t, status: 'done', detail }, write: (tx) => tx.update(interestTodos).set({ status: 'done', doneAt: new Date(), detail, updatedAt: new Date() }).where(eq(interestTodos.id, t.id)).returning() });
  }
  console.log('to-dos added', made, '| closed', open.length);
  process.exit(0);
})();
