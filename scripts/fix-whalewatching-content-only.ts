import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  // Jeffreys Ledge is a Boston/Gloucester/Portsmouth feeding ground —
  // geographically incompatible with Bar Harbor boats' real range. The
  // actual named ground Bar Harbor operators run to is Mount Desert Rock.
  acadia: "The Gulf of Maine holds some of the highest whale concentrations in the world, and Bar Harbor's established fleet runs regular trips out to feeding grounds like Mount Desert Rock each season.",
  // A 2010 ocean regime shift pushed roughly a third of the North Atlantic
  // right whale population's summer feeding into the Gulf of St. Lawrence;
  // Fundy sightings of the species have declined substantially since.
  'nova-scotia': "The Bay of Fundy's extreme tides drive nutrient-rich upwelling that concentrates prey, drawing humpback and minke whales to feed each summer. The endangered North Atlantic right whale used to rely heavily on the bay too, but a 2010 shift in ocean conditions pushed much of the population's summer feeding into the Gulf of St. Lawrence instead — a right whale sighting here is now a real bonus, not something to expect.",
  // The herring run (and the orcas following it) has genuinely shifted
  // north since ~2022 to Tromsø/Skjervøy/Senja/Vesterålen; Lofoten's own
  // "resident sperm whale" claim more accurately belongs to neighboring
  // Andenes/Vesterålen (Bleiksdjupet canyon).
  lofoten: "Sperm whales are a real, if secondary, sighting in the deep waters off the Lofoten archipelago (neighboring Andenes/Vesterålen is the more reliable bet for them specifically). The famous winter orca show has shifted north in recent years too — since around 2022, the herring runs the orcas follow have moved to Tromsø, Skjervøy, and the wider Vesterålen area, making those a more reliable choice for orcas than Lofoten today.",
  // The real gray whale calving lagoons (San Ignacio, Ojo de Liebre,
  // Magdalena Bay) are ~270km/5-6hrs north up the Baja peninsula — a
  // separate trip, not something visible from Los Cabos itself. Humpback
  // breeding right off the Cape is the genuinely close, real encounter.
  'los-cabos': "Humpback whales breed right off Los Cabos' own coast each winter — a genuine, close encounter. The famous gray whale calving lagoons (San Ignacio, Ojo de Liebre, Magdalena Bay) are a separate trip, though — roughly 270km/5-6 hours north up the Baja peninsula, not something seen from Los Cabos itself.",
  // Real sperm-whale sightings at the Strait of Messina are documented as
  // historically irregular, not a dependable in-season sighting.
  sicily: "The Strait of Messina is a real historic migration corridor for sperm whales, but sightings there are documented as irregular rather than dependable — actual whale-watching tourism is centered on operators from Catania and the Aeolian Islands, where an encounter is a genuine possibility, not a sure thing.",
  // No credible source supports an actual season here — sightings are
  // rare/incidental (a 2011 Turneffe Atoll sighting is literally described
  // as "a truly rare sighting"). Rewritten to match the honest,
  // non-seasonal framing Aruba/Bahamas already use.
  belize: "Humpback whales occasionally pass through Belizean waters each winter, but sightings are genuinely rare and incidental rather than a real season — the country's far more reliable marine draw is its whale shark season.",
};

const MONTHLY: Record<string, string[]> = {
  acadia: [
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
    "Bar Harbor's fleet is beginning its season as whale numbers build.",
    'Whale numbers continue building toward the peak.',
    "Peak season — Bar Harbor's fleet runs regular trips out to feeding grounds like Mount Desert Rock.",
    "Peak season — Bar Harbor's fleet runs regular trips out to feeding grounds like Mount Desert Rock.",
    "Peak season — Bar Harbor's fleet runs regular trips out to feeding grounds like Mount Desert Rock.",
    'Whale numbers are easing as the season winds down.',
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
  ],
  'nova-scotia': [
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.',
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.',
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.',
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.',
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.',
    'Humpback and minke whales are arriving in the Bay of Fundy to feed as the tidal upwelling builds.',
    "Whale numbers continue building in the Bay of Fundy's nutrient-rich waters.",
    'Peak feeding season — humpback and minke whales are concentrated in the Bay of Fundy; North Atlantic right whales are a real but increasingly rare bonus here since the species shifted much of its summer feeding to the Gulf of St. Lawrence.',
    "Peak feeding season continues in the Bay of Fundy's nutrient-rich waters.",
    "Whale numbers in the Bay of Fundy are easing as the feeding season winds down.",
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.',
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.',
  ],
  lofoten: [
    'Orca sightings are possible here, though the reliable herring-driven show has shifted north to Tromsø and Vesterålen in recent years; sperm whales remain a real, secondary sighting.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Resident sperm whales are a real, secondary sighting in the deep waters off Lofoten.',
    'Orca sightings are possible here, though the reliable herring-driven show has shifted north to Tromsø and Vesterålen in recent years; sperm whales remain a real, secondary sighting.',
    'Orca sightings are possible here, though the reliable herring-driven show has shifted north to Tromsø and Vesterålen in recent years; sperm whales remain a real, secondary sighting.',
  ],
  'los-cabos': [
    "Peak season — humpback whales are breeding right off Los Cabos' own coast; gray whales are calving in the lagoons further north up the peninsula, a separate trip.",
    "Peak season — humpback whales are breeding right off Los Cabos' own coast; gray whales are calving in the lagoons further north up the peninsula, a separate trip.",
    "Peak season — humpback whales are breeding right off Los Cabos' own coast; gray whales are calving in the lagoons further north up the peninsula, a separate trip.",
    "Peak season — humpback whales are breeding right off Los Cabos' own coast; gray whales are calving in the lagoons further north up the peninsula, a separate trip.",
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.',
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.',
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.',
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.',
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.',
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.',
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.',
    'Humpback whales are beginning to arrive off Los Cabos for the breeding season; gray whales are also arriving at the lagoons further north.',
  ],
  sicily: [
    'Outside the main season, sightings around Catania and the Aeolian Islands settle to a quiet baseline.',
    'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers continue building through the season.',
    'Whale numbers continue building through the season.',
    'Whale numbers continue building through the season.',
    'Peak season — sperm whales are a real, if irregular, sighting on trips from Catania and the Aeolian Islands.',
    'Peak season — sperm whales are a real, if irregular, sighting on trips from Catania and the Aeolian Islands.',
    'Whale numbers are easing as the season winds down.',
    'Whale numbers are easing as the season winds down.',
    'Outside the main season, sightings around Catania and the Aeolian Islands settle to a quiet baseline.',
    'Outside the main season, sightings around Catania and the Aeolian Islands settle to a quiet baseline.',
  ],
  belize: [
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
    'Humpback whales occasionally pass through Belizean waters this time of year, though sightings remain rare and incidental.',
  ],
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const missing: string[] = [];
  for (const id of Object.keys(OVERVIEWS)) {
    if (!MONTHLY[id] || MONTHLY[id].length !== 12) missing.push(id);
  }
  if (missing.length) { console.error('Bad monthly arrays:', missing); process.exit(1); }

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: MONTHLY[id] },
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
