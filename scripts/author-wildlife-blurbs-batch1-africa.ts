import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * First wildlifeViewing batch — African safari destinations. Central
 * lens established through sample review: name the animal a visitor
 * probably has their heart set on, then give an honest sense of the
 * real odds (near-certain / reliable / elusive-even-here / rare bonus),
 * not just a species list.
 */

const KEY = 'wildlifeViewing';

const OVERVIEWS: Record<string, string> = {
  kenya: 'Lions and elephants are near-certain sightings; leopards are here but genuinely harder to find. The Great Migration\'s river crossings (July-October) are the single biggest draw — dramatic, but on their own schedule, not guaranteed on any given day.',
  tanzania: 'Lions and elephants are near-certain. The Ndutu plains see the migration\'s calving season each January-March — predictable and dramatic, arguably more reliable than the more famous river crossings further north (June-October), which happen on their own schedule.',
  rwanda: 'Mountain gorilla treks are about as close to guaranteed as wildlife viewing gets — trackers locate a habituated family virtually every day, permit in hand. Golden monkeys are a real bonus on the same volcanoes.',
  uganda: 'Mountain gorilla treks in Bwindi are about as close to guaranteed as wildlife viewing gets. Chimpanzee tracking in Kibale has strong odds too. Ishasha\'s tree-climbing lions are a real, unusual sight, but far less predictable.',
  botswana: 'Elephant, lion, and hippo sightings are highly reliable, especially as the flood pulse concentrates them along the delta\'s channels. Leopards are here but harder to find. Okavango is also one of the best places on Earth for African wild dogs, among Africa\'s rarest predators.',
  zimbabwe: 'Hwange\'s elephant herds are a near-certain sighting, especially at dry-season waterholes. Lions are also reliable. Painted dogs (African wild dogs) are a real, if rarer, highlight — Hwange is a stronghold for the species.',
  zambia: 'South Luangwa is one of Africa\'s best places to see leopards, with strong odds even by safari standards. Walking safaris here were pioneered specifically for close, on-foot wildlife tracking.',
  namibia: 'Namibia has the largest wild cheetah population on Earth, with real odds of a sighting. Desert-adapted elephants and black rhino are found in Damaraland, though seeing them takes a guided tracking excursion, not a drive-by.',
};

const MONTHLY: Record<string, string[]> = {
  kenya: [
    'Lions and elephants remain near-certain sightings at this strong baseline.', // Jan
    'Lions and elephants remain near-certain sightings at this strong baseline.', // Feb
    'The migration has moved on; lions and elephants remain near-certain, though overall wildlife density eases slightly.', // Mar
    'The migration has moved on; lions and elephants remain near-certain, though overall wildlife density eases slightly.', // Apr
    'The migration has moved on; lions and elephants remain near-certain, though overall wildlife density eases slightly.', // May
    'The Great Migration\'s river crossings are beginning as herds arrive from the south.', // Jun
    'Peak river-crossing season — dramatic, though the crossings happen on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Jul
    'Peak river-crossing season — dramatic, though the crossings happen on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Aug
    'Peak river-crossing season — dramatic, though the crossings happen on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Sep
    'Peak river-crossing season — dramatic, though the crossings happen on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Oct
    'The migration has moved south again; lions and elephants remain near-certain sightings.', // Nov
    'The migration has moved south again; lions and elephants remain near-certain sightings.', // Dec
  ],
  tanzania: [
    'Peak calving season on the Ndutu plains — predictable, dramatic predator activity around newborn wildebeest. Lions and elephants remain near-certain.', // Jan
    'Peak calving season on the Ndutu plains — predictable, dramatic predator activity around newborn wildebeest. Lions and elephants remain near-certain.', // Feb
    'Peak calving season on the Ndutu plains — predictable, dramatic predator activity around newborn wildebeest. Lions and elephants remain near-certain.', // Mar
    'The migration has moved on from Ndutu; lions and elephants remain near-certain, though overall wildlife density eases slightly.', // Apr
    'The migration has moved on from Ndutu; lions and elephants remain near-certain, though overall wildlife density eases slightly.', // May
    'The migration\'s river crossings are underway further north — dramatic, though on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Jun
    'The migration\'s river crossings are underway further north — dramatic, though on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Jul
    'The migration\'s river crossings are underway further north — dramatic, though on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Aug
    'The migration\'s river crossings are underway further north — dramatic, though on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Sep
    'The migration\'s river crossings are underway further north — dramatic, though on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.', // Oct
    'The migration is moving back south; lions and elephants remain near-certain sightings.', // Nov
    'The migration is moving back south; lions and elephants remain near-certain sightings.', // Dec
  ],
  rwanda: [
    'Dry trails make gorilla trekking easiest this time of year, though sightings themselves are about as close to guaranteed as wildlife viewing gets in any month.', // Jan
    'Dry trails make gorilla trekking easiest this time of year, though sightings themselves are about as close to guaranteed as wildlife viewing gets in any month.', // Feb
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged — trackers still locate a habituated family virtually every day.', // Mar
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged — trackers still locate a habituated family virtually every day.', // Apr
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged — trackers still locate a habituated family virtually every day.', // May
    'Trails are drying out again as trekking conditions improve.', // Jun
    'Dry trails make this the easiest trekking season, though gorilla sightings themselves are about as close to guaranteed as wildlife viewing gets year-round.', // Jul
    'Dry trails make this the easiest trekking season, though gorilla sightings themselves are about as close to guaranteed as wildlife viewing gets year-round.', // Aug
    'Trekking conditions remain good as the dry season continues.', // Sep
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged.', // Oct
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged.', // Nov
    'Trails are drying out again as the dry season approaches.', // Dec
  ],
  uganda: [
    'Dry trails make gorilla and chimpanzee trekking easiest this time of year, though sightings themselves are about as close to guaranteed as wildlife viewing gets in any month.', // Jan
    'Dry trails make gorilla and chimpanzee trekking easiest this time of year, though sightings themselves are about as close to guaranteed as wildlife viewing gets in any month.', // Feb
    'Trails are muddier during the rains, but gorilla and chimpanzee trekking odds remain essentially unchanged.', // Mar
    'Trails are muddier during the rains, but gorilla and chimpanzee trekking odds remain essentially unchanged.', // Apr
    'Trails are muddier during the rains, but gorilla and chimpanzee trekking odds remain essentially unchanged.', // May
    'Dry trails make this the easiest trekking season for gorillas and chimpanzees alike.', // Jun
    'Dry trails make this the easiest trekking season for gorillas and chimpanzees alike.', // Jul
    'Trekking conditions remain good as the dry season continues.', // Aug
    'Trails are muddier during the rains, but gorilla and chimpanzee trekking odds remain essentially unchanged.', // Sep
    'Trails are muddier during the rains, but gorilla and chimpanzee trekking odds remain essentially unchanged.', // Oct
    'Trails are muddier during the rains, but gorilla and chimpanzee trekking odds remain essentially unchanged.', // Nov
    'Trails are drying out again as the dry season approaches.', // Dec
  ],
  botswana: [
    'Elephant, lion, and hippo remain highly reliable at a strong baseline before the flood pulse arrives.', // Jan
    'Elephant, lion, and hippo remain highly reliable at a strong baseline before the flood pulse arrives.', // Feb
    'Elephant, lion, and hippo remain highly reliable at a strong baseline before the flood pulse arrives.', // Mar
    'Elephant, lion, and hippo remain highly reliable at a strong baseline before the flood pulse arrives.', // Apr
    'Floodwaters from Angola\'s distant rains are beginning to arrive, starting to concentrate wildlife along the channels.', // May
    'Peak flood-pulse season — elephant, lion, and hippo sightings are at their most concentrated and reliable. This is also prime time for African wild dogs.', // Jun
    'Peak flood-pulse season — elephant, lion, and hippo sightings are at their most concentrated and reliable. This is also prime time for African wild dogs.', // Jul
    'Peak flood-pulse season — elephant, lion, and hippo sightings are at their most concentrated and reliable. This is also prime time for African wild dogs.', // Aug
    'Peak flood-pulse season — elephant, lion, and hippo sightings are at their most concentrated and reliable. This is also prime time for African wild dogs.', // Sep
    'Peak flood-pulse season — elephant, lion, and hippo sightings are at their most concentrated and reliable. This is also prime time for African wild dogs.', // Oct
    'Floodwaters are receding; elephant, lion, and hippo remain highly reliable at a strong baseline.', // Nov
    'Floodwaters are receding; elephant, lion, and hippo remain highly reliable at a strong baseline.', // Dec
  ],
  zimbabwe: [
    'Rains disperse wildlife across a wider area; elephant and lion sightings at Hwange\'s waterholes are less concentrated.', // Jan
    'Rains disperse wildlife across a wider area; elephant and lion sightings at Hwange\'s waterholes are less concentrated.', // Feb
    'Rains disperse wildlife across a wider area; elephant and lion sightings at Hwange\'s waterholes are less concentrated.', // Mar
    'Waterhole concentrations are beginning to build as the dry season approaches.', // Apr
    'Elephant and lion sightings at Hwange\'s waterholes are building toward their peak.', // May
    'Elephant and lion sightings at Hwange\'s waterholes are building toward their peak.', // Jun
    'Peak dry season — elephant herds are a near-certain sighting at Hwange\'s waterholes, alongside reliable lion sightings.', // Jul
    'Peak dry season — elephant herds are a near-certain sighting at Hwange\'s waterholes, alongside reliable lion sightings.', // Aug
    'Peak dry season — elephant herds are a near-certain sighting at Hwange\'s waterholes, alongside reliable lion sightings.', // Sep
    'Waterhole concentrations remain strong as the dry season continues.', // Oct
    'Rains are returning, dispersing wildlife across a wider area.', // Nov
    'Rains are returning, dispersing wildlife across a wider area.', // Dec
  ],
  zambia: [
    'Thick vegetation and dispersed wildlife make sightings, including leopards, harder to come by during the rains.', // Jan
    'Thick vegetation and dispersed wildlife make sightings, including leopards, harder to come by during the rains.', // Feb
    'Thick vegetation and dispersed wildlife make sightings, including leopards, harder to come by during the rains.', // Mar
    'Conditions are beginning to improve as the dry season approaches.', // Apr
    'Leopard and general wildlife sightings are building toward their peak.', // May
    'Leopard and general wildlife sightings are building toward their peak.', // Jun
    'Peak dry season — South Luangwa\'s leopard odds, among the best in Africa, are at their strongest, alongside concentrated general wildlife.', // Jul
    'Peak dry season — South Luangwa\'s leopard odds, among the best in Africa, are at their strongest, alongside concentrated general wildlife.', // Aug
    'Peak dry season — South Luangwa\'s leopard odds, among the best in Africa, are at their strongest, alongside concentrated general wildlife.', // Sep
    'Sightings remain strong as the dry season continues.', // Oct
    'Rains are returning; thick vegetation makes sightings, including leopards, harder to come by.', // Nov
    'Rains are returning; thick vegetation makes sightings, including leopards, harder to come by.', // Dec
  ],
  namibia: [
    'Wildlife is more dispersed during the rains; cheetah and general sightings are at their least concentrated.', // Jan
    'Wildlife is more dispersed during the rains; cheetah and general sightings are at their least concentrated.', // Feb
    'Wildlife is more dispersed during the rains; cheetah and general sightings are at their least concentrated.', // Mar
    'Conditions are beginning to improve as the dry season approaches.', // Apr
    'Wildlife concentrations are building toward their peak.', // May
    'Wildlife concentrations are building toward their peak.', // Jun
    'Peak dry season — cheetah sightings and general wildlife concentrations around remaining water are at their strongest. Desert-adapted elephant and black rhino tracking in Damaraland works year-round.', // Jul
    'Peak dry season — cheetah sightings and general wildlife concentrations around remaining water are at their strongest. Desert-adapted elephant and black rhino tracking in Damaraland works year-round.', // Aug
    'Peak dry season — cheetah sightings and general wildlife concentrations around remaining water are at their strongest. Desert-adapted elephant and black rhino tracking in Damaraland works year-round.', // Sep
    'Concentrations remain strong as the dry season continues.', // Oct
    'Rains are returning, dispersing wildlife across a wider area.', // Nov
    'Rains are returning, dispersing wildlife across a wider area.', // Dec
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
