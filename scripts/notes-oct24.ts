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
NOTES.historyArchaeology = 'First drafts of the nine History & Archaeology columns for all 89 places, the four chips live and four question rules (25 Oct 2026, plan approved the same day). Drafted by Claude from general knowledge; nothing is marked source-checked.';
NOTES.sunbathing = 'First drafts of the Sunbathing columns for all 199 places (25 Oct 2026, plan approved the same day with Resort pool days as a rating). Started from the Beaches ratings (resort beaches, remote beaches, calm water), then adjusted for pool-led places and windy coasts; places with no shore carry low shore ratings. Three chips live; questions 2 to 4 mapped. Question 1, how hot, is waiting on a source for properly hot months. Nothing is marked source-checked.';
NOTES.architecture = 'First drafts of the Architecture columns for all 165 places, the three chips live and three question rules (25 Oct 2026, plan approved the same day; private building tours read Buildings you can go inside at 8 or more). Drafted by Claude from general knowledge; nothing is marked source-checked.';
NOTES.cityExploration = 'First drafts of the City Exploration columns for all 119 places, the three chips live and four question rules (25 Oct 2026). City size is a population number (thousands, metro area of the largest city a visitor would base in) read with soft edges. Drafted by Claude from general knowledge; nothing is marked source-checked.';
NOTES.museumsArt = 'First drafts of the Museums & Art columns for all 168 places, the four chips live and three question rules (25 Oct 2026). Half a day and a full day read the biggest museum in hours; several days reads Days of museums. Drafted by Claude from general knowledge; nothing is marked source-checked.';
NOTES.skiingSnowboarding = 'First drafts of the Skiing & Snowboarding columns for all 60 places, the four chips live and three question rules (25 Oct 2026). Cross-country is a 0 to 10 rating anchored on kilometers. Drafted by Claude from general knowledge; nothing is marked source-checked.';
NOTES.sunbathing = NOTES.sunbathing + ' Question 1 (how hot) now reads twelve afternoon highs per place, drafted from a simple seasonal curve (annual mean, size of the swing and the hottest month), not from monthly climate tables; Beach clubs is a rating (25 Oct 2026).';
const TODOS: Array<{ interestKey: string; title: string; detail: string }> = [
  { interestKey: 'streetFood', title: 'Check the drafted Street Food columns', detail: 'Read each column top to bottom. Illness risk and eating style are judgements (low for Japan, Singapore and Europe; some for most of Southeast Asia and Latin America; high where the street food is rough on visitors). The 92 places with no street scene carry only a country default.' },
  { interestKey: 'luxuryHotels', title: 'Check the drafted Luxury Hotels columns', detail: 'Read the four ratings and the villa market choice top to bottom. The three chip ratings count as a full match at 7 or more, so check who sits at 7 or above.' },
  { interestKey: 'cyclingRoad', title: 'Check the drafted Road Cycling columns', detail: 'Read the ratings, the iconic climb counts (the chip is full at 5) and the signature rides. Rental and touring support are judgements for many places.' },
  { interestKey: 'birding', title: 'Check the drafted Habitats column', detail: 'Filled 24 Oct 2026 for all 200 places from each place\'s headline birds and general knowledge, with a few habitats per place (not all eight). 35 places have Open ocean and seabird colonies, which is what the Seabirds and pelagic trips chip reads. Read down that option first: a place is only ticked when colonies or pelagic trips are a real reason to go.' },
  { interestKey: 'historyArchaeology', title: 'Check the drafted History & Archaeology columns', detail: 'Read the five ratings and the density rating top to bottom. The Ground column is the roughest walking at the main sites, not the easiest.' },
  { interestKey: 'sunbathing', title: 'Check the drafted Sunbathing columns', detail: 'Started from the Beaches ratings. Check the pool-led places (Dubai, Palm Springs, Marrakech), the windy coasts for Calm shores, and that places with no shore carry low values. Question 1 (how hot) is unmapped until the owner chooses a source for properly hot months.' },
  { interestKey: 'architecture', title: 'Check the drafted Architecture columns', detail: 'Read the seven ratings top to bottom. Buildings you can go inside also drives the private building tours answer at 8 or more.' },
  { interestKey: 'cityExploration', title: 'Check the drafted City Exploration columns', detail: 'Check city size (metro population in thousands; for regions it is the largest city a visitor would base in), getting around, and days it can fill.' },
  { interestKey: 'museumsArt', title: 'Check the drafted Museums & Art columns', detail: 'Check Biggest museum in hours (half a day needs 3 or more, a full day 6 or more) and the timed entry choice.' },
  { interestKey: 'skiingSnowboarding', title: 'Check the drafted Skiing & Snowboarding columns', detail: 'Check cross-country ratings against trail kilometers, the heli and cat tick (banned in France and elsewhere) and the beginner and advanced ratings.' },
  { interestKey: 'sunbathing', title: 'Replace the drafted afternoon highs with real monthly climate figures', detail: 'The twelve afternoon highs per place were generated from a seasonal curve, which smooths monsoon, rainy and cloudy-season patterns and the hottest month of dry-season places. Replace them with climate normals before relying on the How hot question.' },
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
