import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  'marlborough-abel-tasman': 'Humpback whales migrate past the Marlborough Sounds twice each year — northbound in winter toward tropical Pacific breeding grounds, then southbound in spring back to Antarctic feeding grounds.',
  tasmania: 'Humpback and southern right whales migrate past Tasmania twice each year — northbound in autumn toward warmer mainland Australian breeding grounds, then southbound in spring back to Antarctic feeding grounds — with a genuine lull in between while whales are at their breeding grounds further north.',
  gbr: 'Humpback whales migrate along the Queensland coast each winter to breed in the reef\'s warm waters, joined seasonally by dwarf minke whales.',
  galapagos: 'Humpback whales pass through Galápagos waters during the cooler garua season, migrating between feeding and breeding grounds.',
  'tierra-del-fuego': 'Southern right and other whale species are present in the waters around Tierra del Fuego each austral summer.',
  panama: 'Panama\'s Pacific coast sees two separate humpback whale populations pass through at different times of year — one from the Southern Hemisphere from July through October, another from the Northern Hemisphere from January through March.',
  okinawa: 'Humpback whales breed in the warm waters around the Kerama Islands near Okinawa each winter.',
  canaries: 'Resident pilot whales are present year-round in the deep channel between Tenerife and La Gomera, joined by modest additional whale activity each spring.',
  maldives: 'Sperm whales are resident in the deep channels near certain atolls, present year-round though not concentrated into a single dedicated season.',
};

const MONTHLY: Record<string, string[]> = {
  'marlborough-abel-tasman': [
    'Outside the migration passages, whale sightings in the Marlborough Sounds settle to a quieter baseline.', // Jan
    'Outside the migration passages, whale sightings in the Marlborough Sounds settle to a quieter baseline.', // Feb
    'Outside the migration passages, whale sightings in the Marlborough Sounds settle to a quieter baseline.', // Mar
    'Outside the migration passages, whale sightings in the Marlborough Sounds settle to a quieter baseline.', // Apr
    'Outside the migration passages, whale sightings in the Marlborough Sounds settle to a quieter baseline.', // May
    'Humpback whales are migrating north through the Marlborough Sounds toward tropical Pacific breeding grounds.', // Jun
    'Humpback whales are migrating north through the Marlborough Sounds toward tropical Pacific breeding grounds.', // Jul
    'Humpback whales are migrating north through the Marlborough Sounds toward tropical Pacific breeding grounds.', // Aug
    'Humpback whales are migrating south through the Marlborough Sounds back toward Antarctic feeding grounds.', // Sep
    'Humpback whales are migrating south through the Marlborough Sounds back toward Antarctic feeding grounds.', // Oct
    'Humpback whales are migrating south through the Marlborough Sounds back toward Antarctic feeding grounds.', // Nov
    'Outside the migration passages, whale sightings in the Marlborough Sounds settle to a quieter baseline.', // Dec
  ],
  tasmania: [
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.', // Jan
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.', // Feb
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.', // Mar
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.', // Apr
    'Whales are beginning their northbound migration past Tasmania toward mainland breeding grounds.', // May
    'Peak northbound migration — humpback and southern right whales pass Tasmania in strong numbers.', // Jun
    'Whales are at their breeding grounds further north; sightings off Tasmania are at their lowest.', // Jul
    'Whales are at their breeding grounds further north; sightings off Tasmania are at their lowest.', // Aug
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.', // Sep
    'Whales are beginning their southbound migration past Tasmania back toward Antarctic feeding grounds.', // Oct
    'Peak southbound migration — humpback and southern right whales pass Tasmania in strong numbers.', // Nov
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.', // Dec
  ],
  gbr: [
    'Outside the whale season, sightings along the reef settle to a quieter baseline.', // Jan
    'Outside the whale season, sightings along the reef settle to a quieter baseline.', // Feb
    'Outside the whale season, sightings along the reef settle to a quieter baseline.', // Mar
    'Whale numbers are beginning to build as the migration approaches.', // Apr
    'Whale numbers are beginning to build as the migration approaches.', // May
    'Humpback whales are arriving along the Queensland coast in growing numbers.', // Jun
    'Peak season — humpback and dwarf minke whales are present along the reef in strong numbers.', // Jul
    'Peak season — humpback and dwarf minke whales are present along the reef in strong numbers.', // Aug
    'Whale numbers are easing as the migration continues south.', // Sep
    'Outside the whale season, sightings along the reef settle to a quieter baseline.', // Oct
    'Outside the whale season, sightings along the reef settle to a quieter baseline.', // Nov
    'Outside the whale season, sightings along the reef settle to a quieter baseline.', // Dec
  ],
  galapagos: [
    'Outside the garua-season migration, whale sightings around the islands settle to a quieter baseline.', // Jan
    'Outside the garua-season migration, whale sightings around the islands settle to a quieter baseline.', // Feb
    'Outside the garua-season migration, whale sightings around the islands settle to a quieter baseline.', // Mar
    'Outside the garua-season migration, whale sightings around the islands settle to a quieter baseline.', // Apr
    'Whale numbers are beginning to build as the garua season approaches.', // May
    'Humpback whales are moving through the islands\' waters in growing numbers.', // Jun
    'Peak season — humpback whales are passing through the islands\' waters in the strongest numbers.', // Jul
    'Peak season — humpback whales are passing through the islands\' waters in the strongest numbers.', // Aug
    'Whale numbers are easing as the garua season winds down.', // Sep
    'Outside the garua-season migration, whale sightings around the islands settle to a quieter baseline.', // Oct
    'Outside the garua-season migration, whale sightings around the islands settle to a quieter baseline.', // Nov
    'Outside the garua-season migration, whale sightings around the islands settle to a quieter baseline.', // Dec
  ],
  'tierra-del-fuego': [
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.', // Jan
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.', // Feb
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.', // Mar
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.', // Apr
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.', // May
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.', // Jun
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.', // Jul
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.', // Aug
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.', // Sep
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.', // Oct
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.', // Nov
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.', // Dec
  ],
  panama: [
    'Northern Hemisphere humpback whales are present along the Pacific coast as their season builds.', // Jan
    'Peak Northern Hemisphere humpback season along the Pacific coast.', // Feb
    'Northern Hemisphere humpback whales remain present along the Pacific coast as the season winds down.', // Mar
    'Outside either humpback season, whale sightings along the Pacific coast settle to a quieter baseline.', // Apr
    'Outside either humpback season, whale sightings along the Pacific coast settle to a quieter baseline.', // May
    'Outside either humpback season, whale sightings along the Pacific coast settle to a quieter baseline.', // Jun
    'Southern Hemisphere humpback whales are arriving along the Pacific coast to begin their season.', // Jul
    'Peak Southern Hemisphere humpback season along the Pacific coast.', // Aug
    'Peak Southern Hemisphere humpback season along the Pacific coast.', // Sep
    'Southern Hemisphere humpback whales remain present along the Pacific coast as the season winds down.', // Oct
    'Outside either humpback season, whale sightings along the Pacific coast settle to a quieter baseline.', // Nov
    'Northern Hemisphere humpback whales are beginning to arrive along the Pacific coast.', // Dec
  ],
  okinawa: [
    'Humpback whales are present around the Kerama Islands in growing numbers as the breeding season builds.', // Jan
    'Peak humpback whale season around the Kerama Islands.', // Feb
    'Humpback whales remain present around the Kerama Islands as the breeding season winds down.', // Mar
    'Whale numbers around the Kerama Islands are easing as the season ends.', // Apr
    'Outside the breeding season, whale sightings around the Kerama Islands settle to a quieter baseline.', // May
    'Outside the breeding season, whale sightings around the Kerama Islands settle to a quieter baseline.', // Jun
    'Outside the breeding season, whale sightings around the Kerama Islands settle to a quieter baseline.', // Jul
    'Outside the breeding season, whale sightings around the Kerama Islands settle to a quieter baseline.', // Aug
    'Outside the breeding season, whale sightings around the Kerama Islands settle to a quieter baseline.', // Sep
    'Outside the breeding season, whale sightings around the Kerama Islands settle to a quieter baseline.', // Oct
    'Outside the breeding season, whale sightings around the Kerama Islands settle to a quieter baseline.', // Nov
    'Outside the breeding season, whale sightings around the Kerama Islands settle to a quieter baseline.', // Dec
  ],
  canaries: [
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Jan
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Feb
    'Spring migration adds modestly to the resident pilot whale population in the channel.', // Mar
    'Spring migration adds modestly to the resident pilot whale population in the channel.', // Apr
    'Spring migration adds modestly to the resident pilot whale population in the channel.', // May
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Jun
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Jul
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Aug
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Sep
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Oct
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Nov
    'Resident pilot whales are present in the channel between Tenerife and La Gomera at a steady baseline.', // Dec
  ],
  maldives: Array(12).fill('Sperm whales are resident in the deep channels near certain atolls, present year-round though not concentrated into a single dedicated season.'),
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
