import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  rio: 'Humpback whales pass close to Rio\'s coast near the Cagarras Islands each winter, a real and rapidly growing tour scene as Brazil\'s whale population continues recovering from historic whaling.',
  tanzania: 'Humpback whales migrate past Zanzibar\'s coast each year, a real if secondary draw alongside the island\'s much larger dolphin-tourism industry.',
  taiwan: 'Hualien\'s boat fleet has run cetacean tours since the late 1990s — dolphins are the daily reliable sighting, with whales, including occasional sperm whales, a real if less frequent addition.',
  mauritius: 'A resident sperm whale population is present in Mauritian waters year-round, joined by migrating humpback whales each winter — though the island\'s marketed "swim with whales" tours are illegal and have drawn legal action against operators.',
  'north-island': 'The Hauraki Gulf near Auckland holds one of the world\'s few resident Bryde\'s whale populations, reliably present year-round.',
  madagascar: 'Île Sainte-Marie is one of the Indian Ocean\'s best-documented humpback whale breeding grounds, drawing whales — and a well-established fleet of licensed guides — each winter.',
  hokkaido: 'The Nemuro Strait off Rausu, on the Shiretoko Peninsula, is one of the few places on Earth where sperm whales are reliably seen close to shore, alongside a real orca season.',
  acadia: 'The Gulf of Maine holds some of the highest whale concentrations in the world, and Bar Harbor\'s established fleet runs regular trips out to feeding grounds like Jeffreys Ledge each season.',
};

const MONTHLY: Record<string, string[]> = {
  rio: [
    'Outside the whale season, sightings near the Cagarras Islands settle to a quiet baseline.', 'Outside the whale season, sightings near the Cagarras Islands settle to a quiet baseline.',
    'Outside the whale season, sightings near the Cagarras Islands settle to a quiet baseline.', 'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.', 'Whale numbers are building quickly as the season gets underway.',
    'Peak season — humpback whales pass close to Rio\'s coast near the Cagarras Islands.', 'Whale numbers remain strong as the peak season continues.',
    'Whale numbers are easing as the season winds down.', 'Whale numbers are easing as the season winds down.',
    'Whale numbers are easing as the season winds down.', 'Outside the whale season, sightings near the Cagarras Islands settle to a quiet baseline.',
  ],
  tanzania: [
    'Humpback whales are present off Zanzibar\'s coast at a modest baseline.', 'Humpback whales are present off Zanzibar\'s coast at a modest baseline.',
    'Outside the migration season, whale sightings off Zanzibar are quieter still.', 'Outside the migration season, whale sightings off Zanzibar are quieter still.',
    'Outside the migration season, whale sightings off Zanzibar are quieter still.', 'Whale numbers are building as the migration season begins.',
    'Peak season — humpback whales migrate past Zanzibar\'s coast in the strongest numbers.', 'Peak season — humpback whales migrate past Zanzibar\'s coast in the strongest numbers.',
    'Peak season — humpback whales migrate past Zanzibar\'s coast in the strongest numbers.', 'Whale numbers are easing as the migration season winds down.',
    'Humpback whales are present off Zanzibar\'s coast at a modest baseline.', 'Humpback whales are present off Zanzibar\'s coast at a modest baseline.',
  ],
  taiwan: [
    'Outside the main season, Hualien\'s boats see mostly dolphins at a quiet baseline.', 'Outside the main season, Hualien\'s boats see mostly dolphins at a quiet baseline.',
    'Whale sightings are building as the boat season begins.', 'Whale sightings are building as the boat season begins.',
    'Peak season — dolphins remain the daily reliable sighting, with whales, including occasional sperm whales, a real addition.', 'Peak season — dolphins remain the daily reliable sighting, with whales, including occasional sperm whales, a real addition.',
    'Peak season — dolphins remain the daily reliable sighting, with whales, including occasional sperm whales, a real addition.', 'Peak season — dolphins remain the daily reliable sighting, with whales, including occasional sperm whales, a real addition.',
    'Peak season — dolphins remain the daily reliable sighting, with whales, including occasional sperm whales, a real addition.', 'Whale sightings are easing as the season winds down.',
    'Outside the main season, Hualien\'s boats see mostly dolphins at a quieter baseline.', 'Outside the main season, Hualien\'s boats see mostly dolphins at a quiet baseline.',
  ],
  mauritius: [
    'Resident sperm whales are present at a steady baseline.', 'Resident sperm whales are present at a steady baseline.',
    'Resident sperm whales are present at a steady baseline.', 'Whale numbers are beginning to build ahead of the humpback season.',
    'Whale numbers are beginning to build ahead of the humpback season.', 'Whale numbers are beginning to build ahead of the humpback season.',
    'Migrating humpback whales are joining the resident sperm whale population.', 'Migrating humpback whales are joining the resident sperm whale population.',
    'Peak season — humpback whales are present alongside the resident sperm whale population.', 'Peak season — humpback whales are present alongside the resident sperm whale population.',
    'Whale numbers are easing as the humpback season winds down.', 'Resident sperm whales remain present as the humpback season ends.',
  ],
  'north-island': [
    'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.', 'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.',
    'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.', 'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.',
    'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.', 'Bryde\'s whales remain present through the Southern Hemisphere winter, though rougher seas can affect trip conditions.',
    'Bryde\'s whales remain present through the Southern Hemisphere winter, though rougher seas can affect trip conditions.', 'Bryde\'s whales remain present through the Southern Hemisphere winter, though rougher seas can affect trip conditions.',
    'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.', 'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.',
    'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.', 'Bryde\'s whales are present year-round in the Hauraki Gulf, a reliable sighting in any month.',
  ],
  madagascar: [
    'Outside the breeding season, whale sightings at Île Sainte-Marie settle to a quiet baseline.', 'Outside the breeding season, whale sightings at Île Sainte-Marie settle to a quiet baseline.',
    'Outside the breeding season, whale sightings at Île Sainte-Marie settle to a quiet baseline.', 'Whale numbers are beginning to build ahead of the season.',
    'Whale numbers are beginning to build ahead of the season.', 'Humpback whales are arriving at Île Sainte-Marie in growing numbers.',
    'Whale numbers continue building toward the peak.', 'Peak season — humpback whales breed at Île Sainte-Marie in the strongest numbers of the year.',
    'Peak season — humpback whales breed at Île Sainte-Marie in the strongest numbers of the year.', 'Whale numbers are easing as the breeding season winds down.',
    'Whale numbers are easing as the breeding season winds down.', 'Outside the breeding season, whale sightings at Île Sainte-Marie settle to a quiet baseline.',
  ],
  hokkaido: [
    'Outside the boat season, the Nemuro Strait settles to a quiet baseline.', 'Outside the boat season, the Nemuro Strait settles to a quiet baseline.',
    'Outside the boat season, the Nemuro Strait settles to a quiet baseline.', 'Outside the boat season, the Nemuro Strait settles to a quiet baseline.',
    'Orca season is building in the Nemuro Strait as the boat season begins.', 'Peak orca season in the Nemuro Strait off Rausu.',
    'Sperm whales are becoming the more reliable sighting as the season transitions.', 'Sperm whales are becoming the more reliable sighting as the season transitions.',
    'Peak sperm whale season — reliably seen close to shore in the Nemuro Strait.', 'Whale numbers are easing as the season winds down.',
    'Outside the boat season, the Nemuro Strait settles to a quiet baseline.', 'Outside the boat season, the Nemuro Strait settles to a quiet baseline.',
  ],
  acadia: [
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.', 'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.', 'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
    'Bar Harbor\'s fleet is beginning its season as whale numbers build.', 'Whale numbers continue building toward the peak.',
    'Peak season — Bar Harbor\'s fleet runs regular trips out to feeding grounds like Jeffreys Ledge.', 'Peak season — Bar Harbor\'s fleet runs regular trips out to feeding grounds like Jeffreys Ledge.',
    'Peak season — Bar Harbor\'s fleet runs regular trips out to feeding grounds like Jeffreys Ledge.', 'Whale numbers are easing as the season winds down.',
    'Outside the boat season, the Gulf of Maine settles to a quiet baseline.', 'Outside the boat season, the Gulf of Maine settles to a quiet baseline.',
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
