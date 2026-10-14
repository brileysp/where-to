// First-draft snorkeling & diving columns for the interest page (Oct 2026). Safe to re-run: it only fills cells that are
// still empty, so nothing typed on the admin page is ever overwritten.
//
// Data: scripts/data/diving-fill.json, 75 places where Claude was confident of the usual way the place is dived (how you do it,
// certification, depth, current, water temperature, signature animals). Written from general knowledge, NOT source-checked
// (drawSourceChecked is false everywhere). A blank cell means "not drafted", not "none". The diving and snorkeling ratings and
// "best for" are left empty on purpose: Gemini writes those in the run. The "typical" values (day boat, Open Water, 10-30 m,
// mild or no current, warm water) are filled in too, so Gemini knows the place is typical and says nothing about its format.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-diving-fill.ts
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
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const defs = factDefsFor('diving');
  const fill = JSON.parse(readFileSync(join(__dirname, 'data', 'diving-fill.json'), 'utf8')) as Record<string, Record<string, string | boolean>>;
  const known = new Set((await db.select({ id: places.id }).from(places)).map((p) => p.id));
  const existing = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'diving'));
  const byPlace = new Map(existing.map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  let rows = 0, cells = 0;
  for (const [placeId, seed] of Object.entries(fill)) {
    if (!known.has(placeId)) { console.log('Skipping unknown place', placeId); continue; }
    const facts = { ...(byPlace.get(placeId) ?? {}) };
    let changed = false;
    for (const [k, v] of Object.entries(seed)) {
      const def = defs.find((d) => d.key === k);
      if (!def) throw new Error(`Unknown diving column ${k} for ${placeId}`);
      const parsed = parseFact(def, v);
      if (!parsed.ok) throw new Error(`${placeId}.${k}: ${parsed.message}`);
      if (facts[k] === undefined || facts[k] === null) { facts[k] = parsed.value; changed = true; cells++; }
    }
    if (!changed) continue;
    await db.insert(placeInterestFacts).values({ placeId, interestKey: 'diving', facts: facts as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    rows++;
  }

  const title = 'Check the drafted snorkeling & diving columns';
  const todos = await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'diving'));
  if (!todos.some((t) => t.title === title)) {
    await db.insert(interestTodos).values({
      interestKey: 'diving', status: 'ready_for_claude', title, source: 'Diving fact sheet, 9 Oct 2026',
      detail: 'How you do it, certification, depth, current, water temperature and signature animals were drafted from general knowledge for 75 places and are not source-checked. Check the headline animals and windows and anything unusual (liveaboard-only, drysuit, strong current) before the Gemini run uses them as ground truth.',
    });
  }
  console.log(`Filled ${cells} cells across ${rows} places.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
