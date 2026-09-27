import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

const OVERVIEWS: Record<string, string> = {
  pantanal: 'Jaguar sightings along the rivers here are genuinely likely in the dry season (July-October) — Pantanal\'s open floodplain makes for some of the best odds anywhere for the species. Capybara, caiman, and hyacinth macaws, the world\'s largest parrot, are common sightings.',
  'costa-rica': 'Sloths are the animal most visitors have their heart set on here, and they\'re genuinely easy to find in the right reserves — a slow-moving, near-guaranteed sighting. Howler, capuchin, and squirrel monkeys are common too.',
  panama: 'Sloths and howler monkeys are real, fairly common sightings in the canal-side rainforest, though wildlife-watching here is more incidental than a dedicated focus of a visit.',
  belize: 'Cockscomb Basin, the world\'s first jaguar reserve, protects a real population — though actually seeing one remains rare, even here. Howler monkeys and manatees are more reliable sightings.',
  guatemala: 'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.',
  nicaragua: 'Howler monkeys are a real, common sight in the forest reserves. Olive ridley sea turtles come ashore to nest at La Flor in large synchronized arrivals.',
  'colombian-andes': 'Spectacled bears, South America\'s only bear species, live in the cloud forest here, though sightings are rare and require real luck or a dedicated guide.',
  'ecuadorian-andes': 'Mountain tapir, a rare high-Andean specialist, and spectacled bear are both present in the cloud forest, though sightings of either take real luck.',
  'el-chalten': 'Guanaco are a common sight on the trails around Fitz Roy. Puma are present but sightings are a matter of luck, not a guided pursuit.',
  'argentine-lake-district': 'The world\'s southernmost parrot species, the austral parakeet, lives in the forests here, alongside foxes — though this is more a scenery destination than one built around dedicated wildlife encounters.',
  'chilean-lake-district': 'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.',
  'tierra-del-fuego': 'King penguins breed at a small, real colony here — one of the few places to see them outside sub-Antarctic islands. Magellanic penguins, sea lions, and guanaco are also regular sightings each austral summer.',
};

const MONTHLY: Record<string, string[]> = {
  pantanal: [
    'Capybara, caiman, and hyacinth macaws remain common; jaguar sightings are far less likely with higher water dispersing them across a wider area.', 'Capybara, caiman, and hyacinth macaws remain common; jaguar sightings are far less likely with higher water dispersing them across a wider area.', 'Capybara, caiman, and hyacinth macaws remain common; jaguar sightings are far less likely with higher water dispersing them across a wider area.',
    'Water levels are beginning to drop, slowly improving jaguar odds along the rivers.', 'Water levels are beginning to drop, slowly improving jaguar odds along the rivers.', 'Water levels are beginning to drop, slowly improving jaguar odds along the rivers.',
    'Peak dry season — jaguar sightings along the rivers are genuinely likely, among the best odds anywhere for the species. Capybara, caiman, and hyacinth macaws remain common.', 'Peak dry season — jaguar sightings along the rivers are genuinely likely, among the best odds anywhere for the species. Capybara, caiman, and hyacinth macaws remain common.', 'Peak dry season — jaguar sightings along the rivers are genuinely likely, among the best odds anywhere for the species. Capybara, caiman, and hyacinth macaws remain common.', 'Peak dry season — jaguar sightings along the rivers are genuinely likely, among the best odds anywhere for the species. Capybara, caiman, and hyacinth macaws remain common.',
    'Rains are returning, easing jaguar odds as water levels rise; capybara, caiman, and hyacinth macaws remain common.',
    'Capybara, caiman, and hyacinth macaws remain common; jaguar sightings are far less likely with higher water dispersing them across a wider area.',
  ],
  'costa-rica': [
    'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.', 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.', 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.', 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.', 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.', 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.', 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.', 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.',
    'Heavier rains ease sightings slightly, though sloths and monkeys remain reliable.', 'Heavier rains ease sightings slightly, though sloths and monkeys remain reliable.',
    'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.', 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too.',
  ],
  panama: [
    'Sloths and howler monkeys are real, fairly common sightings in the canal-side rainforest, though wildlife-watching here is more incidental than a dedicated focus of a visit.', 'Sloths and howler monkeys are real, fairly common sightings in the canal-side rainforest, though wildlife-watching here is more incidental than a dedicated focus of a visit.', 'Sloths and howler monkeys are real, fairly common sightings in the canal-side rainforest, though wildlife-watching here is more incidental than a dedicated focus of a visit.', 'Sloths and howler monkeys are real, fairly common sightings in the canal-side rainforest, though wildlife-watching here is more incidental than a dedicated focus of a visit.',
    'Heavier rains make sightings somewhat less frequent, though sloths and howler monkeys remain present.', 'Heavier rains make sightings somewhat less frequent, though sloths and howler monkeys remain present.', 'Heavier rains make sightings somewhat less frequent, though sloths and howler monkeys remain present.', 'Heavier rains make sightings somewhat less frequent, though sloths and howler monkeys remain present.', 'Heavier rains make sightings somewhat less frequent, though sloths and howler monkeys remain present.', 'Heavier rains make sightings somewhat less frequent, though sloths and howler monkeys remain present.', 'Heavier rains make sightings somewhat less frequent, though sloths and howler monkeys remain present.',
    'Sloths and howler monkeys are real, fairly common sightings in the canal-side rainforest, though wildlife-watching here is more incidental than a dedicated focus of a visit.',
  ],
  belize: Array(12).fill('Cockscomb Basin, the world\'s first jaguar reserve, protects a real population — though actually seeing one remains rare, even here. Howler monkeys and manatees are more reliable sightings.'),
  guatemala: [
    'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.', 'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.', 'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.', 'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.', 'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.',
    'Heavier rains make sightings somewhat less frequent, though howler and spider monkeys remain present around Tikal.', 'Heavier rains make sightings somewhat less frequent, though howler and spider monkeys remain present around Tikal.', 'Heavier rains make sightings somewhat less frequent, though howler and spider monkeys remain present around Tikal.', 'Heavier rains make sightings somewhat less frequent, though howler and spider monkeys remain present around Tikal.',
    'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.', 'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.', 'Howler and spider monkeys are a real, common sight around Tikal\'s ruins, along with coatimundis foraging near the trails.',
  ],
  nicaragua: [
    'Howler monkeys are a real, common sight in the forest reserves.', 'Howler monkeys are a real, common sight in the forest reserves.', 'Howler monkeys are a real, common sight in the forest reserves.', 'Howler monkeys are a real, common sight in the forest reserves.', 'Howler monkeys are a real, common sight in the forest reserves.',
    'Heavier rains make general sightings somewhat less frequent, though this is peak season for olive ridley sea turtles coming ashore to nest at La Flor in large synchronized arrivals.', 'Heavier rains make general sightings somewhat less frequent, though this is peak season for olive ridley sea turtles coming ashore to nest at La Flor in large synchronized arrivals.', 'Heavier rains make general sightings somewhat less frequent, though this is peak season for olive ridley sea turtles coming ashore to nest at La Flor in large synchronized arrivals.', 'Heavier rains make general sightings somewhat less frequent, though this is peak season for olive ridley sea turtles coming ashore to nest at La Flor in large synchronized arrivals.', 'Heavier rains make general sightings somewhat less frequent, though this is peak season for olive ridley sea turtles coming ashore to nest at La Flor in large synchronized arrivals.',
    'Howler monkeys are a real, common sight in the forest reserves.', 'Howler monkeys are a real, common sight in the forest reserves.',
  ],
  'colombian-andes': Array(12).fill('Spectacled bears, South America\'s only bear species, live in the cloud forest here, though sightings are rare and require real luck or a dedicated guide.'),
  'ecuadorian-andes': Array(12).fill('Mountain tapir, a rare high-Andean specialist, and spectacled bear are both present in the cloud forest, though sightings of either take real luck.'),
  'el-chalten': Array(12).fill('Guanaco are a common sight on the trails around Fitz Roy. Puma are present but sightings are a matter of luck, not a guided pursuit.'),
  'argentine-lake-district': Array(12).fill('The world\'s southernmost parrot species, the austral parakeet, lives in the forests here, alongside foxes — though this is more a scenery destination than one built around dedicated wildlife encounters.'),
  'chilean-lake-district': [
    'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.', 'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.', 'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.', 'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.',
    'Wetter winter conditions make sightings even less frequent; pudú remain present but genuinely rare to see.', 'Wetter winter conditions make sightings even less frequent; pudú remain present but genuinely rare to see.', 'Wetter winter conditions make sightings even less frequent; pudú remain present but genuinely rare to see.', 'Wetter winter conditions make sightings even less frequent; pudú remain present but genuinely rare to see.',
    'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.', 'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.', 'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.', 'Pudú, the world\'s smallest deer species, live in the forests here, though they\'re shy and genuinely rare to see.',
  ],
  'tierra-del-fuego': [
    'King penguins breed at a small, real colony here — one of the few places to see them outside sub-Antarctic islands. Magellanic penguins, sea lions, and guanaco are also regular sightings during the austral summer.', 'King penguins breed at a small, real colony here — one of the few places to see them outside sub-Antarctic islands. Magellanic penguins, sea lions, and guanaco are also regular sightings during the austral summer.', 'King penguins breed at a small, real colony here — one of the few places to see them outside sub-Antarctic islands. Magellanic penguins, sea lions, and guanaco are also regular sightings during the austral summer.',
    'Outside the austral summer, sightings settle to a quieter baseline; guanaco and sea lions remain present.', 'Outside the austral summer, sightings settle to a quieter baseline; guanaco and sea lions remain present.', 'Outside the austral summer, sightings settle to a quieter baseline; guanaco and sea lions remain present.', 'Outside the austral summer, sightings settle to a quieter baseline; guanaco and sea lions remain present.', 'Outside the austral summer, sightings settle to a quieter baseline; guanaco and sea lions remain present.', 'Outside the austral summer, sightings settle to a quieter baseline; guanaco and sea lions remain present.', 'Outside the austral summer, sightings settle to a quieter baseline; guanaco and sea lions remain present.',
    'King penguins breed at a small, real colony here — one of the few places to see them outside sub-Antarctic islands. Magellanic penguins, sea lions, and guanaco are also regular sightings during the austral summer.', 'King penguins breed at a small, real colony here — one of the few places to see them outside sub-Antarctic islands. Magellanic penguins, sea lions, and guanaco are also regular sightings during the austral summer.',
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
