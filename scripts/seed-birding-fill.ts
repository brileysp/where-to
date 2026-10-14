// Fills the empty birding columns on the admin page (Oct 2026). Safe to re-run: it only fills cells that are
// still empty, so nothing typed on the admin page is ever overwritten.
//
// Data: scripts/data/birding-fill.json (drafted, not source-checked).
//   species          rough count for the 93 places that had none
//   endemicSpecies   species found nowhere else in the world, counted for the place's own country, island or
//                    island group (so mainland regions are 0 unless a species is limited to the place itself);
//                    left blank where the answer depends on a wider regional hotspot
//   endemicFamilies  whole families found only there (Madagascar 6, North Island 5); 0 elsewhere unless blank
//   viewsPhoto       0-10 ease of clean, close views (the owner's rubric)
//   daysNeeded, guide, selfDrive, spread, access   planning columns, with a fixed set of words each
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-birding-fill.ts
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
  const { placeInterestFacts, interestTodos, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');

  const fill = JSON.parse(readFileSync(join(__dirname, 'data', 'birding-fill.json'), 'utf8')) as Record<string, Record<string, string | number>>;
  const known = new Set((await db.select({ id: places.id }).from(places)).map((p) => p.id));
  const existingRows = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'birding'));
  const byPlace = new Map(existingRows.map((r) => [r.placeId, r.facts as Record<string, unknown>]));

  let rows = 0, cells = 0;
  for (const [placeId, seed] of Object.entries(fill)) {
    if (!known.has(placeId)) { console.log('Skipping unknown place', placeId); continue; }
    const facts = { ...(byPlace.get(placeId) ?? {}) };
    let changed = false;
    for (const [k, v] of Object.entries(seed)) if (facts[k] === undefined || facts[k] === null) { facts[k] = v; changed = true; cells++; }
    if (!changed) continue;
    await db.insert(placeInterestFacts).values({ placeId, interestKey: 'birding', facts: facts as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    rows++;
  }

  const existing = await db.select({ t: interestTodos.title, s: interestTodos.status, id: interestTodos.id }).from(interestTodos).where(eq(interestTodos.interestKey, 'birding'));
  const done = ['Fill the empty data columns', 'Collect the planning columns'];
  for (const e of existing) if (done.includes(e.t) && e.s !== 'done') await db.update(interestTodos).set({ status: 'done', detail: 'First drafts filled 6 Oct 2026 (see "Check the drafted birding columns"). Endemic species and families, views/photo, the 93 missing species counts and the five planning columns now have values for most places.' }).where(eq(interestTodos.id, e.id));
  const title = 'Check the drafted birding columns';
  if (!existing.some((e) => e.t === title)) {
    await db.insert(interestTodos).values({
      interestKey: 'birding', status: 'ready_for_claude', title, source: 'Birding column fill, 6 Oct 2026',
      detail: 'All of these are first drafts from general knowledge and none are source-checked. Species counts for the 93 new places are rounded estimates. Endemic species counts only cover species found nowhere else in the place\'s own country, island or island group, so mainland regions are 0 and a wider hotspot (Albertine Rift, Atlantic Forest, Western Ghats, Iberia) is not counted. Blank on purpose: endemic species for 41 places where that definition is unclear, and endemic families for six New Zealand, southern Africa and New Guinea places. Views/photo is my judgment against your rubric for 197 places. Highest-risk numbers: Madagascar 210, Ecuador 35, Colombia 60, Borneo 55, Taiwan 25, Fiji 25, Jamaica 28, Puerto Rico 16, Vietnam 10.',
    });
  }
  console.log(`Filled ${cells} cells across ${rows} places.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
