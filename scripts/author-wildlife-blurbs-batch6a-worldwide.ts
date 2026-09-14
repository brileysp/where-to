import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

const OVERVIEWS: Record<string, string> = {
  'cape-town': 'Chacma baboons are a near-guaranteed sighting around Cape Point and Table Mountain National Park. Cape fur seals are reliably seen year-round on boat trips out to Duiker Island.',
  ethiopia: 'Gelada baboons are close to a guaranteed sighting in the Simien Mountains — troops of dozens gather right along the trekking routes. Ethiopian wolves are also present but genuinely rare, best looked for in the early morning.',
  everglades: 'Alligators are close to a guaranteed sighting in the dry season, concentrating around the remaining water at spots like Shark Valley and the Anhinga Trail. They\'re still present the rest of the year, just more spread out.',
  gbr: 'Green and loggerhead turtles are a common sight on the reef year-round. Dwarf minke whales, found nowhere else in the world, pass through for a brief window each June and July.',
  ghana: 'Mole National Park is West Africa\'s most accessible place to see wild elephants — herds concentrate around the remaining waterholes in the dry season, though sightings are never guaranteed.',
  hokkaido: 'Shiretoko\'s brown bears are the real highlight — boat cruises along the coast in autumn get remarkably close as bears fish for salmon at the river mouths. Kushiro\'s red-crowned cranes, doing their elaborate courtship dance on the snow each winter, are a famous, only-in-Hokkaido sight of their own.',
  kerala: 'Wild elephants are a highly reliable sighting on the Periyar boat safari, where herds regularly come down to the reservoir to drink. Tigers are present in the reserve but, as almost everywhere, a rare sighting.',
  kruger: 'Kruger is one of the most reliable places on Earth for the Big Five. Lions, elephants, and buffalo are close to guaranteed on a multi-day safari; leopards are the hardest of the five to find, even here, and rhino sightings are real but not a given.',
  madagascar: 'Lemurs, found nowhere else on Earth, are the reason to come — from ring-tailed lemurs at Berenty to the leaping sifaka, sightings are reliable across the dry season when trekking trails are open. The rainy season, roughly December through March, makes many reserves harder to reach and sightings less reliable.',
  maldives: 'Hanifaru Bay\'s manta ray and whale shark aggregation, one of the largest in the world, is a real seasonal spectacle each year.',
  'monterey-big-sur': 'Año Nuevo\'s elephant seal colony is a genuinely dramatic, reliable sighting during the winter breeding season, with males fighting for territory and pups born on the beach. Outside that window, the colony thins out considerably.',
  'nova-scotia': 'Moose are the real wildlife draw in Cape Breton Highlands National Park — a genuine, if patient, sighting most reliable in the early morning or evening during summer.',
  olympic: 'Roosevelt elk, among the largest elk in North America, are a real, fairly common sighting in the Hoh Rainforest and along the park\'s rivers — most visible during the fall rut.',
  peru: 'Vicuña, a wild, undomesticated relative of the llama, are visible on high-altitude routes around the Sacred Valley. Spectacled bear, South America\'s only bear species, live in the cloud forest near Machu Picchu, though sightings are genuinely rare.',
  rivieramaya: 'Whale sharks gather off Isla Holbox each summer, one of the largest reliable aggregations anywhere — a genuine, if seasonal, spectacle.',
  'rocky-mountain': 'Elk are a near-guaranteed sighting, especially around Estes Park, and the fall rut — bugling bulls, real traffic jams from roadside herds — is the park\'s signature wildlife moment.',
  'scottish-highlands-skye': 'Red deer are common across the Highlands, and the autumn rut — roaring, antler-clashing stags — is a real, dramatic seasonal spectacle.',
  seychelles: 'Aldabra giant tortoises, some of the largest in the world, roam freely and reliably on Curieuse Island year-round. Whale sharks pass through for a real, if brief, window each October and November.',
  tasmania: 'Tasmanian devils are the animal everyone wants to see, and a wildlife sanctuary like Bonorong gives a near-certain, up-close sighting. Actually finding one truly wild is a much rarer, nocturnal, luck-based encounter. Wombats are a more reliable wild sighting, especially around Cradle Mountain at dusk.',
  thailand: 'Wildlife-watching isn\'t a dedicated focus here, but long-tailed macaques are a common, easy sighting on boat trips to spots like Monkey Beach.',
  bali: 'Wildlife-watching isn\'t a dedicated focus here, but long-tailed macaques are a common, easy sighting at temple sites like Ubud\'s Monkey Forest and Uluwatu.',
  barbados: 'Green monkeys, introduced centuries ago from West Africa, are a common, easy sighting around the island, including at the Barbados Wildlife Reserve.',
  'vancouver-island': 'Black bears are common in the island\'s forests, most visible foraging along roadsides and estuaries in late summer as salmon runs begin.',
  yosemite: 'Black bears are present year-round but most active — and most often seen foraging in meadows — in spring and fall.',
};

const CAPETOWN_BASE = 'Baboon and seal sightings remain reliable year-round.';
const CAPETOWN_WET = 'Winter rains make trail conditions slightly less pleasant, though baboon and seal sightings remain reliable.';

const ETHIOPIA_PEAK = 'Peak dry season — the best trekking conditions, with gelada troops easy to find along the trails.';
const ETHIOPIA_WET = 'Wetter conditions make trekking harder, though gelada sightings remain reliable regardless of season.';

const EVERGLADES_PEAK = 'Dry season — alligators concentrate around the remaining water, close to a guaranteed sighting.';
const EVERGLADES_WET = 'Wetter conditions spread wildlife out; alligators are still present, just more dispersed.';
const EVERGLADES_BUILDING = 'Water levels are beginning to drop, gradually concentrating wildlife again.';

const GBR_BASE = 'Baseline reef visibility; turtles remain a common sight.';
const GBR_BUILDING = 'Visibility is improving as the dry season builds.';
const GBR_PEAK_MINKE = 'Peak reef visibility, and the brief window each year when dwarf minke whales pass through.';
const GBR_PEAK = 'Peak reef visibility; turtles remain common.';
const GBR_EASING = 'Still strong visibility as the dry season eases.';

const GHANA_PEAK = 'Peak dry season — elephant herds concentrate around the remaining waterholes.';
const GHANA_EASING = 'Still good odds as the dry season eases.';
const GHANA_WET = 'Wetter conditions disperse elephants more widely across the park.';
const GHANA_BUILDING = 'Odds are building as the dry season approaches.';

const HOKKAIDO_CRANE = 'Red-crowned cranes perform their courtship dance on the snow near Kushiro — a famous, only-in-Hokkaido sight.';
const HOKKAIDO_BASE = 'Baseline season — neither the cranes nor the bear salmon run are active.';
const HOKKAIDO_BEAR = 'Brown bears gather at Shiretoko\'s river mouths to fish for salmon, visible on coastal boat cruises.';

const KERALA_PEAK = 'Peak season — elephant herds are highly reliable at the Periyar reservoir.';
const KERALA_EASING = 'Still good odds as the dry season eases.';
const KERALA_WET = 'Monsoon conditions disperse wildlife more widely; elephant sightings are less concentrated.';
const KERALA_BUILDING = 'Odds are building as the dry season approaches.';

const KRUGER_WET = 'The wet season is lush and green; the Big Five are present but more dispersed.';
const KRUGER_BUILDING = 'Conditions are improving as the dry season builds.';
const KRUGER_GOOD = 'Drier conditions are improving sightlines.';
const KRUGER_PEAK = 'Peak season — the driest conditions concentrate animals at waterholes, the best sightlines of the year.';
const KRUGER_EASING = 'Still strong odds as the dry season eases.';
const KRUGER_RETURNING = 'Rains are returning; animals begin dispersing again.';

const MADAGASCAR_WET = 'The rainy season makes many reserves harder to reach; lemur sightings are less reliable.';
const MADAGASCAR_OPENING = 'The dry season is opening and reserves are becoming more accessible.';
const MADAGASCAR_PEAK = 'Peak dry season — reserves are fully accessible and lemur sightings are reliable.';
const MADAGASCAR_EASING = 'Still excellent odds as the dry season eases.';
const MADAGASCAR_RETURNING = 'Rains are returning and access is becoming more difficult again.';

const MALDIVES_BASE = 'Hanifaru Bay\'s aggregation hasn\'t yet formed; baseline reef sightings only.';
const MALDIVES_QUIET = 'The quietest month for the aggregation.';
const MALDIVES_BUILDING = 'The manta ray and whale shark aggregation is building at Hanifaru Bay.';
const MALDIVES_PEAK = 'Peak aggregation season at Hanifaru Bay.';
const MALDIVES_EASING = 'The aggregation is easing but still active.';

const MONTEREY_PEAK = 'Peak breeding season at Año Nuevo — a genuinely dramatic, reliable sighting, with males fighting for territory and pups born on the beach.';
const MONTEREY_QUIET = 'Most seals have returned to sea; the colony is much quieter.';

const NOVASCOTIA_BASE = 'Baseline season — moose are present in Cape Breton Highlands but harder to find.';
const NOVASCOTIA_PEAK = 'Peak season — the best odds of the year for moose in the early morning or evening.';

const OLYMPIC_BASE = 'Baseline season for Roosevelt elk sightings.';
const OLYMPIC_BUILDING = 'Odds are building toward the fall rut.';
const OLYMPIC_RUT_PEAK = 'The fall rut peaks — bugling and sparring bulls are a dramatic, reliable sight.';
const OLYMPIC_RUT_EASING = 'The rut is easing but still active.';

const PERU_WET = 'Wetter conditions make high-altitude trekking harder; sightings are less reliable.';
const PERU_BUILDING = 'Conditions are improving as the dry season builds.';
const PERU_PEAK = 'Peak dry season — the best trekking conditions for vicuña sightings on high-altitude routes.';
const PERU_EASING = 'Still decent conditions as the dry season eases.';

const RIVIERAMAYA_BASE = 'Whale sharks haven\'t yet arrived off Isla Holbox.';
const RIVIERAMAYA_PEAK = 'Peak whale shark season off Isla Holbox — one of the largest reliable aggregations anywhere.';

const ROCKYMTN_BASE = 'Elk remain a near-guaranteed sighting year-round.';
const ROCKYMTN_RUT = 'The fall rut peaks around Estes Park — bugling bulls and real traffic jams from roadside herds.';

const SCOTLAND_BASE = 'Red deer remain common and reliably seen year-round.';
const SCOTLAND_RUT_BUILDING = 'The autumn rut is building — stags begin roaring and sparring.';
const SCOTLAND_RUT_PEAK = 'Peak rut season — roaring, antler-clashing stags are a dramatic, reliable sight.';

const SEYCHELLES_BASE = 'Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren\'t present.';
const SEYCHELLES_WHALESHARK = 'Whale sharks pass through for a real, if brief, window, on top of the year-round tortoise sightings.';

const TASMANIA_TEXT = 'Tasmanian devils are close to guaranteed at a wildlife sanctuary like Bonorong; a truly wild sighting is much rarer and nocturnal. Wombats are a more reliable wild sighting, especially around Cradle Mountain at dusk.';

const THAILAND_CALM = 'Calm seas make boat trips to spots like Monkey Beach easy; macaques are a common, easy sighting.';
const THAILAND_BUILDING = 'Seas are building toward the monsoon; boat trips remain workable.';
const THAILAND_MONSOON = 'Monsoon season brings rougher seas, making some boat trips to Monkey Beach less reliable.';

const BALI_DRY = 'Dry-season conditions make for a more comfortable visit to temple sites like Ubud\'s Monkey Forest, where macaques remain a common, easy sighting.';
const BALI_WET = 'Wetter conditions make for a less comfortable visit, though macaques remain a common, easy sighting at the temple sites.';

const BARBADOS_TEXT = 'Green monkeys remain a common, easy sighting year-round, including at the Barbados Wildlife Reserve.';

const VANISLAND_BASE = 'Baseline season — black bears are present in the island\'s forests but less concentrated.';
const VANISLAND_BUILDING = 'Odds are building as salmon begin returning to the rivers.';
const VANISLAND_PEAK = 'Peak season — salmon runs bring black bears down to rivers and estuaries, the best odds of the year.';
const VANISLAND_EASING = 'Odds are easing as the salmon run winds down.';

const YOSEMITE_QUIET = 'Black bears are less active this time of year.';
const YOSEMITE_SPRING = 'Spring activity peak — bears are most often seen foraging in meadows.';
const YOSEMITE_SUMMER = 'Baseline summer activity.';
const YOSEMITE_FALL = 'Fall activity peak — bears are most often seen foraging in meadows ahead of winter.';

const MONTHLY: Record<string, string[]> = {
  'cape-town': [
    CAPETOWN_BASE, CAPETOWN_BASE, CAPETOWN_BASE, CAPETOWN_BASE, CAPETOWN_BASE,
    CAPETOWN_WET,
    CAPETOWN_BASE, CAPETOWN_BASE, CAPETOWN_BASE, CAPETOWN_BASE, CAPETOWN_BASE, CAPETOWN_BASE,
  ],
  ethiopia: [
    ETHIOPIA_PEAK, ETHIOPIA_PEAK, ETHIOPIA_PEAK,
    ETHIOPIA_WET, ETHIOPIA_WET, ETHIOPIA_WET, ETHIOPIA_WET, ETHIOPIA_WET, ETHIOPIA_WET,
    ETHIOPIA_PEAK, ETHIOPIA_PEAK, ETHIOPIA_PEAK,
  ],
  everglades: [
    EVERGLADES_PEAK, EVERGLADES_PEAK, EVERGLADES_PEAK, EVERGLADES_PEAK,
    EVERGLADES_WET, EVERGLADES_WET, EVERGLADES_WET, EVERGLADES_WET, EVERGLADES_WET,
    EVERGLADES_BUILDING,
    EVERGLADES_WET,
    EVERGLADES_PEAK,
  ],
  gbr: [
    GBR_BASE, GBR_BASE, GBR_BASE,
    GBR_BUILDING, GBR_BUILDING,
    GBR_PEAK_MINKE, GBR_PEAK_MINKE,
    GBR_PEAK, GBR_PEAK,
    GBR_EASING, GBR_EASING, GBR_EASING,
  ],
  ghana: [
    GHANA_PEAK, GHANA_PEAK, GHANA_PEAK,
    GHANA_EASING,
    GHANA_WET, GHANA_WET, GHANA_WET,
    GHANA_BUILDING,
    GHANA_WET,
    GHANA_WET,
    GHANA_BUILDING, GHANA_BUILDING,
  ],
  hokkaido: [
    HOKKAIDO_CRANE, HOKKAIDO_CRANE,
    HOKKAIDO_BASE, HOKKAIDO_BASE, HOKKAIDO_BASE, HOKKAIDO_BASE, HOKKAIDO_BASE, HOKKAIDO_BASE,
    HOKKAIDO_BEAR, HOKKAIDO_BEAR,
    HOKKAIDO_BASE, HOKKAIDO_BASE,
  ],
  kerala: [
    KERALA_PEAK, KERALA_PEAK, KERALA_PEAK,
    KERALA_EASING,
    KERALA_WET, KERALA_WET, KERALA_WET, KERALA_WET,
    KERALA_BUILDING, KERALA_BUILDING,
    KERALA_EASING,
    KERALA_BUILDING,
  ],
  kruger: [
    KRUGER_WET, KRUGER_WET, KRUGER_WET,
    KRUGER_BUILDING,
    KRUGER_GOOD, KRUGER_GOOD,
    KRUGER_PEAK, KRUGER_PEAK,
    KRUGER_EASING,
    KRUGER_RETURNING, KRUGER_RETURNING, KRUGER_RETURNING,
  ],
  madagascar: [
    MADAGASCAR_WET, MADAGASCAR_WET, MADAGASCAR_WET,
    MADAGASCAR_OPENING,
    MADAGASCAR_PEAK, MADAGASCAR_PEAK, MADAGASCAR_PEAK, MADAGASCAR_PEAK, MADAGASCAR_PEAK, MADAGASCAR_PEAK,
    MADAGASCAR_EASING,
    MADAGASCAR_RETURNING,
  ],
  maldives: [
    MALDIVES_BASE, MALDIVES_BASE, MALDIVES_BASE, MALDIVES_BASE,
    MALDIVES_QUIET,
    MALDIVES_BUILDING, MALDIVES_BUILDING,
    MALDIVES_PEAK, MALDIVES_PEAK,
    MALDIVES_EASING, MALDIVES_EASING,
    MALDIVES_BASE,
  ],
  'monterey-big-sur': [
    MONTEREY_PEAK, MONTEREY_PEAK, MONTEREY_PEAK, MONTEREY_PEAK,
    MONTEREY_QUIET, MONTEREY_QUIET, MONTEREY_QUIET, MONTEREY_QUIET, MONTEREY_QUIET, MONTEREY_QUIET, MONTEREY_QUIET,
    MONTEREY_PEAK,
  ],
  'nova-scotia': [
    NOVASCOTIA_BASE, NOVASCOTIA_BASE, NOVASCOTIA_BASE, NOVASCOTIA_BASE, NOVASCOTIA_BASE, NOVASCOTIA_BASE,
    NOVASCOTIA_PEAK, NOVASCOTIA_PEAK, NOVASCOTIA_PEAK,
    NOVASCOTIA_BASE, NOVASCOTIA_BASE, NOVASCOTIA_BASE,
  ],
  olympic: [
    OLYMPIC_BASE, OLYMPIC_BASE, OLYMPIC_BASE, OLYMPIC_BASE,
    OLYMPIC_BUILDING, OLYMPIC_BUILDING, OLYMPIC_BUILDING, OLYMPIC_BUILDING,
    OLYMPIC_RUT_PEAK,
    OLYMPIC_RUT_EASING,
    OLYMPIC_BASE, OLYMPIC_BASE,
  ],
  peru: [
    PERU_WET, PERU_WET, PERU_WET,
    PERU_BUILDING,
    PERU_PEAK, PERU_PEAK, PERU_PEAK, PERU_PEAK, PERU_PEAK,
    PERU_EASING, PERU_EASING,
    PERU_WET,
  ],
  rivieramaya: [
    RIVIERAMAYA_BASE, RIVIERAMAYA_BASE, RIVIERAMAYA_BASE, RIVIERAMAYA_BASE, RIVIERAMAYA_BASE,
    RIVIERAMAYA_PEAK, RIVIERAMAYA_PEAK, RIVIERAMAYA_PEAK, RIVIERAMAYA_PEAK,
    RIVIERAMAYA_BASE, RIVIERAMAYA_BASE, RIVIERAMAYA_BASE,
  ],
  'rocky-mountain': [
    ROCKYMTN_BASE, ROCKYMTN_BASE, ROCKYMTN_BASE, ROCKYMTN_BASE, ROCKYMTN_BASE, ROCKYMTN_BASE, ROCKYMTN_BASE, ROCKYMTN_BASE,
    ROCKYMTN_RUT, ROCKYMTN_RUT,
    ROCKYMTN_BASE, ROCKYMTN_BASE,
  ],
  'scottish-highlands-skye': [
    SCOTLAND_BASE, SCOTLAND_BASE, SCOTLAND_BASE, SCOTLAND_BASE, SCOTLAND_BASE, SCOTLAND_BASE, SCOTLAND_BASE, SCOTLAND_BASE,
    SCOTLAND_RUT_BUILDING,
    SCOTLAND_RUT_PEAK,
    SCOTLAND_BASE, SCOTLAND_BASE,
  ],
  seychelles: [
    SEYCHELLES_BASE, SEYCHELLES_BASE, SEYCHELLES_BASE, SEYCHELLES_BASE, SEYCHELLES_BASE,
    SEYCHELLES_BASE, SEYCHELLES_BASE, SEYCHELLES_BASE, SEYCHELLES_BASE,
    SEYCHELLES_WHALESHARK, SEYCHELLES_WHALESHARK,
    SEYCHELLES_BASE,
  ],
  tasmania: Array(12).fill(TASMANIA_TEXT),
  thailand: [
    THAILAND_CALM, THAILAND_CALM,
    THAILAND_BUILDING, THAILAND_BUILDING, THAILAND_BUILDING,
    THAILAND_MONSOON, THAILAND_MONSOON, THAILAND_MONSOON, THAILAND_MONSOON, THAILAND_MONSOON,
    THAILAND_CALM, THAILAND_CALM,
  ],
  bali: [
    BALI_WET, BALI_WET, BALI_WET,
    BALI_DRY, BALI_DRY, BALI_DRY, BALI_DRY, BALI_DRY, BALI_DRY, BALI_DRY,
    BALI_WET, BALI_WET,
  ],
  barbados: Array(12).fill(BARBADOS_TEXT),
  'vancouver-island': [
    VANISLAND_BASE, VANISLAND_BASE,
    VANISLAND_BUILDING, VANISLAND_BUILDING, VANISLAND_BUILDING,
    VANISLAND_PEAK, VANISLAND_PEAK, VANISLAND_PEAK, VANISLAND_PEAK,
    VANISLAND_EASING,
    VANISLAND_BASE, VANISLAND_BASE,
  ],
  yosemite: [
    YOSEMITE_QUIET, YOSEMITE_QUIET, YOSEMITE_QUIET,
    YOSEMITE_SPRING, YOSEMITE_SPRING,
    YOSEMITE_SUMMER, YOSEMITE_SUMMER, YOSEMITE_SUMMER,
    YOSEMITE_FALL, YOSEMITE_FALL,
    YOSEMITE_QUIET, YOSEMITE_QUIET,
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
