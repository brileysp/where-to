import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  'charleston-savannah': 'The Georgia coast is the only known calving ground for the critically endangered North Atlantic right whale — but the species\' protected status means no commercial boat tours approach them; the whales are here, but the encounter isn\'t.',
  barbados: 'Humpback whales pass along the Barbados Ridge during the North Atlantic migration season. There are no commercial boat tours, but whales are sometimes visible from the cliffs at Animal Flower Cave and North Point.',
  fiji: 'Humpback whales migrate through Fijian waters each winter on their way to breed; a small number of local operators run seasonal whale trips, mostly as an add-on to general boating and diving excursions.',
  'nice-riviera': 'The Pelagos Sanctuary in the nearby Ligurian Sea holds fin, sperm, and pilot whales; a small number of boats, mostly departing from Monaco and Beaulieu-sur-Mer just along the coast, run trips into the sanctuary each summer.',
  falklands: 'Southern right whales, sei whales, and orcas are present in Falklands waters, though whale sightings are mostly incidental to the islands\' penguin- and seabird-focused wildlife tours rather than a dedicated product.',
  seychelles: 'Humpback whales pass through the remote Outer Islands each year, with a small number of specialized operators running dedicated expeditions — a more niche pursuit than the islands\' well-known whale shark season, a different species entirely.',
};

const MONTHLY: Record<string, string[]> = {
  'charleston-savannah': [
    'Right whale mothers and calves are present off the coast in peak numbers, though protected status keeps commercial boats from approaching them.', // Jan
    'Right whale mothers and calves are present off the coast in peak numbers, though protected status keeps commercial boats from approaching them.', // Feb
    'Right whale numbers are easing as the calving season winds down.', // Mar
    'Outside the calving season, right whales have moved on to their northern feeding grounds.', // Apr
    'Outside the calving season, right whales have moved on to their northern feeding grounds.', // May
    'Outside the calving season, right whales have moved on to their northern feeding grounds.', // Jun
    'Outside the calving season, right whales have moved on to their northern feeding grounds.', // Jul
    'Outside the calving season, right whales have moved on to their northern feeding grounds.', // Aug
    'Outside the calving season, right whales have moved on to their northern feeding grounds.', // Sep
    'Outside the calving season, right whales have moved on to their northern feeding grounds.', // Oct
    'Outside the calving season, right whales have moved on to their northern feeding grounds.', // Nov
    'Right whale mothers and calves are beginning to arrive for the calving season, though protected status keeps commercial boats from approaching them.', // Dec
  ],
  barbados: [
    'Humpback whales are passing the island in strong numbers, sometimes visible from the North Point cliffs.', // Jan
    'Peak season — humpback whales are passing the island, sometimes visible from the North Point cliffs.', // Feb
    'Humpback whale numbers are easing as the migration continues.', // Mar
    'Whale numbers are tapering off as the migration season ends.', // Apr
    'Outside the migration season, whale sightings settle to a quieter baseline.', // May
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Jun
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Jul
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Aug
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Sep
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Oct
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Nov
    'Humpback whales are beginning to arrive as the migration season starts.', // Dec
  ],
  fiji: [
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Jan
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Feb
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Mar
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Apr
    'Outside the migration season, whale sightings settle to a quieter baseline.', // May
    'Humpback whales are beginning to arrive as the migration season builds.', // Jun
    'Whale numbers continue building as the season progresses.', // Jul
    'Peak season — humpback whales are present in the strongest numbers.', // Aug
    'Peak season — humpback whales are present in the strongest numbers.', // Sep
    'Whale numbers are easing as the migration season winds down.', // Oct
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Nov
    'Outside the migration season, whale sightings settle to a quieter baseline.', // Dec
  ],
  'nice-riviera': [
    'Outside the boat season, whale sightings settle to a quieter baseline.', // Jan
    'Outside the boat season, whale sightings settle to a quieter baseline.', // Feb
    'Outside the boat season, whale sightings settle to a quieter baseline.', // Mar
    'Outside the boat season, whale sightings settle to a quieter baseline.', // Apr
    'Boats are beginning to run trips into the Pelagos Sanctuary as the season starts.', // May
    'Trips into the Pelagos Sanctuary continue building through the season.', // Jun
    'Peak season — fin, sperm, and pilot whales are the target of regular trips into the Pelagos Sanctuary.', // Jul
    'Peak season — fin, sperm, and pilot whales are the target of regular trips into the Pelagos Sanctuary.', // Aug
    'Trips into the sanctuary continue at a good level as the season winds down.', // Sep
    'Outside the boat season, whale sightings settle to a quieter baseline.', // Oct
    'Outside the boat season, whale sightings settle to a quieter baseline.', // Nov
    'Outside the boat season, whale sightings settle to a quieter baseline.', // Dec
  ],
  falklands: [
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // Jan
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // Feb
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // Mar
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // Apr
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // May
    'Whale numbers are building as the season begins.', // Jun
    'Peak whale season alongside the islands\' wider wildlife-viewing calendar.', // Jul
    'Whale numbers remain strong as the season continues.', // Aug
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // Sep
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // Oct
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // Nov
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.', // Dec
  ],
  seychelles: [
    'Outside the whale season, sightings around the Outer Islands settle to a quieter baseline.', // Jan
    'Outside the whale season, sightings around the Outer Islands settle to a quieter baseline.', // Feb
    'Outside the whale season, sightings around the Outer Islands settle to a quieter baseline.', // Mar
    'Outside the whale season, sightings around the Outer Islands settle to a quieter baseline.', // Apr
    'Outside the whale season, sightings around the Outer Islands settle to a quieter baseline.', // May
    'Outside the whale season, sightings around the Outer Islands settle to a quieter baseline.', // Jun
    'Outside the whale season, sightings around the Outer Islands settle to a quieter baseline.', // Jul
    'Whale numbers are beginning to build as the season starts.', // Aug
    'Whale numbers continue building through the season.', // Sep
    'Peak season — humpback whales are present around the Outer Islands in the strongest numbers.', // Oct
    'Whale numbers are easing as the season winds down.', // Nov
    'Outside the whale season, sightings around the Outer Islands settle to a quieter baseline.', // Dec
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
