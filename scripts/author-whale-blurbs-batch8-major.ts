import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  borabora: 'Humpback whales arrive each winter to breed in the sheltered waters around the island, with dedicated local operators running swim-with-whales tours through the season.',
  andalucia: 'Tarifa is one of Europe\'s best-known whale-watching hubs, with multiple operators running daily trips into the Strait of Gibraltar to see orcas, pilot whales, and sperm whales.',
  sydney: 'Around 40,000 humpback whales migrate past Sydney Heads each year, supporting a large, established fleet of tour operators — one has run harbor whale-watching cruises for over 55 years.',
};

const MONTHLY: Record<string, string[]> = {
  borabora: [
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jan
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Feb
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Mar
    'Whale numbers are beginning to build ahead of the season.', // Apr
    'Whale numbers are beginning to build ahead of the season.', // May
    'Whale numbers are beginning to build ahead of the season.', // Jun
    'Humpback whales are arriving to breed, with dedicated swim tours running through the island\'s sheltered waters.', // Jul
    'Humpback whales are arriving to breed, with dedicated swim tours running through the island\'s sheltered waters.', // Aug
    'Peak season — dedicated swim-with-whales tours run daily through the island\'s sheltered waters.', // Sep
    'Peak season — dedicated swim-with-whales tours run daily through the island\'s sheltered waters.', // Oct
    'Whale numbers are easing as the breeding season winds down.', // Nov
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Dec
  ],
  andalucia: [
    'Outside the main season, trips into the Strait of Gibraltar settle to a quieter baseline.', // Jan
    'Outside the main season, trips into the Strait of Gibraltar settle to a quieter baseline.', // Feb
    'Outside the main season, trips into the Strait of Gibraltar settle to a quieter baseline.', // Mar
    'Whale numbers are building as the season progresses.', // Apr
    'Whale numbers are building as the season progresses.', // May
    'Whale numbers are building as the season progresses.', // Jun
    'Peak season — orcas hunt migrating tuna in the Strait of Gibraltar, alongside pilot and sperm whales.', // Jul
    'Peak season — orcas hunt migrating tuna in the Strait of Gibraltar, alongside pilot and sperm whales.', // Aug
    'Peak season — orcas hunt migrating tuna in the Strait of Gibraltar, alongside pilot and sperm whales.', // Sep
    'Whale numbers remain strong as the season continues.', // Oct
    'Outside the main season, trips into the Strait of Gibraltar settle to a quieter baseline.', // Nov
    'Outside the main season, trips into the Strait of Gibraltar settle to a quieter baseline.', // Dec
  ],
  sydney: [
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Jan
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Feb
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Mar
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Apr
    'Whale numbers are building as the northbound migration begins.', // May
    'Peak northbound migration — humpback whales pass Sydney Heads in the strongest numbers heading toward tropical breeding grounds.', // Jun
    'Peak northbound migration — humpback whales pass Sydney Heads in the strongest numbers heading toward tropical breeding grounds.', // Jul
    'Whale numbers ease slightly between the two migration pulses.', // Aug
    'Whale numbers ease slightly between the two migration pulses.', // Sep
    'Peak southbound migration — humpback whales, including mothers with calves, pass Sydney Heads heading back to Antarctic feeding grounds.', // Oct
    'Whale numbers are easing as the migration season winds down.', // Nov
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Dec
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
