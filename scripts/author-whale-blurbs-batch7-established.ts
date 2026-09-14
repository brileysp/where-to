import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  'basque-country': 'A handful of dedicated operators run trips from ports like Getxo out into the Bay of Biscay\'s deep-water canyons, where fin whales, sperm whales, and pilot whales are regularly seen.',
  namibia: 'Catamaran cruises out of Walvis Bay are built primarily around resident dolphins and seals, with humpback and southern right whales joining as a real seasonal bonus each winter.',
  cornwall: 'A handful of Penzance-based operators run marine-wildlife trips targeting minke whales alongside dolphins, porpoises, and basking sharks, through a long season stretching from late winter into autumn.',
  'puerto-rico': 'A handful of Rincón-based operators run dedicated humpback whale-watching trips each winter, when whales arrive to breed off the island\'s west coast.',
  nyc: 'Humpback whales have returned to feed in the waters just offshore in recent years, with commercial boat tours now running regularly out of Manhattan and the Rockaways each season.',
  'scottish-highlands-skye': 'A handful of operators run regular minke whale trips from the Hebrides each summer, with near-daily sightings reported at peak season from vantage points like Neist Point.',
  'turks-caicos': 'A small, intimate group of operators run humpback whale trips out of Salt Cay and Grand Turk each winter, when thousands of whales pass through the Turks Island Passage to breed.',
  sardinia: 'A dedicated operator has run daily whale-watching trips to Caprera Canyon off the Costa Smeralda since 2009, targeting fin, sperm, and Cuvier\'s beaked whales.',
  algarve: 'Dozens of operators across the coast run whale and dolphin trips with high success rates, with fin and humpback whales passing through on their spring migration.',
};

const MONTHLY: Record<string, string[]> = {
  'basque-country': [
    'Outside the main season, trips into the Bay of Biscay settle to a quieter baseline.', // Jan
    'Outside the main season, trips into the Bay of Biscay settle to a quieter baseline.', // Feb
    'Outside the main season, trips into the Bay of Biscay settle to a quieter baseline.', // Mar
    'Trips into the Bay of Biscay are beginning to pick up as the season starts.', // Apr
    'Whale numbers continue building through the season.', // May
    'Whale numbers continue building through the season.', // Jun
    'Peak season — fin, sperm, and pilot whales are regularly seen on trips into the Bay of Biscay\'s canyons.', // Jul
    'Peak season — fin, sperm, and pilot whales are regularly seen on trips into the Bay of Biscay\'s canyons.', // Aug
    'Peak season — fin, sperm, and pilot whales are regularly seen on trips into the Bay of Biscay\'s canyons.', // Sep
    'Whale numbers remain strong as the season continues.', // Oct
    'Outside the main season, trips into the Bay of Biscay settle to a quieter baseline.', // Nov
    'Outside the main season, trips into the Bay of Biscay settle to a quieter baseline.', // Dec
  ],
  namibia: [
    'Outside the whale season, Walvis Bay\'s cruises focus on the resident dolphin and seal population.', // Jan
    'Outside the whale season, Walvis Bay\'s cruises focus on the resident dolphin and seal population.', // Feb
    'Outside the whale season, Walvis Bay\'s cruises focus on the resident dolphin and seal population.', // Mar
    'Outside the whale season, Walvis Bay\'s cruises focus on the resident dolphin and seal population.', // Apr
    'Outside the whale season, Walvis Bay\'s cruises focus on the resident dolphin and seal population.', // May
    'Whale numbers are beginning to build as the season starts.', // Jun
    'Whale numbers continue building through the season.', // Jul
    'Peak season — humpback and southern right whales join the resident dolphins and seals on Walvis Bay\'s cruises.', // Aug
    'Peak season — humpback and southern right whales join the resident dolphins and seals on Walvis Bay\'s cruises.', // Sep
    'Whale numbers remain strong as the season continues.', // Oct
    'Whale numbers are easing as the season winds down.', // Nov
    'Outside the whale season, Walvis Bay\'s cruises focus on the resident dolphin and seal population.', // Dec
  ],
  cornwall: [
    'Outside the main season, trips settle to a quieter baseline.', // Jan
    'The long season is beginning to pick up, with occasional minke whale sightings.', // Feb
    'Outside the main season, trips settle to a quieter baseline.', // Mar
    'Outside the main season, trips settle to a quieter baseline.', // Apr
    'Whale numbers are building as the main season begins.', // May
    'Whale numbers continue building through the season.', // Jun
    'Peak season — minke whales are a regular sighting alongside dolphins, porpoises, and basking sharks.', // Jul
    'Peak season — minke whales are a regular sighting alongside dolphins, porpoises, and basking sharks.', // Aug
    'Whale numbers remain good as the season continues.', // Sep
    'Whale numbers remain good as the season continues.', // Oct
    'The long season is winding down, with occasional minke whale sightings.', // Nov
    'Outside the main season, trips settle to a quieter baseline.', // Dec
  ],
  'puerto-rico': [
    'Humpback whales are arriving off Rincón as the breeding season builds.', // Jan
    'Peak season — dedicated boat trips run out of Rincón to see breeding humpback whales.', // Feb
    'Peak season — dedicated boat trips run out of Rincón to see breeding humpback whales.', // Mar
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Apr
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // May
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jun
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jul
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Aug
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Sep
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Oct
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Nov
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Dec
  ],
  nyc: [
    'Outside the feeding season, whale sightings settle to a quieter baseline.', // Jan
    'Outside the feeding season, whale sightings settle to a quieter baseline.', // Feb
    'Outside the feeding season, whale sightings settle to a quieter baseline.', // Mar
    'Outside the feeding season, whale sightings settle to a quieter baseline.', // Apr
    'Humpback whales are beginning to arrive to feed in the waters offshore.', // May
    'Whale numbers continue building through the season.', // Jun
    'Whale numbers continue building through the season.', // Jul
    'Peak season — commercial boat tours run regularly out of Manhattan and the Rockaways to see feeding humpback whales.', // Aug
    'Peak season — commercial boat tours run regularly out of Manhattan and the Rockaways to see feeding humpback whales.', // Sep
    'Whale numbers remain good as the season continues.', // Oct
    'Whale numbers remain good as the season continues.', // Nov
    'Whale numbers are easing as the season winds down.', // Dec
  ],
  'scottish-highlands-skye': [
    'Outside the summer season, whale sightings settle to a quieter baseline.', // Jan
    'Outside the summer season, whale sightings settle to a quieter baseline.', // Feb
    'Outside the summer season, whale sightings settle to a quieter baseline.', // Mar
    'Outside the summer season, whale sightings settle to a quieter baseline.', // Apr
    'Minke whale numbers are building as the season begins.', // May
    'Peak season — near-daily minke whale sightings are reported from vantage points like Neist Point.', // Jun
    'Peak season — near-daily minke whale sightings are reported from vantage points like Neist Point.', // Jul
    'Whale numbers remain good as the season continues.', // Aug
    'Whale numbers remain good as the season continues.', // Sep
    'Whale numbers remain good as the season continues.', // Oct
    'Outside the summer season, whale sightings settle to a quieter baseline.', // Nov
    'Outside the summer season, whale sightings settle to a quieter baseline.', // Dec
  ],
  'turks-caicos': [
    'Humpback whales are passing through the Turks Island Passage in strong numbers as the season builds.', // Jan
    'Peak season — thousands of humpback whales pass through the Turks Island Passage to breed.', // Feb
    'Peak season — thousands of humpback whales pass through the Turks Island Passage to breed.', // Mar
    'Whale numbers are easing as the breeding season winds down.', // Apr
    'Whale numbers continue easing as the season winds down.', // May
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jun
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jul
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Aug
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Sep
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Oct
    'Whale numbers are beginning to build again as the season approaches.', // Nov
    'Whale numbers are beginning to build again as the season approaches.', // Dec
  ],
  sardinia: [
    'Outside the main season, trips to Caprera Canyon settle to a quieter baseline.', // Jan
    'Trips to Caprera Canyon are picking up as the season builds.', // Feb
    'Trips to Caprera Canyon are picking up as the season builds.', // Mar
    'Whale numbers continue building through the season.', // Apr
    'Whale numbers continue building through the season.', // May
    'Peak season — fin, sperm, and Cuvier\'s beaked whales are the regular targets of daily trips to Caprera Canyon.', // Jun
    'Peak season — fin, sperm, and Cuvier\'s beaked whales are the regular targets of daily trips to Caprera Canyon.', // Jul
    'Peak season — fin, sperm, and Cuvier\'s beaked whales are the regular targets of daily trips to Caprera Canyon.', // Aug
    'Whale numbers remain good as the season continues.', // Sep
    'Whale numbers remain good as the season continues.', // Oct
    'Outside the main season, trips to Caprera Canyon settle to a quieter baseline.', // Nov
    'Outside the main season, trips to Caprera Canyon settle to a quieter baseline.', // Dec
  ],
  algarve: [
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Jan
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Feb
    'Peak season — fin and humpback whales pass through on their spring migration.', // Mar
    'Peak season — fin and humpback whales pass through on their spring migration.', // Apr
    'Whale numbers are easing as the migration continues.', // May
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Jun
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Jul
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Aug
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Sep
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Oct
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Nov
    'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins.', // Dec
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
