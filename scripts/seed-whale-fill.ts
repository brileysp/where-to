// First-draft whale columns for the Whale Watching page (Oct 2026). Safe to re-run: it only fills cells that are
// still empty, so nothing typed on the admin page is ever overwritten.
//
// Data: scripts/data/whale-fill.json, 95 places with a sea, ocean or strait where whales, dolphins or porpoises are
// documented. Written from the existing whale texts and general knowledge, NOT source-checked (drawSourceChecked is
// false everywhere). Inland places and ocean places I could not call are left blank on purpose, for Gemini's
// applicability pass to judge (see prompts/whaleWatching/v1.md). River dolphins are not counted here.
// Likelihood is for a boat trip of a few days at the best time; months are the window; "year-round" when no season.
// Encounter closeness and seasickness are left for the owner to rate.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-whale-fill.ts
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
  const defs = factDefsFor('whaleWatching');
  const fill = JSON.parse(readFileSync(join(__dirname, 'data', 'whale-fill.json'), 'utf8')) as Record<string, Record<string, string | boolean>>;
  const known = new Set((await db.select({ id: places.id }).from(places)).map((p) => p.id));
  const existing = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'whaleWatching'));
  const byPlace = new Map(existing.map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  let rows = 0, cells = 0;
  for (const [placeId, seed] of Object.entries(fill)) {
    if (!known.has(placeId)) { console.log('Skipping unknown place', placeId); continue; }
    const facts = { ...(byPlace.get(placeId) ?? {}) };
    let changed = false;
    for (const [k, v] of Object.entries(seed)) {
      const def = defs.find((d) => d.key === k);
      if (!def) throw new Error(`Unknown whale column ${k} for ${placeId}`);
      const parsed = parseFact(def, v);
      if (!parsed.ok) throw new Error(`${placeId}.${k}: ${parsed.message}`);
      if (facts[k] === undefined || facts[k] === null) { facts[k] = parsed.value; changed = true; cells++; }
    }
    if (!changed) continue;
    await db.insert(placeInterestFacts).values({ placeId, interestKey: 'whaleWatching', facts: facts as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    rows++;
  }

  const todos = await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'whaleWatching'));
  const fillTodo = todos.find((t) => t.title.startsWith('Fill the whale columns'));
  if (fillTodo && fillTodo.status !== 'done') {
    await db.update(interestTodos).set({ status: 'done', doneAt: new Date(), title: 'Whale columns drafted for 95 places', detail: 'Drafted 7 Oct 2026 for the 95 places with a sea or ocean where whales, dolphins or porpoises are documented. Inland places and ocean places I could not call are blank for the applicability pass. Closeness and seasickness are left for you to rate.', updatedAt: new Date() }).where(eq(interestTodos.id, fillTodo.id));
  }
  const title = 'Check the drafted whale columns';
  if (!todos.some((t) => t.title === title)) {
    await db.insert(interestTodos).values({
      interestKey: 'whaleWatching', status: 'ready_for_claude', title, source: 'Whale column fill, 7 Oct 2026',
      detail: 'Likelihoods and month windows come from the existing whale texts and general knowledge, not from sources, and several of those texts were generic. Source-check at least the headline species and windows for the top places first, then the rest. Then build docs/whaleWatching-facts.json from the checked columns for Gemini to use as ground truth.',
    });
  }
  console.log(`Filled ${cells} cells across ${rows} places.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
