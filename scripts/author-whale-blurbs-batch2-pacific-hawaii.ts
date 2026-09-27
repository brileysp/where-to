import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  antarctica: 'Antarctica is only reachable by ship from November through March; within that window, whale sightings build as retreating sea ice and krill blooms draw humpback, minke, and orca whales, peaking later in the season.',
  'costa-rica': 'Costa Rica\'s Pacific coast sees two separate humpback whale populations at different times of year — one arriving from the Southern Hemisphere to breed from July through October, another from the Northern Hemisphere from December through March — giving it one of the longest whale-watching seasons in the world.',
  srilanka: 'Blue whales migrate close to Sri Lanka\'s southern coast each winter, one of the most reliable places in the world to see the largest animal on Earth.',
  'monterey-big-sur': 'Monterey Bay\'s deep underwater canyon brings whales close to shore nearly year-round. Gray whales pass twice annually on their migration between Arctic feeding grounds and Baja breeding lagoons, with April-May and October-November bringing an extra surge as mothers and calves travel closer to shore.',
  'vancouver-island': 'Resident and transient orca pods are present in the waters around Vancouver Island year-round. Humpback and gray whales join to feed each summer, from roughly May through October.',
  'southeast-alaska': 'Humpback whales use bubble-net feeding — a cooperative technique unique to a handful of populations worldwide — to corral herring in the waters of the Inside Passage each summer.',
  'los-cabos': 'Baja California\'s sheltered lagoons are the primary calving grounds for Pacific gray whales, and humpback whales breed in the same waters — a rare overlap of two species\' breeding grounds in one place.',
  maui: 'Humpback whales migrate to Hawaii\'s waters each winter to breed and calve, with the channel between Maui, Lanai, and Molokai one of the densest concentrations in the state.',
  'big-island': 'Humpback whales migrate to Hawaii\'s waters each winter to breed and calve, present along the Big Island\'s open coastline throughout the winter season.',
  'punta-cana': 'Samaná Bay, on the Dominican Republic\'s north coast, is one of the most important humpback whale breeding grounds in the North Atlantic, drawing thousands of whales each winter.',
};

const MONTHLY: Record<string, string[]> = {
  antarctica: [
    'Whale sightings are building as the sailing season progresses, with humpback, minke, and orca present.', // Jan
    'Peak whale season — retreating sea ice and krill blooms concentrate humpback, minke, and orca whales.', // Feb
    'Peak whale season continues as sea ice retreats further, concentrating humpback, minke, and orca whales.', // Mar
    'Antarctica is not reachable by ship this time of year; sea ice closes off the peninsula entirely.', // Apr
    'Antarctica is not reachable by ship this time of year; sea ice closes off the peninsula entirely.', // May
    'Antarctica is not reachable by ship this time of year; sea ice closes off the peninsula entirely.', // Jun
    'Antarctica is not reachable by ship this time of year; sea ice closes off the peninsula entirely.', // Jul
    'Antarctica is not reachable by ship this time of year; sea ice closes off the peninsula entirely.', // Aug
    'Antarctica is not reachable by ship this time of year; sea ice closes off the peninsula entirely.', // Sep
    'Antarctica is not reachable by ship this time of year; sea ice closes off the peninsula entirely.', // Oct
    'The sailing season is beginning; whale sightings are present but not yet at their peak.', // Nov
    'Whale sightings are present as the season continues, though not yet at their peak.', // Dec
  ],
  'costa-rica': [
    'Peak Northern Hemisphere humpback season along the Pacific coast.', // Jan
    'Peak Northern Hemisphere humpback season along the Pacific coast.', // Feb
    'Northern Hemisphere humpback whales remain present as their breeding season winds down.', // Mar
    'Outside either humpback season, whale sightings along the Pacific coast settle to a quieter baseline.', // Apr
    'Outside either humpback season, whale sightings along the Pacific coast settle to a quieter baseline.', // May
    'Outside either humpback season, whale sightings along the Pacific coast settle to a quieter baseline.', // Jun
    'Southern Hemisphere humpback whales are arriving to begin their breeding season.', // Jul
    'Peak Southern Hemisphere humpback season along the Pacific coast.', // Aug
    'Peak Southern Hemisphere humpback season along the Pacific coast.', // Sep
    'Southern Hemisphere humpback whales remain present as their breeding season winds down.', // Oct
    'Outside either humpback season, whale sightings along the Pacific coast settle to a quieter baseline.', // Nov
    'Northern Hemisphere humpback whales are beginning to arrive to breed.', // Dec
  ],
  srilanka: [
    'Peak blue whale season off Sri Lanka\'s southern coast.', // Jan
    'Peak blue whale season off Sri Lanka\'s southern coast.', // Feb
    'Blue whale numbers are easing off the southern coast as the season winds down.', // Mar
    'Outside the main season, blue whale sightings off the southern coast become less reliable.', // Apr
    'Outside the main season, blue whale sightings off the southern coast become less reliable.', // May
    'Outside the main season, blue whale sightings off the southern coast become less reliable.', // Jun
    'Outside the main season, blue whale sightings off the southern coast become less reliable.', // Jul
    'Outside the main season, blue whale sightings off the southern coast become less reliable.', // Aug
    'Outside the main season, blue whale sightings off the southern coast become less reliable.', // Sep
    'Outside the main season, blue whale sightings off the southern coast become less reliable.', // Oct
    'Blue whales are returning to the southern coast as the season begins.', // Nov
    'Peak blue whale season off Sri Lanka\'s southern coast.', // Dec
  ],
  'monterey-big-sur': [
    'Whales are present in Monterey Bay\'s productive waters year-round, at a steady baseline.', // Jan
    'Whales are present in Monterey Bay\'s productive waters year-round, at a steady baseline.', // Feb
    'Whales are present in Monterey Bay\'s productive waters year-round, at a steady baseline.', // Mar
    'Gray whales migrating north toward Arctic feeding grounds are beginning to pass closer to shore.', // Apr
    'Peak northbound gray whale migration, with mothers and calves passing especially close to shore.', // May
    'Whales are present in Monterey Bay\'s productive waters year-round, at a steady baseline.', // Jun
    'Whales are present in Monterey Bay\'s productive waters year-round, at a steady baseline.', // Jul
    'Whales are present in Monterey Bay\'s productive waters year-round, at a steady baseline.', // Aug
    'Whales are present in Monterey Bay\'s productive waters year-round, at a steady baseline.', // Sep
    'Gray whales migrating south toward Baja breeding lagoons are beginning to pass closer to shore.', // Oct
    'Peak southbound gray whale migration, with whales passing especially close to shore.', // Nov
    'Whales are present in Monterey Bay\'s productive waters year-round, at a steady baseline.', // Dec
  ],
  'vancouver-island': [
    'Resident orca pods are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Jan
    'Resident orca pods are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Feb
    'Orca activity is building as the season transitions toward summer.', // Mar
    'Orca activity is building as the season transitions toward summer.', // Apr
    'Peak season — humpback and gray whales join resident orca pods to feed in the waters around Vancouver Island.', // May
    'Peak season — humpback and gray whales join resident orca pods to feed in the waters around Vancouver Island.', // Jun
    'Peak season — humpback and gray whales join resident orca pods to feed in the waters around Vancouver Island.', // Jul
    'Peak season — humpback and gray whales join resident orca pods to feed in the waters around Vancouver Island.', // Aug
    'Peak season — humpback and gray whales join resident orca pods to feed in the waters around Vancouver Island.', // Sep
    'Peak season — humpback and gray whales join resident orca pods to feed in the waters around Vancouver Island.', // Oct
    'Resident orca pods are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Nov
    'Resident orca pods are present, though outside the summer feeding season, sightings settle to a quieter baseline.', // Dec
  ],
  'southeast-alaska': [
    'Outside the summer feeding season, whale sightings along the Inside Passage settle to a quieter baseline.', // Jan
    'Outside the summer feeding season, whale sightings along the Inside Passage settle to a quieter baseline.', // Feb
    'Outside the summer feeding season, whale sightings along the Inside Passage settle to a quieter baseline.', // Mar
    'Outside the summer feeding season, whale sightings along the Inside Passage settle to a quieter baseline.', // Apr
    'Peak season — humpback whales are bubble-net feeding on herring throughout the Inside Passage.', // May
    'Peak season — humpback whales are bubble-net feeding on herring throughout the Inside Passage.', // Jun
    'Peak season — humpback whales are bubble-net feeding on herring throughout the Inside Passage.', // Jul
    'Peak season — humpback whales are bubble-net feeding on herring throughout the Inside Passage.', // Aug
    'Peak season — humpback whales are bubble-net feeding on herring throughout the Inside Passage.', // Sep
    'Outside the summer feeding season, whale sightings along the Inside Passage settle to a quieter baseline.', // Oct
    'Outside the summer feeding season, whale sightings along the Inside Passage settle to a quieter baseline.', // Nov
    'Outside the summer feeding season, whale sightings along the Inside Passage settle to a quieter baseline.', // Dec
  ],
  'los-cabos': [
    'Peak season — gray whales are calving in the sheltered lagoons alongside breeding humpback whales.', // Jan
    'Peak season — gray whales are calving in the sheltered lagoons alongside breeding humpback whales.', // Feb
    'Peak season — gray whales are calving in the sheltered lagoons alongside breeding humpback whales.', // Mar
    'Peak season — gray whales are calving in the sheltered lagoons alongside breeding humpback whales.', // Apr
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.', // May
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.', // Jun
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.', // Jul
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.', // Aug
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.', // Sep
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.', // Oct
    'Whale numbers ease outside the peak breeding season, though sightings remain strong.', // Nov
    'Gray and humpback whales are beginning to arrive for the breeding season.', // Dec
  ],
  maui: [
    'Peak humpback whale season in the channel between Maui, Lanai, and Molokai.', // Jan
    'Peak humpback whale season in the channel between Maui, Lanai, and Molokai.', // Feb
    'Peak humpback whale season in the channel between Maui, Lanai, and Molokai.', // Mar
    'Peak humpback whale season in the channel between Maui, Lanai, and Molokai.', // Apr
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // May
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jun
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jul
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Aug
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Sep
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Oct
    'Humpback whales are just beginning to arrive for the breeding season.', // Nov
    'Peak humpback whale season in the channel between Maui, Lanai, and Molokai.', // Dec
  ],
  'big-island': [
    'Peak humpback whale season along the Big Island\'s coastline.', // Jan
    'Peak humpback whale season along the Big Island\'s coastline.', // Feb
    'Peak humpback whale season along the Big Island\'s coastline.', // Mar
    'Peak humpback whale season along the Big Island\'s coastline.', // Apr
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // May
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jun
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Jul
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Aug
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Sep
    'Outside the breeding season, whale sightings settle to a quieter baseline.', // Oct
    'Humpback whale numbers are at their lowest as the season transitions.', // Nov
    'Peak humpback whale season along the Big Island\'s coastline.', // Dec
  ],
  'punta-cana': [
    'Peak humpback whale season in Samaná Bay.', // Jan
    'Peak humpback whale season in Samaná Bay.', // Feb
    'Peak humpback whale season in Samaná Bay.', // Mar
    'Whale numbers in Samaná Bay are easing as the breeding season winds down.', // Apr
    'Outside the breeding season, whale sightings in Samaná Bay settle to a quieter baseline.', // May
    'Outside the breeding season, whale sightings in Samaná Bay settle to a quieter baseline.', // Jun
    'Outside the breeding season, whale sightings in Samaná Bay settle to a quieter baseline.', // Jul
    'Outside the breeding season, whale sightings in Samaná Bay settle to a quieter baseline.', // Aug
    'Outside the breeding season, whale sightings in Samaná Bay settle to a quieter baseline.', // Sep
    'Outside the breeding season, whale sightings in Samaná Bay settle to a quieter baseline.', // Oct
    'Outside the breeding season, whale sightings in Samaná Bay settle to a quieter baseline.', // Nov
    'Humpback whales are beginning to arrive in Samaná Bay for the breeding season.', // Dec
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
