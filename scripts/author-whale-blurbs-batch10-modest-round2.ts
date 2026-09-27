import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  bordeaux: 'The Bay of Biscay nearby is a genuinely productive whale sea — over 20 cetacean species recorded — though Arcachon\'s own boat tours lean toward dolphins rather than dedicated whale trips.',
  barcelona: 'Fin whales pass through deep water off the Catalan coast, drawn by submarine-canyon upwellings, with a small number of licensed operators running trips each spring.',
  havana: 'Humpback whales pass through Cuban waters each winter, though the island\'s real marine-tourism draw remains its reefs rather than a dedicated whale-watching industry.',
  belize: 'Humpback whales pass through Belizean waters each winter, a secondary draw alongside the country\'s far more prominent whale shark season.',
  vietnam: 'A family group of Bryde\'s whales has been repeatedly sighted near Quy Nhơn since 2022, a genuinely new and still-developing story rather than an established tour industry.',
  oaxaca: 'Humpback whales breed along Oaxaca\'s Pacific coast each winter, with a real, government-regulated tour industry based in Huatulco — though this is coastal, a distinct area from Oaxaca\'s inland colonial city.',
  olympic: 'Gray whales pass along this coast during their migration, visible from signed shore viewpoints at La Push and Kalaloch — there are no boat tours departing from the park itself.',
  rajaampat: 'Bryde\'s, Omura\'s, and sperm whales pass through the Dampier Strait, with a small number of specialized liveaboard operators building dedicated whale-watching itineraries around the migration.',
  lisbon: 'Bottlenose dolphins are the reliable year-round sighting from Sesimbra, just outside Lisbon, with minke, fin, and sei whales passing through as a real, if secondary, seasonal addition.',
  tuscany: 'The Tuscan Archipelago sits within the Pelagos Sanctuary, where fin and sperm whales are a real, if occasional, sighting alongside the more reliable resident dolphins.',
  sicily: 'The Strait of Messina is a genuine migration corridor for sperm whales, though actual sightings are concentrated at operators based in nearby Catania and the Aeolian Islands rather than in the Strait itself.',
  nicaragua: 'Humpback whales pass along Nicaragua\'s Pacific coast each winter, with a small, real tour scene based around San Juan del Sur.',
  provence: 'The Pelagos Sanctuary reaches the waters off Marseille and Cassis, where certified operators run trips to see fin, sperm, and pilot whales each summer.',
};

const MONTHLY: Record<string, string[]> = {
  bordeaux: [
    'Outside the main season, trips into the Bay of Biscay settle to a quiet baseline.', 'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.', 'Whale numbers continue building through the season.',
    'Whale numbers continue building through the season.', 'Whale numbers continue building through the season.',
    'Peak season — fin whales are a real sighting on trips into the Bay of Biscay.', 'Peak season — fin whales are a real sighting on trips into the Bay of Biscay.',
    'Whale numbers are easing as the season winds down.', 'Whale numbers are easing as the season winds down.',
    'Outside the main season, trips into the Bay of Biscay settle to a quiet baseline.', 'Outside the main season, trips into the Bay of Biscay settle to a quiet baseline.',
  ],
  barcelona: [
    'Outside the main season, sightings settle to a quiet baseline.', 'Fin whale numbers are building as the spring season begins.',
    'Peak season — fin whales pass through the deep water off the Catalan coast.', 'Peak season — fin whales pass through the deep water off the Catalan coast.',
    'Peak season — fin whales pass through the deep water off the Catalan coast.', 'Whale numbers are easing as the season winds down.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
  ],
  havana: [
    'Humpback whales are passing through Cuban waters as the season builds.', 'Peak season — humpback whales pass through Cuban waters.',
    'Peak season — humpback whales pass through Cuban waters.', 'Whale numbers are easing as the season winds down.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.', 'Humpback whales are passing through Cuban waters as the season builds.',
  ],
  belize: [
    'Peak season — humpback whales pass through Belizean waters.', 'Peak season — humpback whales pass through Belizean waters.',
    'Peak season — humpback whales pass through Belizean waters.', 'Whale numbers are easing as the season winds down.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Whale numbers are beginning to build as the season approaches.',
  ],
  vietnam: [
    'Outside the recent sighting window, whale presence here is unconfirmed and inconsistent.', 'Outside the recent sighting window, whale presence here is unconfirmed and inconsistent.',
    'Outside the recent sighting window, whale presence here is unconfirmed and inconsistent.', 'Outside the recent sighting window, whale presence here is unconfirmed and inconsistent.',
    'Outside the recent sighting window, whale presence here is unconfirmed and inconsistent.', 'The Bryde\'s whale family group has been repeatedly sighted near Quy Nhơn in recent years during this month.',
    'The Bryde\'s whale family group has been repeatedly sighted near Quy Nhơn in recent years during this month.', 'Sightings become less consistent outside the main recent window.',
    'Whale presence here is unconfirmed and inconsistent this time of year.', 'Whale presence here is unconfirmed and inconsistent this time of year.',
    'Whale presence here is unconfirmed and inconsistent this time of year.', 'Outside the recent sighting window, whale presence here is unconfirmed and inconsistent.',
  ],
  oaxaca: [
    'Peak season — humpback whales are breeding along the coast near Huatulco.', 'Peak season — humpback whales are breeding along the coast near Huatulco.',
    'Peak season — humpback whales are breeding along the coast near Huatulco.', 'Whale numbers are easing as the breeding season winds down.',
    'Whale numbers are easing as the breeding season winds down.', 'Outside the breeding season, sightings settle to a quiet baseline.',
    'Outside the breeding season, sightings settle to a quiet baseline.', 'Outside the breeding season, sightings settle to a quiet baseline.',
    'Outside the breeding season, sightings settle to a quiet baseline.', 'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.', 'Humpback whales are arriving along the coast near Huatulco.',
  ],
  olympic: [
    'Outside the migration windows, whale sightings from shore settle to a quiet baseline.', 'Outside the migration windows, whale sightings from shore settle to a quiet baseline.',
    'The northbound gray whale migration is passing this stretch of coast, visible from shore.', 'The northbound gray whale migration is passing this stretch of coast, visible from shore.',
    'The northbound gray whale migration is passing this stretch of coast, visible from shore.', 'Outside the migration windows, whale sightings from shore settle to a quiet baseline.',
    'Outside the migration windows, whale sightings from shore settle to a quiet baseline.', 'Outside the migration windows, whale sightings from shore settle to a quiet baseline.',
    'Outside the migration windows, whale sightings from shore settle to a quiet baseline.', 'The southbound gray whale migration is passing this stretch of coast, visible from shore.',
    'The southbound gray whale migration is passing this stretch of coast, visible from shore.', 'Outside the migration windows, whale sightings from shore settle to a quiet baseline.',
  ],
  rajaampat: [
    'Peak season — Bryde\'s, Omura\'s, and sperm whales pass through the Dampier Strait.', 'Peak season — Bryde\'s, Omura\'s, and sperm whales pass through the Dampier Strait.',
    'Whale numbers are easing as the season winds down.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Whale numbers are beginning to build as the season approaches.', 'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.', 'Whale numbers continue building ahead of the peak season.',
  ],
  lisbon: [
    'Resident bottlenose dolphins are the reliable sighting; whale season hasn\'t begun.', 'Resident bottlenose dolphins are the reliable sighting; whale season hasn\'t begun.',
    'Minke, fin, and sei whales are beginning to pass through as the season builds.', 'Whale numbers continue building through the season.',
    'Peak season — minke, fin, and sei whales are a real, if secondary, sighting alongside the resident dolphins.', 'Peak season — minke, fin, and sei whales are a real, if secondary, sighting alongside the resident dolphins.',
    'Peak season — minke, fin, and sei whales are a real, if secondary, sighting alongside the resident dolphins.', 'Whale numbers are easing as the season winds down.',
    'Resident bottlenose dolphins are the reliable sighting; whale sightings are less frequent.', 'Resident bottlenose dolphins are the reliable sighting; whale sightings are less frequent.',
    'Resident bottlenose dolphins are the reliable sighting; whale season has ended.', 'Resident bottlenose dolphins are the reliable sighting; whale season hasn\'t begun.',
  ],
  tuscany: [
    'Outside the main season, sightings around the Tuscan Archipelago settle to a quiet baseline.', 'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.', 'Whale numbers continue building through the season.',
    'Whale numbers continue building through the season.', 'Whale numbers continue building through the season.',
    'Peak season — fin and sperm whales are a real, if occasional, sighting alongside the resident dolphins.', 'Peak season — fin and sperm whales are a real, if occasional, sighting alongside the resident dolphins.',
    'Whale numbers are easing as the season winds down.', 'Whale numbers are easing as the season winds down.',
    'Outside the main season, sightings around the Tuscan Archipelago settle to a quiet baseline.', 'Outside the main season, sightings around the Tuscan Archipelago settle to a quiet baseline.',
  ],
  sicily: [
    'Outside the main season, sightings around Catania and the Aeolian Islands settle to a quiet baseline.', 'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.', 'Whale numbers continue building through the season.',
    'Whale numbers continue building through the season.', 'Whale numbers continue building through the season.',
    'Peak season — sperm whales are a real sighting on trips from Catania and the Aeolian Islands.', 'Peak season — sperm whales are a real sighting on trips from Catania and the Aeolian Islands.',
    'Whale numbers are easing as the season winds down.', 'Whale numbers are easing as the season winds down.',
    'Outside the main season, sightings around Catania and the Aeolian Islands settle to a quiet baseline.', 'Outside the main season, sightings around Catania and the Aeolian Islands settle to a quiet baseline.',
  ],
  nicaragua: [
    'Peak season — humpback whales pass along the Pacific coast near San Juan del Sur.', 'Peak season — humpback whales pass along the Pacific coast near San Juan del Sur.',
    'Peak season — humpback whales pass along the Pacific coast near San Juan del Sur.', 'Whale numbers are easing as the season winds down.',
    'Whale numbers are easing as the season winds down.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Outside the main season, sightings settle to a quiet baseline.', 'Outside the main season, sightings settle to a quiet baseline.',
    'Whale numbers are beginning to build as the season approaches.', 'Humpback whales are arriving along the Pacific coast near San Juan del Sur.',
  ],
  provence: [
    'Outside the main season, trips into the Pelagos Sanctuary settle to a quiet baseline.', 'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.', 'Whale numbers continue building through the season.',
    'Whale numbers continue building through the season.', 'Peak season — fin, sperm, and pilot whales are a real sighting on trips off Marseille and Cassis.',
    'Peak season — fin, sperm, and pilot whales are a real sighting on trips off Marseille and Cassis.', 'Peak season — fin, sperm, and pilot whales are a real sighting on trips off Marseille and Cassis.',
    'Whale numbers are easing as the season winds down.', 'Whale numbers are easing as the season winds down.',
    'Outside the main season, trips into the Pelagos Sanctuary settle to a quiet baseline.', 'Outside the main season, trips into the Pelagos Sanctuary settle to a quiet baseline.',
  ],
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

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
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
