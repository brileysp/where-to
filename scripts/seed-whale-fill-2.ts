// Second whale column fill (7 Oct 2026). Safe to re-run: only fills cells that are still empty.
//  - scripts/data/whale-fill-2.json: species, boat style and draw for the places that had none (41 places)
//  - scripts/data/whale-seasick.json: a 0-10 seasickness rating for every whale place that is not N/A
// Drafted from the live whale text and general knowledge, plus web checks for the roughest and best-known trips
// (Mirissa, Monterey Bay, Husavik, the Drake Passage, Maui, the Bay of Fundy). Not source-checked.
import { readFileSync } from 'fs';
import { join } from 'path';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

async function main() {
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const defs = factDefsFor('whaleWatching');
  const fill = JSON.parse(readFileSync(join(__dirname, 'data', 'whale-fill-2.json'), 'utf8')) as Record<string, Record<string, string>>;
  const sick = JSON.parse(readFileSync(join(__dirname, 'data', 'whale-seasick.json'), 'utf8')) as Record<string, { rating: number }>;
  const known = new Set((await db.select({ id: places.id }).from(places)).map((p) => p.id));
  const existing = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'whaleWatching'));
  const byPlace = new Map(existing.map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  const merged: Record<string, Record<string, unknown>> = {};
  for (const [id, seed] of Object.entries(fill)) merged[id] = { ...seed };
  for (const [id, s] of Object.entries(sick)) merged[id] = { ...(merged[id] ?? {}), seasick: s.rating };
  let rows = 0, cells = 0;
  for (const [placeId, seed] of Object.entries(merged)) {
    if (!known.has(placeId)) { console.log('Skipping unknown place', placeId); continue; }
    const facts = { ...(byPlace.get(placeId) ?? {}) };
    let changed = false;
    for (const [k, v] of Object.entries(seed)) {
      const def = defs.find((d) => d.key === k);
      if (!def) throw new Error(`Unknown whale column ${k} for ${placeId}`);
      const parsed = parseFact(def, v);
      if (!parsed.ok) throw new Error(`${placeId}.${k}: ${parsed.message}`);
      if (facts[k] === undefined || facts[k] === null || (typeof facts[k] === 'string' && (facts[k] as string).trim() === '')) { facts[k] = parsed.value; changed = true; cells++; }
    }
    if (!changed) continue;
    await db.insert(placeInterestFacts).values({ placeId, interestKey: 'whaleWatching', facts: facts as never })
      .onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    rows++;
  }
  console.log(`Filled ${cells} cells across ${rows} places.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
