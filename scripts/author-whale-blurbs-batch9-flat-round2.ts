import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const FLAT_TEXT: Record<string, string> = {
  komodo: 'Whale sharks and manta rays are the real marine draw here; the region\'s actual whale migration corridor, the Alor/Pantar Strait, lies hundreds of kilometers east and isn\'t reachable from Komodo tourism.',
  palawan: 'The Philippines\' real cetacean sanctuary, the Tañon Strait, lies in an entirely different island group hundreds of kilometers away; Palawan\'s own waters see little regular whale activity.',
  'belfast-giants-causeway': 'Minke whales are occasionally seen on boat trips along this coast, though operators are explicit that sightings are rare and never guaranteed — the trips themselves are built around puffins, seals, and seabirds.',
  kerala: 'Blue whale vocalizations have been scientifically documented off this coast in recent years, but no commercial whale-watching tours have been built around the discovery — the whales are real, the tourism isn\'t.',
  'douro-valley-porto': 'No credible whale-watching tourism exists along this stretch of coast; Portugal\'s real whale destinations are the Azores and Madeira, separate Atlantic islands reached by a further flight.',
  croatia: 'Fin whales wander into the Adriatic only rarely, as isolated, newsworthy events rather than a predictable season; the coast\'s real, reliable marine-tourism draw is resident bottlenose dolphins.',
  amalfi: 'Dolphins are the real, reliable sighting on boat trips along this coast; whale sightings happen only as a rare, incidental bonus.',
  ghana: 'Humpback whales migrate along this stretch of West African coast each year, though — unlike neighboring Gabon — no established local tour operator has been built around them.',
  'hudson-valley': 'The real story behind this river\'s recent whale sightings is happening downstream, in New York Harbor, where a rebounding baitfish population draws feeding humpbacks; that activity doesn\'t reach the upriver valley itself.',
  rivieramaya: 'This coast is genuinely famous for whale sharks, a filter-feeding fish rather than a whale — actual cetacean sightings here are rare, with real Mexican humpback and gray whale tourism concentrated instead on the Pacific side, in Baja.',
  santorini: 'Sperm whales occasionally venture close to the Cyclades\' steep offshore depths, though no dedicated whale-watching tour industry has developed around them here.',
  egypt: 'Dolphins, not whales, are the reliable marine-mammal sighting along this coast; whale species like the Bryde\'s whale are documented but genuinely rare.',
  'tokyo-kyoto': 'Japan\'s real whale-watching destinations — Hokkaido, Okinawa, the Ogasawara Islands — all require a separate multi-day trip; nothing comparable exists within reach of Tokyo or Kyoto themselves.',
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try { raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8'); } catch { return out; }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, text] of Object.entries(FLAT_TEXT)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: text },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: Array(12).fill(text) },
    };
    console.log(`  ${id}`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
