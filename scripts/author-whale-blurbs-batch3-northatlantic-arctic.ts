import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  iceland: 'Minke whales and orcas are present in Iceland\'s fjords year-round. Humpback and blue whales join to feed each summer, from April through October, concentrated particularly around Húsavík in the north.',
  azores: 'Resident sperm whales are present in the deep waters around the Azores year-round. More than 20 other species pass through on migration, with blue and fin whales moving through especially heavily each spring on their way to Arctic feeding grounds.',
  madeira: 'Resident sperm whales are present in the deep waters around Madeira year-round, joined by blue, fin, and sei whales passing through on their spring migration to northern feeding grounds.',
  'quebec-city': 'At Tadoussac, where the Saguenay River meets the St Lawrence, the mixing of fresh and salt water creates a nutrient-rich upwelling that draws beluga, minke, fin, and blue whales each summer.',
  'cape-cod-islands': 'Stellwagen Bank, a National Marine Sanctuary off Cape Cod, is a rich feeding ground for humpback, finback, and right whales, busiest during the spring and autumn migration windows rather than a single midsummer peak.',
  fjords: 'Orca pods follow overwintering herring into Norway\'s fjords each winter, one of the few whale-watching seasons in the world that peaks in the cold months rather than summer.',
  lofoten: 'Sperm whales are present year-round in the deep waters off the Lofoten archipelago, joined by orca pods each winter as they follow overwintering herring into the surrounding waters.',
  svalbard: 'Svalbard is locked in polar night and sea ice through the depths of winter. As the ice retreats each Arctic summer, walrus haul-outs, whales, and seabird cliffs all become accessible.',
  greenland: 'Humpback and minke whales feed in Greenland\'s fjords once the sea ice clears each summer.',
  ireland: 'Fin, minke, and humpback whales feed off Ireland\'s south and west coasts each late summer and autumn as baitfish shoals move close to shore.',
};

const MONTHLY: Record<string, string[]> = {
  iceland: [
    'Resident minke whales and orcas are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Jan
    'Resident minke whales and orcas are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Feb
    'Resident minke whales and orcas are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Mar
    'Peak season — humpback and blue whales join resident minke whales and orcas to feed in Iceland\'s waters.', // Apr
    'Peak season — humpback and blue whales join resident minke whales and orcas to feed in Iceland\'s waters.', // May
    'Peak season — humpback and blue whales join resident minke whales and orcas to feed in Iceland\'s waters.', // Jun
    'Peak season — humpback and blue whales join resident minke whales and orcas to feed in Iceland\'s waters.', // Jul
    'Peak season — humpback and blue whales join resident minke whales and orcas to feed in Iceland\'s waters.', // Aug
    'Peak season — humpback and blue whales join resident minke whales and orcas to feed in Iceland\'s waters.', // Sep
    'Peak season — humpback and blue whales join resident minke whales and orcas to feed in Iceland\'s waters.', // Oct
    'Resident minke whales and orcas are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Nov
    'Resident minke whales and orcas are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Dec
  ],
  azores: [
    'Resident sperm whales are present, though outside the main migration season, sightings settle to a quieter baseline.', // Jan
    'Resident sperm whales are present, though outside the main migration season, sightings settle to a quieter baseline.', // Feb
    'Migrating whale numbers are building as the spring passage begins.', // Mar
    'Peak season — blue and fin whales pass through in large numbers alongside resident sperm whales.', // Apr
    'Peak season — blue and fin whales pass through in large numbers alongside resident sperm whales.', // May
    'Peak season — blue and fin whales pass through in large numbers alongside resident sperm whales.', // Jun
    'Peak season — blue and fin whales pass through in large numbers alongside resident sperm whales.', // Jul
    'Peak season — blue and fin whales pass through in large numbers alongside resident sperm whales.', // Aug
    'Peak season — blue and fin whales pass through in large numbers alongside resident sperm whales.', // Sep
    'Peak season — blue and fin whales pass through in large numbers alongside resident sperm whales.', // Oct
    'Resident sperm whales are present, though outside the main migration season, sightings settle to a quieter baseline.', // Nov
    'Resident sperm whales are present, though outside the main migration season, sightings settle to a quieter baseline.', // Dec
  ],
  madeira: [
    'Resident sperm whales are present, though outside the spring passage, sightings settle to a quieter baseline.', // Jan
    'Resident sperm whales are present, though outside the spring passage, sightings settle to a quieter baseline.', // Feb
    'Blue, fin, and sei whales are passing through on their spring migration, adding to the resident sperm whale population.', // Mar
    'Blue, fin, and sei whales are passing through on their spring migration, adding to the resident sperm whale population.', // Apr
    'Blue, fin, and sei whales are passing through on their spring migration, adding to the resident sperm whale population.', // May
    'Blue, fin, and sei whales are passing through on their spring migration, adding to the resident sperm whale population.', // Jun
    'Resident sperm whales are present, though outside the spring passage, sightings settle to a quieter baseline.', // Jul
    'Resident sperm whales are present, though outside the spring passage, sightings settle to a quieter baseline.', // Aug
    'Resident sperm whales are present, though outside the spring passage, sightings settle to a quieter baseline.', // Sep
    'Resident sperm whales are present, though outside the spring passage, sightings settle to a quieter baseline.', // Oct
    'Resident sperm whales are present, though outside the spring passage, sightings settle to a quieter baseline.', // Nov
    'Resident sperm whales are present, though outside the spring passage, sightings settle to a quieter baseline.', // Dec
  ],
  'quebec-city': [
    'Outside the summer whale season, the St Lawrence estuary at Tadoussac settles to a quieter baseline.', // Jan
    'Outside the summer whale season, the St Lawrence estuary at Tadoussac settles to a quieter baseline.', // Feb
    'Outside the summer whale season, the St Lawrence estuary at Tadoussac settles to a quieter baseline.', // Mar
    'Outside the summer whale season, the St Lawrence estuary at Tadoussac settles to a quieter baseline.', // Apr
    'Whale numbers are building at Tadoussac as the summer season begins.', // May
    'Whale numbers are building at Tadoussac as the summer season begins.', // Jun
    'Peak season — beluga, minke, fin, and blue whales are concentrated at Tadoussac\'s nutrient-rich upwelling.', // Jul
    'Peak season — beluga, minke, fin, and blue whales are concentrated at Tadoussac\'s nutrient-rich upwelling.', // Aug
    'Peak season — beluga, minke, fin, and blue whales are concentrated at Tadoussac\'s nutrient-rich upwelling.', // Sep
    'Whale numbers at Tadoussac are easing as the season winds down.', // Oct
    'Outside the summer whale season, the St Lawrence estuary at Tadoussac settles to a quieter baseline.', // Nov
    'Outside the summer whale season, the St Lawrence estuary at Tadoussac settles to a quieter baseline.', // Dec
  ],
  'cape-cod-islands': [
    'Whales are present at Stellwagen Bank at a steady baseline outside the main migration windows.', // Jan
    'Whales are present at Stellwagen Bank at a steady baseline outside the main migration windows.', // Feb
    'Whales are present at Stellwagen Bank at a steady baseline outside the main migration windows.', // Mar
    'Peak spring season — humpback, finback, and right whales are feeding at Stellwagen Bank.', // Apr
    'Peak spring season — humpback, finback, and right whales are feeding at Stellwagen Bank.', // May
    'Peak spring season — humpback, finback, and right whales are feeding at Stellwagen Bank.', // Jun
    'Whale numbers ease slightly at Stellwagen Bank between the spring and autumn peaks.', // Jul
    'Whale numbers ease slightly at Stellwagen Bank between the spring and autumn peaks.', // Aug
    'Peak autumn season — humpback, finback, and right whales are feeding at Stellwagen Bank.', // Sep
    'Peak autumn season — humpback, finback, and right whales are feeding at Stellwagen Bank.', // Oct
    'Whales are present at Stellwagen Bank at a steady baseline outside the main migration windows.', // Nov
    'Whales are present at Stellwagen Bank at a steady baseline outside the main migration windows.', // Dec
  ],
  fjords: [
    'Peak season — orca pods are following herring shoals into the fjords in large numbers.', // Jan
    'Peak season — orca pods are following herring shoals into the fjords in large numbers.', // Feb
    'Outside the winter herring season, orca sightings in the fjords settle to a quieter baseline.', // Mar
    'Outside the winter herring season, orca sightings in the fjords settle to a quieter baseline.', // Apr
    'Outside the winter herring season, orca sightings in the fjords settle to a quieter baseline.', // May
    'Outside the winter herring season, orca sightings in the fjords settle to a quieter baseline.', // Jun
    'Outside the winter herring season, orca sightings in the fjords settle to a quieter baseline.', // Jul
    'Outside the winter herring season, orca sightings in the fjords settle to a quieter baseline.', // Aug
    'Outside the winter herring season, orca sightings in the fjords settle to a quieter baseline.', // Sep
    'Outside the winter herring season, orca sightings in the fjords settle to a quieter baseline.', // Oct
    'Peak season — orca pods are following herring shoals into the fjords in large numbers.', // Nov
    'Peak season — orca pods are following herring shoals into the fjords in large numbers.', // Dec
  ],
  lofoten: [
    'Orca pods are following herring shoals into the waters around Lofoten, adding to the resident sperm whale population.', // Jan
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // Feb
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // Mar
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // Apr
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // May
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // Jun
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // Jul
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // Aug
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // Sep
    'Resident sperm whales are present in the deep waters off Lofoten, at a steady baseline.', // Oct
    'Orca pods are following herring shoals into the waters around Lofoten, adding to the resident sperm whale population.', // Nov
    'Orca pods are following herring shoals into the waters around Lofoten, adding to the resident sperm whale population.', // Dec
  ],
  svalbard: [
    'Svalbard is in polar night; sea ice makes wildlife viewing effectively impossible.', // Jan
    'Sea ice still limits access this time of year; whale sightings are modest.', // Feb
    'Sea ice still limits access this time of year; whale sightings are modest.', // Mar
    'Sea ice still limits access this time of year; whale sightings are modest.', // Apr
    'Sea ice still limits access this time of year; whale sightings are modest.', // May
    'The open-water season is beginning, bringing whales and walrus haul-outs within reach.', // Jun
    'Peak open-water season — whales, walrus haul-outs, and seabird cliffs are all accessible.', // Jul
    'Peak open-water season — whales, walrus haul-outs, and seabird cliffs are all accessible.', // Aug
    'The open-water season is winding down as ice begins reforming.', // Sep
    'Sea ice is returning; whale sightings are modest this time of year.', // Oct
    'Sea ice is returning; whale sightings are modest this time of year.', // Nov
    'Svalbard is in polar night; sea ice makes wildlife viewing effectively impossible.', // Dec
  ],
  greenland: [
    'Sea ice limits access to the fjords this time of year; whale sightings settle to a quieter baseline.', // Jan
    'Sea ice limits access to the fjords this time of year; whale sightings settle to a quieter baseline.', // Feb
    'Sea ice limits access to the fjords this time of year; whale sightings settle to a quieter baseline.', // Mar
    'Sea ice limits access to the fjords this time of year; whale sightings settle to a quieter baseline.', // Apr
    'Sea ice limits access to the fjords this time of year; whale sightings settle to a quieter baseline.', // May
    'Whale numbers are building in the fjords as the ice-free season begins.', // Jun
    'Peak season — humpback and minke whales are feeding throughout Greenland\'s ice-free fjords.', // Jul
    'Peak season — humpback and minke whales are feeding throughout Greenland\'s ice-free fjords.', // Aug
    'Whale numbers in the fjords are easing as the season winds down.', // Sep
    'Sea ice limits access to the fjords this time of year; whale sightings settle to a quieter baseline.', // Oct
    'Sea ice limits access to the fjords this time of year; whale sightings settle to a quieter baseline.', // Nov
    'Sea ice limits access to the fjords this time of year; whale sightings settle to a quieter baseline.', // Dec
  ],
  ireland: [
    'Outside the main feeding season, whale sightings off the Irish coast settle to a quieter baseline.', // Jan
    'Outside the main feeding season, whale sightings off the Irish coast settle to a quieter baseline.', // Feb
    'Outside the main feeding season, whale sightings off the Irish coast settle to a quieter baseline.', // Mar
    'Outside the main feeding season, whale sightings off the Irish coast settle to a quieter baseline.', // Apr
    'Outside the main feeding season, whale sightings off the Irish coast settle to a quieter baseline.', // May
    'Outside the main feeding season, whale sightings off the Irish coast settle to a quieter baseline.', // Jun
    'Whale numbers are building off the coast as baitfish shoals begin arriving.', // Jul
    'Peak season — fin, minke, and humpback whales are feeding on baitfish shoals close to shore.', // Aug
    'Peak season — fin, minke, and humpback whales are feeding on baitfish shoals close to shore.', // Sep
    'Whale numbers off the coast are easing as the season winds down.', // Oct
    'Outside the main feeding season, whale sightings off the Irish coast settle to a quieter baseline.', // Nov
    'Outside the main feeding season, whale sightings off the Irish coast settle to a quieter baseline.', // Dec
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
