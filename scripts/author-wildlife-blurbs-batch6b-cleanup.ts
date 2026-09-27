import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

// ---- Category text (shared across many destinations with no distinct wildlife story) ----
const CITY_TEXT = 'Wildlife-watching isn\'t a dedicated focus here — this is a city and cultural destination first.';
const SCENIC_TEXT = 'Wildlife-watching isn\'t a dedicated focus here — this is a landscape and scenic destination first.';
const BEACH_TEXT = 'Wildlife-watching isn\'t a dedicated focus here beyond common reef life.';
const DESERT_TEXT = 'Desert bighorn sheep and mule deer are present but genuinely elusive; wildlife-watching isn\'t a dedicated focus here.';
const CULTURAL_TEXT = 'Wildlife-watching isn\'t a dedicated focus here.';

const CITY_IDS = [
  'amsterdam', 'athens', 'bangkok', 'barcelona', 'beijing', 'berlin', 'budapest', 'buenosaires',
  'chicago', 'copenhagen', 'dubai', 'edinburgh', 'hongkong', 'istanbul', 'lisbon', 'london',
  'mexicocity', 'new-orleans', 'nyc', 'paris', 'prague', 'quebec-city', 'rome', 'seoul',
  'singapore', 'tokyo-kyoto', 'vienna', 'havana', 'sydney',
];
const SCENIC_IDS = [
  'algarve', 'amalfi', 'andalucia', 'aspen', 'basque-country', 'bavaria-munich', 'black-forest',
  'bordeaux', 'champagne', 'cornwall', 'cotswolds', 'croatia', 'douro-valley-porto', 'hudson-valley',
  'lake-district', 'mallorca', 'mendoza', 'napa', 'nice-riviera', 'piedmont', 'provence', 'puglia',
  'rioja', 'sardinia', 'sicily', 'tuscany', 'vermont', 'charleston-savannah', 'snowdonia',
  'st-andrews-fife', 'tbilisi-caucasus', 'fjords', 'queenstown', 'north-island', 'whistler',
];
const BEACH_IDS = [
  'aruba', 'bahamas', 'borabora', 'colombian-caribbean', 'fiji', 'jamaica', 'mauritius',
  'palawan', 'papua-new-guinea', 'turks-caicos', 'santorini',
];
const DESERT_IDS = ['arches-canyonlands', 'death-valley', 'joshua-tree', 'sedona'];
const CULTURAL_IDS = [
  'angkor', 'bagan', 'chiapas', 'guilin-yangshuo', 'luangprabang', 'taiwan', 'vietnam',
  'uzbekistan', 'kyrgyzstan', 'oaxaca', 'san-miguel-guanajuato', 'egypt', 'jordan', 'madeira',
  'texas-hill-country', 'rio', 'puerto-rico',
];

// ---- Light individual real-fact entries (still genuinely flat/non-seasonal) ----
const LIGHT_OVERVIEWS: Record<string, string> = {
  acadia: 'Harbor seals are a common sighting on boat tours along the coast; otherwise wildlife-watching is secondary to the scenery.',
  ireland: 'Grey seals are a common, reliable sighting on boat tours along the coast; otherwise wildlife-watching isn\'t a dedicated focus here.',
  'belfast-giants-causeway': 'Grey seals are a common sighting along the Antrim coast; otherwise wildlife-watching isn\'t a dedicated focus here.',
  lapland: 'Reindeer are a common sight, though most encountered are herded rather than truly wild.',
  'bend-crater-lake': 'Black bears and mule deer are present in the surrounding forests, though wildlife-watching is secondary to the scenery here.',
  uluru: 'Red kangaroos are a real, fairly common sighting around the base at dawn and dusk, though wildlife-watching is secondary to the rock itself.',
  'badlands-black-hills': 'Custer State Park\'s bison herd, one of the largest publicly owned in the world, is a near-guaranteed roadside sighting. Prairie dog towns are common in Badlands National Park itself.',
  morocco: 'Barbary macaques, Africa\'s only wild monkey species outside the sub-Saharan region, are a real, fairly common sighting in the Atlas Mountains\' cedar forests.',
  chamonix: 'Marmots and ibex are common sightings on the higher alpine trails, especially in summer.',
  swissalps: 'Marmots, ibex, and chamois are common sightings on the higher alpine trails, especially in summer.',
  dolomites: 'Marmots and chamois are common sightings on the higher alpine trails, especially in summer.',
  pakistan: 'Markhor, Pakistan\'s national animal and one of the world\'s largest wild goats, live in the northern mountains, though sightings are genuinely rare and require a dedicated trip to reserves like Chitral Gol.',
  mongolia: 'Wild Bactrian camels and Przewalski\'s horses, the last truly wild horse species, live in remote parts of the Gobi, though most visitors\' camel and horse encounters here are with domesticated herds rather than these rare wild populations.',
  atacama: 'Vicuña, a wild, undomesticated relative of the llama, are a real, fairly common sighting on the high Altiplano.',
  uyuni: 'Vicuña, a wild, undomesticated relative of the llama, are a real, fairly common sighting on the high Altiplano surrounding the salt flat.',
  palau: 'Jellyfish Lake\'s population of stingless jellyfish fluctuates significantly from year to year and isn\'t always present in the large numbers it\'s known for — worth checking current conditions before planning a trip around it.',
  'chiang-mai': 'Ethical elephant sanctuaries here offer a near-guaranteed, up-close encounter, though it\'s with rescued, non-wild elephants rather than a truly wild sighting.',
  'milford-sound-fiordland': 'New Zealand fur seals are a common, reliable sighting on boat cruises through the sound.',
  'marlborough-abel-tasman': 'New Zealand fur seal colonies are a common, reliable sighting on boat trips and kayak tours along the coast.',
  'north-cascades': 'Black bears and mountain goats are present, though wildlife-watching is secondary to the scenery here.',
  'sequoia-kings-canyon': 'Black bears are present and occasionally seen foraging, particularly in the giant sequoia groves.',
  'upper-peninsula': 'Black bears and moose are present in the forests, though sightings take real luck.',
};

// ---- 10 destinations where the real draw is already owned by whaleWatching/birding; light seasonal touch only ----
const REDUNDANT_OVERVIEWS: Record<string, string> = {
  azores: 'Whales pass through on migration each spring, though wildlife-watching beyond that isn\'t otherwise a dedicated focus here.',
  'big-island': 'Humpback whales are visible offshore each winter, though wildlife-watching beyond that isn\'t a dedicated focus here.',
  canaries: 'Whale and dolphin activity picks up modestly each spring, though wildlife-watching isn\'t otherwise a dedicated focus here.',
  'cape-cod-islands': 'Whales are visible offshore in the warmer months, though wildlife-watching beyond that isn\'t a dedicated focus here.',
  'faroe-islands': 'Seabird cliffs are the main wildlife draw here each summer; beyond that, wildlife-watching isn\'t a dedicated focus.',
  lofoten: 'Orca follow the winter herring run close to shore, and seabird cliffs are active each summer; beyond that, wildlife-watching isn\'t a dedicated focus here.',
  'los-cabos': 'Gray whales calve in the sheltered waters here each winter, though wildlife-watching beyond that isn\'t a dedicated focus.',
  maui: 'Humpback whales are visible offshore each winter, though wildlife-watching beyond that isn\'t a dedicated focus here.',
  okinawa: 'Humpback whales pass through the Kerama Islands each winter, though wildlife-watching beyond that isn\'t a dedicated focus here.',
  'punta-cana': 'Humpback whales gather off Samaná each winter, though wildlife-watching beyond that isn\'t a dedicated focus here.',
};

const REDUNDANT_BASE = 'Wildlife-watching isn\'t a dedicated focus here outside the seasonal window noted above.';
const REDUNDANT_PEAK: Record<string, string> = {
  azores: 'Whales are passing through on migration.',
  'big-island': 'Humpback whales are visible offshore.',
  canaries: 'Whale and dolphin activity is at its modest seasonal peak.',
  'cape-cod-islands': 'Whales are visible offshore.',
  'faroe-islands': 'Seabird cliffs are active with nesting colonies.',
  lofoten: 'Orca follow the winter herring run close to shore.',
  'los-cabos': 'Gray whales are calving in the sheltered waters here.',
  maui: 'Humpback whales are visible offshore.',
  okinawa: 'Humpback whales are passing through the Kerama Islands.',
  'punta-cana': 'Humpback whales are gathering off Samaná.',
};
const LOFOTEN_BIRD_PEAK = 'Seabird cliffs are active with nesting colonies.';

// month indices (1-12) that count as "peak" for each redundant destination
const REDUNDANT_PEAK_MONTHS: Record<string, number[]> = {
  azores: [3, 4, 5, 6],
  'big-island': [1, 2, 3, 4, 12],
  canaries: [3, 4, 5],
  'cape-cod-islands': [4, 5, 6, 9, 10],
  'faroe-islands': [5, 6, 7, 8],
  lofoten: [1, 11, 12], // orca peak; summer bird peak handled separately below
  'los-cabos': [1, 2, 3, 4, 12],
  maui: [1, 2, 3, 4, 12],
  okinawa: [1, 2, 3],
  'punta-cana': [1, 2, 3],
};
const LOFOTEN_BIRD_MONTHS = [5, 6, 7, 8];

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

function buildOverviews(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of CITY_IDS) out[id] = CITY_TEXT;
  for (const id of SCENIC_IDS) out[id] = SCENIC_TEXT;
  for (const id of BEACH_IDS) out[id] = BEACH_TEXT;
  for (const id of DESERT_IDS) out[id] = DESERT_TEXT;
  for (const id of CULTURAL_IDS) out[id] = CULTURAL_TEXT;
  for (const [id, text] of Object.entries(LIGHT_OVERVIEWS)) out[id] = text;
  for (const [id, text] of Object.entries(REDUNDANT_OVERVIEWS)) out[id] = text;
  return out;
}

function buildMonthly(id: string): string[] {
  if (id in REDUNDANT_OVERVIEWS) {
    if (id === 'lofoten') {
      return Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        if (REDUNDANT_PEAK_MONTHS.lofoten.includes(m)) return REDUNDANT_PEAK.lofoten;
        if (LOFOTEN_BIRD_MONTHS.includes(m)) return LOFOTEN_BIRD_PEAK;
        return REDUNDANT_BASE;
      });
    }
    const peakMonths = REDUNDANT_PEAK_MONTHS[id] ?? [];
    return Array.from({ length: 12 }, (_, i) => (peakMonths.includes(i + 1) ? REDUNDANT_PEAK[id] : REDUNDANT_BASE));
  }
  const overview = buildOverviews()[id];
  return Array(12).fill(overview);
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const overviews = buildOverviews();
  const ids = Object.keys(overviews);
  console.log(`${ids.length} destinations in this batch`);

  for (const id of ids) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const monthly = buildMonthly(id);
    if (monthly.length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: overviews[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: monthly },
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
