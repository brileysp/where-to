import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  'faroe-islands': 'Pilot whales and occasional orcas are present in Faroese waters, though sightings are incidental rather than part of a dedicated whale-watching circuit.',
  'nova-scotia': 'The Bay of Fundy\'s extreme tides drive nutrient-rich upwelling that concentrates prey, drawing humpback and minke whales to feed each summer. The bay is also one of the last critical feeding habitats for the endangered North Atlantic right whale.',
  'cape-town': 'Southern right whales migrate from Antarctic feeding grounds to calve in the sheltered coastal waters off Cape Town each winter, visible directly from shore without a boat.',
  churchill: 'Thousands of beluga whales gather in the Churchill River estuary each summer to molt and calve, one of the largest beluga congregations in the world.',
};

const MONTHLY: Record<string, string[]> = {
  'faroe-islands': Array(12).fill('Pilot whales and occasional orcas are present in Faroese waters, though sightings are incidental rather than part of a dedicated whale-watching circuit.'),
  'nova-scotia': [
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.', // Jan
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.', // Feb
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.', // Mar
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.', // Apr
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.', // May
    'Humpback and minke whales are arriving in the Bay of Fundy to feed as the tidal upwelling builds.', // Jun
    'Whale numbers continue building in the Bay of Fundy\'s nutrient-rich waters.', // Jul
    'Peak feeding season — humpback and minke whales, along with occasional North Atlantic right whales, are concentrated in the Bay of Fundy.', // Aug
    'Peak feeding season continues in the Bay of Fundy\'s nutrient-rich waters.', // Sep
    'Whale numbers in the Bay of Fundy are easing as the feeding season winds down.', // Oct
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.', // Nov
    'Humpback and minke whales have migrated away from the Bay of Fundy for the winter; whale sightings here are unlikely this time of year.', // Dec
  ],
  'cape-town': [
    'Southern right whales are in Antarctic waters feeding this time of year; none are present along the Cape Town coast.', // Jan
    'Southern right whales are in Antarctic waters feeding this time of year; none are present along the Cape Town coast.', // Feb
    'Southern right whales are in Antarctic waters feeding this time of year; none are present along the Cape Town coast.', // Mar
    'Southern right whales are in Antarctic waters feeding this time of year; none are present along the Cape Town coast.', // Apr
    'Southern right whales are in Antarctic waters feeding this time of year; none are present along the Cape Town coast.', // May
    'Southern right whales are arriving along the Cape Town coast to begin their breeding season.', // Jun
    'Whale numbers are building along the Cape Town coast as the breeding season continues.', // Jul
    'Peak whale season — southern right whales are visible directly from the Cape Town shoreline in strong numbers.', // Aug
    'Peak whale season continues along the Cape Town coast.', // Sep
    'Whale numbers remain strong along the Cape Town coast as the season continues.', // Oct
    'Southern right whales are beginning to depart the Cape Town coast as the season winds down.', // Nov
    'Southern right whales are in Antarctic waters feeding this time of year; none are present along the Cape Town coast.', // Dec
  ],
  churchill: [
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Jan
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Feb
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Mar
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Apr
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // May
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Jun
    'Beluga whales are gathering in the Churchill River estuary in large numbers as the summer congregation builds.', // Jul
    'Peak beluga season — thousands of whales are concentrated in the Churchill River estuary to molt and calve.', // Aug
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Sep
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Oct
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Nov
    'Beluga whales are not present in the Churchill River estuary outside the summer window; they spend the rest of the year in ice-covered or open Arctic waters beyond the bay.', // Dec
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
