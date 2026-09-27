import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const FLAT_TEXT: Record<string, string> = {
  bahamas: 'Sperm whales and other deep-diving species are present in trenches like the Tongue of the Ocean near Andros, though no dedicated whale-watching tour industry exists — sightings happen opportunistically during dive trips.',
  jamaica: 'Humpback whales occasionally pass offshore during the North Atlantic migration season, though sightings are rare and there is no dedicated whale-watching industry here.',
  palau: 'A genuinely diverse range of cetacean species has been documented in Palauan waters, though whale sightings happen incidentally during dive trips rather than through any dedicated whale-watching tours.',
  'papua-new-guinea': 'Orcas and pilot whales are seen in Kimbe Bay as an occasional bonus on dive trips, though there is no dedicated whale-watching tour industry here.',
  'colombian-caribbean': 'The Caribbean coast here sees little regular whale activity; Colombia\'s real whale-watching destination is its Pacific coast, an entirely different stretch of water.',
  'st-andrews-fife': 'Minke whales and dolphins are occasionally spotted on boat trips along this coast, though the trips themselves are marketed around puffins and seabirds rather than whales.',
  hongkong: 'Whales are rare, occasional visitors rather than a regular presence; the city\'s well-known marine-mammal tourism is built around resident Chinese white dolphins, a different species entirely.',
  mallorca: 'Fin and sperm whales pass through the surrounding waters, though sightings are rare and the island\'s boat tours are built around dolphins rather than whales.',
  'milford-sound-fiordland': 'Dolphins are a reliable sighting on the fiord\'s boat cruises; whales pass along the outer coast during their spring-summer migration but rarely enter the fiord itself.',
  aruba: 'Humpback whales pass offshore during the winter migration season, though sightings are unpredictable and there is no dedicated whale-watching tour industry here.',
  bali: 'The boat tours out of Lovina are built around resident spinner dolphins; whale sightings here are rare and incidental rather than a dedicated draw.',
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
