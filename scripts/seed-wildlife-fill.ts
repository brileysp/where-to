// First-draft animal columns for the Wildlife Viewing page (Oct 2026). Safe to re-run: it only fills cells that are
// still empty, so nothing typed on the admin page is ever overwritten.
//
// Data: scripts/data/wildlife-fill.json. Entries come from the live wildlifeViewing overviews (which were written to
// the Wildlife Viewing directive and name each animal with an encounter likelihood), restructured into the seven
// animal columns: biggest draws only, birds and reptiles only where they are a headline draw, no bird or endemic
// counts, no monkeys-as-filler. Likelihood words: guaranteed (virtually guaranteed, reliably), likely (frequently,
// common), possible (occasionally), unlikely (elusive, rare). "habituated" or "fed" sits inside the brackets.
// How you watch and draw are filled too (draw: strong at a peak of 7 or more, moderate 5 to 6.9, weak below 5).
// Density, close-up ease and spectacle are left for the owner to rate.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-wildlife-fill.ts
import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
  }
}

async function main() {
  loadEnv();
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, interestTodos, interestReviews, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const fill = JSON.parse(readFileSync(join(__dirname, 'data', 'wildlife-fill.json'), 'utf8')) as Record<string, Record<string, string | boolean>>;
  const known = new Set((await db.select({ id: places.id }).from(places)).map((p) => p.id));
  const existing = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'wildlifeViewing'));
  const byPlace = new Map(existing.map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  let rows = 0, cells = 0;
  for (const [placeId, seed] of Object.entries(fill)) {
    if (!known.has(placeId)) { console.log('Skipping unknown place', placeId); continue; }
    const facts = { ...(byPlace.get(placeId) ?? {}) };
    let changed = false;
    for (const [k, v] of Object.entries(seed)) if (facts[k] === undefined || facts[k] === null) { facts[k] = v; changed = true; cells++; }
    if (!changed) continue;
    await db.insert(placeInterestFacts).values({ placeId, interestKey: 'wildlifeViewing', facts: facts as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    rows++;
  }

  const todos = await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'wildlifeViewing'));
  const fillTodo = todos.find((t) => t.title.startsWith('Fill the seven animal columns'));
  if (fillTodo && fillTodo.status !== 'done') await db.update(interestTodos).set({ status: 'done', title: 'Animal columns drafted for the 200 places', detail: 'Drafted 6 Oct 2026 from the live Wildlife Viewing overviews: 196 places have entries, biggest draws only. 4 places (Amsterdam, Champagne, Douro Valley, Guilin) have no real draw and are blank. See "Check the drafted animal columns".' }).where(eq(interestTodos.id, fillTodo.id));
  const title = 'Check the drafted animal columns';
  if (!todos.some((t) => t.title === title)) {
    await db.insert(interestTodos).values({
      interestKey: 'wildlifeViewing', status: 'ready_for_claude', title, source: 'Wildlife column fill, 6 Oct 2026',
      detail: 'The animal entries restate what the live overviews say, converted to four likelihood words, and add well-known draws where the overview was thin (Kenya\'s wildebeest migration, Tanzania\'s zebra, Kruger\'s buffalo). Nothing is independently source-checked and draw is not marked checked. Check the highest-peak places first, then any entry marked habituated. Density, close-up ease and spectacle are still blank for you to rate.',
    });
  }
  const has = await db.select({ id: interestReviews.id }).from(interestReviews).where(and(eq(interestReviews.interestKey, 'wildlifeViewing'), eq(interestReviews.reviewerName, 'Claude (AI)'), eq(interestReviews.reviewedOn, '2026-10-06')));
  if (has.length === 0) await db.insert(interestReviews).values({ interestKey: 'wildlifeViewing', placeId: null, reviewerName: 'Claude (AI)', reviewerRole: 'AI-assisted column draft', reviewedOn: '2026-10-06', createdBy: 'seed script', notes: 'Read all 200 live wildlife overviews and structured the named animals into the seven animal columns, keeping only each place\'s biggest draws. Birds and reptiles are filled only where they are a headline draw (penguins, flamingos at Camargue, Galápagos tortoises and iguanas, Komodo dragons). Not source-checked beyond what the overviews already say. How you watch and draw are filled; density, close-up ease and spectacle are blank.' });
  console.log(`Filled ${cells} cells across ${rows} places.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
