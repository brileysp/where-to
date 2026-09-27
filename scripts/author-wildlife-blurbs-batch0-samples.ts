import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * The 6 destinations used to establish wildlifeViewing's voice through
 * sample review, now locked in and applied for real. Botswana/Okavango
 * (also sampled) is covered by the African-safari batch instead.
 */

const KEY = 'wildlifeViewing';

const OVERVIEWS: Record<string, string> = {
  venice: 'The lagoon and canals hold common fish and waterbirds; no land mammals or larger wildlife are part of a visit here.',
  'zion-bryce': 'Bighorn sheep on Zion\'s cliffs are elusive — best odds near the east entrance road at dawn. Bryce protects a real, threatened Utah prairie dog colony, visible at its burrows.',
  'torres-del-paine': 'The best place on Earth to see wild pumas, reliable enough to support dedicated tracking guides nearly year-round. Guanaco, condor, and Darwin\'s rhea are also common across the steppe.',
  galapagos: 'Marine iguanas and blue-footed boobies turn up everywhere. Tortoises and penguins are reliable at select islands, and Española\'s waved albatross and passing whale sharks are real seasonal bonuses.',
  'peruvian-amazon': 'Giant river otters, pink river dolphins, and capybara are reliable sightings on the rivers and oxbow lakes; howler monkey troops are commonly heard if not seen. Dozens of macaws gather at riverbank clay licks in the dry season — one of the Amazon\'s great wildlife spectacles. Jaguars are present but genuinely elusive, even at their best odds along dry-season river beaches.',
  redwood: 'Roosevelt elk, among the largest elk in North America, gather in herds that are often visible right along the park roads. Black bears live in the forest but are rarely seen.',
};

const MONTHLY: Record<string, string[]> = {
  venice: Array(12).fill('The lagoon and canals hold common fish and waterbirds; no land mammals or larger wildlife are part of a visit here.'),
  'zion-bryce': [
    'Bryce\'s prairie dogs are hibernating and not visible. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // Jan
    'Bryce\'s prairie dogs are hibernating and not visible. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // Feb
    'Bryce\'s prairie dogs are hibernating and not visible. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // Mar
    'Bryce\'s prairie dogs are active at their burrows. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // Apr
    'Bryce\'s prairie dogs are active at their burrows. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // May
    'Bryce\'s prairie dogs are active at their burrows. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // Jun
    'Bryce\'s prairie dogs are active at their burrows. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // Jul
    'Bighorn sheep are more active and visible on Zion\'s cliffs during the fall rut. Bryce\'s prairie dogs remain active at their burrows.', // Aug
    'Bighorn sheep are more active and visible on Zion\'s cliffs during the fall rut. Bryce\'s prairie dogs remain active at their burrows.', // Sep
    'Bighorn sheep are more active and visible on Zion\'s cliffs during the fall rut. Bryce\'s prairie dogs remain active at their burrows.', // Oct
    'Bryce\'s prairie dogs are entering hibernation. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // Nov
    'Bryce\'s prairie dogs are hibernating and not visible. Bighorn sheep sightings on Zion\'s cliffs remain a matter of luck.', // Dec
  ],
  'torres-del-paine': [
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.', // Jan
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.', // Feb
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.', // Mar
    'Fewer visitors this time of year mean pumas show less avoidance around trackers, keeping sightings just as reliable. Guanaco, condor, and rhea remain part of the same daily encounters.', // Apr
    'Fewer visitors this time of year mean pumas show less avoidance around trackers, keeping sightings just as reliable. Guanaco, condor, and rhea remain part of the same daily encounters.', // May
    'Fewer visitors this time of year mean pumas show less avoidance around trackers, keeping sightings just as reliable. Guanaco, condor, and rhea remain part of the same daily encounters.', // Jun
    'Fewer visitors this time of year mean pumas show less avoidance around trackers, keeping sightings just as reliable. Guanaco, condor, and rhea remain part of the same daily encounters.', // Jul
    'Fewer visitors this time of year mean pumas show less avoidance around trackers, keeping sightings just as reliable. Guanaco, condor, and rhea remain part of the same daily encounters.', // Aug
    'Fewer visitors this time of year mean pumas show less avoidance around trackers, keeping sightings just as reliable. Guanaco, condor, and rhea remain part of the same daily encounters.', // Sep
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.', // Oct
    'Puma cubs are often visible this month, alongside newborn guanaco young from the recent birthing season.', // Nov
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.', // Dec
  ],
  galapagos: [
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross have left Española for the open ocean until later in the year.', // Jan
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross have left Española for the open ocean until later in the year.', // Feb
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross have left Española for the open ocean until later in the year.', // Mar
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross are back on Española to breed.', // Apr
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross are back on Española to breed.', // May
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross remain on Española, and whale sharks pass the northern islands during these cooler months.', // Jun
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross remain on Española, and whale sharks pass the northern islands during these cooler months.', // Jul
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross remain on Española, and whale sharks pass the northern islands during these cooler months.', // Aug
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross remain on Española, and whale sharks pass the northern islands during these cooler months.', // Sep
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross remain on Española, and whale sharks pass the northern islands during these cooler months.', // Oct
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross remain on Española, and whale sharks pass the northern islands during these cooler months.', // Nov
    'Marine iguanas and blue-footed boobies are everywhere; tortoises and penguins reliable at select islands. Waved albatross are still on Española before heading out to sea.', // Dec
  ],
  'peruvian-amazon': [
    'Giant river otters, pink river dolphins, capybara, and howler monkey troops remain reliable. Jaguar sightings are rare this time of year, with river beaches mostly underwater.', // Jan
    'Giant river otters, pink river dolphins, capybara, and howler monkey troops remain reliable. Jaguar sightings are rare this time of year, with river beaches mostly underwater.', // Feb
    'Giant river otters, pink river dolphins, capybara, and howler monkey troops remain reliable. Jaguar sightings are rare this time of year, with river beaches mostly underwater.', // Mar
    'River levels are beginning to drop. Giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable.', // Apr
    'River levels are beginning to drop. Giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable.', // May
    'Peak dry season — dozens of macaws gather at riverbank clay licks, and exposed river beaches give jaguars their best, though still far from guaranteed, odds of the year. Giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable.', // Jun
    'Peak dry season — dozens of macaws gather at riverbank clay licks, and exposed river beaches give jaguars their best, though still far from guaranteed, odds of the year. Giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable.', // Jul
    'Peak dry season — dozens of macaws gather at riverbank clay licks, and exposed river beaches give jaguars their best, though still far from guaranteed, odds of the year. Giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable.', // Aug
    'Peak dry season — dozens of macaws gather at riverbank clay licks, and exposed river beaches give jaguars their best, though still far from guaranteed, odds of the year. Giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable.', // Sep
    'River levels are rising again; giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable. Jaguar and clay-lick macaw activity are easing.', // Oct
    'River levels are rising again; giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable. Jaguar and clay-lick macaw activity are easing.', // Nov
    'Giant river otters, pink river dolphins, capybara, and howler monkeys remain reliable. Jaguar sightings are rare again as river beaches go back underwater.', // Dec
  ],
  redwood: [
    'Roosevelt elk herds remain visible along the park roads through the winter; black bear sightings are especially unlikely during this dormant period.', // Jan
    'Roosevelt elk herds remain visible along the park roads through the winter; black bear sightings are especially unlikely during this dormant period.', // Feb
    'Roosevelt elk herds are regularly visible along the park roads. Black bears are present but rarely seen.', // Mar
    'Roosevelt elk herds are regularly visible along the park roads. Black bears are present but rarely seen.', // Apr
    'Roosevelt elk herds are regularly visible along the park roads. Black bears are present but rarely seen.', // May
    'Roosevelt elk herds are regularly visible along the park roads. Black bears are present but rarely seen.', // Jun
    'Roosevelt elk herds are regularly visible along the park roads. Black bears are present but rarely seen.', // Jul
    'Elk are more active and vocal during the fall rut, with bulls bugling and sparring for herds — the most dramatic elk viewing of the year.', // Aug
    'Elk are more active and vocal during the fall rut, with bulls bugling and sparring for herds — the most dramatic elk viewing of the year.', // Sep
    'Elk are more active and vocal during the fall rut, with bulls bugling and sparring for herds — the most dramatic elk viewing of the year.', // Oct
    'Roosevelt elk herds remain visible along the park roads; black bear sightings remain rare as activity winds down for winter.', // Nov
    'Roosevelt elk herds remain visible along the park roads; black bear sightings remain rare as activity winds down for winter.', // Dec
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
