import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'birding';

type Event = { label: string; weight: number; months: Record<number, number> };

// Birding's first full audit pass this session — 5 parallel batches covering
// all 200 destinations, cross-checked against eBird, Cornell Lab, BirdLife
// International, national birding-trail bodies, and tour-operator itineraries.
// 41 destinations needed a fix: 2 base-score bugs (Azores/Maldives were both
// a literal 0, the only such cases in the entire catalog), ~22 event-timing
// corrections on existing events, and 17 destinations with a real, missing
// seasonal event (several already had vivid, accurate overview/monthly text
// describing the exact phenomenon, with zero score behind it — the same
// "vivid text, flat score" bug pattern found repeatedly elsewhere this
// session, e.g. Monterey Bay's pelagic-seabird text, Iceland's puffin text,
// Rajasthan's Bharatpur text).

const EVENTS: Record<string, Event[]> = {
  // --- base-score bugs ---
  azores: [
    { label: 'Priolo & seabird breeding season', weight: 3, months: { 5: 0.7, 6: 1, 7: 1, 8: 0.8, 9: 0.5 } },
    { label: 'Autumn Nearctic vagrant season (Corvo & Flores)', weight: 2, months: { 9: 0.5, 10: 1, 11: 0.6 } },
  ],
  maldives: [
    { label: 'Winter migratory wader passage', weight: 2, months: { 11: 0.4, 12: 0.7, 1: 1, 2: 1, 3: 0.5 } },
  ],
  // --- event-timing corrections ---
  andalucia: [
    { label: 'Strait of Gibraltar raptor migration', weight: 5, months: { 3: 0.7, 4: 0.6, 5: 0.5, 8: 0.6, 9: 1, 10: 0.7 } },
    { label: 'Doñana wetland wintering waterfowl', weight: 2, months: { 1: 1, 2: 0.7, 12: 1 } },
  ],
  algarve: [
    { label: 'Spring passage', weight: 3, months: { 3: 0.5, 4: 1, 5: 0.7 } },
    { label: 'Autumn passage', weight: 3, months: { 9: 1, 10: 1, 11: 0.4 } },
  ],
  athens: [
    { label: 'Spring migration (peak season)', weight: 3, months: { 3: 0.7, 4: 1, 5: 0.7, 6: 0.3 } },
    { label: 'Autumn migration', weight: 2, months: { 9: 0.7, 10: 1, 11: 0.5 } },
    { label: 'Winter wetland birding', weight: 2, months: { 1: 0.6, 2: 0.6, 12: 0.6 } },
  ],
  bhutan: [
    { label: 'Black-necked crane winter (Phobjikha)', weight: 3, months: { 10: 0.4, 11: 0.7, 12: 1, 1: 1, 2: 0.7 } },
    { label: 'Spring altitudinal migration & breeding', weight: 3, months: { 3: 0.7, 4: 1, 5: 0.8 } },
  ],
  'costa-rica': [
    { label: 'Resplendent quetzal breeding display season', weight: 1, months: { 1: 0.8, 2: 1, 3: 1, 4: 1, 5: 0.4, 12: 0.6 } },
    { label: 'Migration season (despite rain)', weight: 2, months: { 8: 0.3, 9: 0.6, 10: 0.6, 11: 0.3 } },
  ],
  galapagos: [
    { label: 'Seabird breeding season (garua)', weight: 1, months: { 4: 0.4, 5: 0.7, 6: 1, 7: 1, 8: 1, 9: 0.6, 10: 0.4, 11: 0.3 } },
  ],
  'colombian-andes': [
    { label: 'North American migratory birds overwinter', weight: 1, months: { 10: 0.3, 11: 0.6, 12: 1, 1: 1, 2: 1, 3: 0.6 } },
  ],
  ethiopia: [
    { label: 'Dry-season access to highland endemics', weight: 2, months: { 1: 1, 2: 1, 3: 0.6, 10: 0.4, 11: 0.9, 12: 1 } },
  ],
  greenland: [
    { label: 'Arctic seabird colonies (little auks)', weight: 3, months: { 5: 0.6, 6: 1, 7: 1, 8: 1 } },
  ],
  gbr: [
    { label: 'Spring passage', weight: 1, months: { 9: 0.3, 10: 1, 11: 1 } },
    { label: 'Autumn passage', weight: 1, months: { 3: 1, 4: 1 } },
  ],
  peru: [
    { label: 'Dry-season trekking visibility', weight: 4, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 0.6, 10: 0.3 } },
  ],
  provence: [
    { label: 'Camargue wetland breeding season (greater flamingos, herons)', weight: 3, months: { 3: 0.5, 4: 0.8, 5: 1, 6: 0.7, 7: 0.4 } },
  ],
  rio: [
    { label: 'Atlantic Forest breeding-season activity', weight: 2, months: { 9: 0.8, 10: 0.9, 11: 1, 12: 0.7, 1: 0.6, 2: 0.5, 3: 0.4 } },
  ],
  srilanka: [
    { label: 'Northern-winter migrant arrivals', weight: 2, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.55, 12: 0.85 } },
  ],
  tanzania: [
    { label: 'Palearctic migrant arrivals', weight: 4, months: { 1: 1, 2: 1, 3: 0.7, 4: 0.4, 11: 0.85, 12: 0.7 } },
  ],
  uganda: [
    { label: 'Dry-season forest access (Albertine Rift endemics)', weight: 1, months: { 1: 0.6, 2: 0.6, 6: 1, 7: 1, 8: 0.9, 12: 0.6 } },
  ],
  kenya: [
    { label: 'Palearctic migrant arrivals', weight: 4, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.7, 12: 0.85 } },
  ],
  kruger: [
    { label: 'Palearctic migrant arrivals', weight: 2, months: { 10: 0.4, 11: 0.7, 12: 1, 1: 1, 2: 1, 3: 0.6, 4: 0.3 } },
  ],
  hokkaido: [
    { label: 'Red-crowned crane viewing (Kushiro)', weight: 2, months: { 11: 0.3, 12: 0.6, 1: 1, 2: 1, 3: 0.6 } },
  ],
  hongkong: [
    { label: 'Autumn migration & winter waterbirds (Mai Po)', weight: 4, months: { 1: 0.6, 2: 0.4, 3: 0.5, 4: 0.6, 5: 0.3, 9: 0.6, 10: 1, 11: 0.7, 12: 0.75 } },
  ],
  madagascar: [
    { label: 'Dry-season access to endemic bird families', weight: 4, months: { 4: 0.4, 5: 0.6, 6: 1, 7: 1, 8: 1, 9: 1, 10: 0.8, 11: 0.5, 12: 0.35 } },
  ],
  morocco: [
    { label: 'Spring passage', weight: 2, months: { 3: 1, 4: 1, 5: 0.5 } },
    { label: 'Autumn passage', weight: 2, months: { 9: 1, 10: 1, 11: 0.65 } },
    { label: 'Winter resident & wintering-migrant season', weight: 2, months: { 1: 0.6, 2: 0.6, 12: 0.6 } },
  ],
  // --- new events for real, missing phenomena ---
  'cape-cod-islands': [
    { label: 'Fall migration & seawatch', weight: 2, months: { 8: 0.6, 9: 1, 10: 1, 11: 0.5 } },
  ],
  egypt: [
    { label: 'Gebel El Zeit raptor migration bottleneck', weight: 4, months: { 3: 0.6, 4: 1, 9: 0.7, 10: 1 } },
  ],
  guatemala: [
    { label: 'Resplendent quetzal season (Biotopo del Quetzal)', weight: 3, months: { 2: 0.7, 3: 1, 4: 1 } },
  ],
  churchill: [
    { label: 'Arctic & boreal breeding specialists', weight: 3, months: { 6: 1, 7: 1 } },
  ],
  edinburgh: [
    { label: 'Bass Rock gannet colony (Firth of Forth)', weight: 2, months: { 4: 0.4, 5: 0.7, 6: 1, 7: 1, 8: 0.7, 9: 0.4 } },
  ],
  'cape-town': [
    { label: 'Spring fynbos bloom (Cape sugarbird activity)', weight: 2, months: { 9: 1, 10: 1, 11: 0.7 } },
    { label: 'Winter pelagic albatross season', weight: 2, months: { 5: 0.6, 6: 0.85, 7: 1, 8: 1, 9: 0.7 } },
  ],
  'rajasthan-golden-triangle': [
    { label: 'Winter migratory waterfowl (Keoladeo Ghat, Bharatpur)', weight: 3, months: { 10: 0.3, 11: 0.6, 12: 1, 1: 1, 2: 0.85, 3: 0.4 } },
  ],
  'scottish-highlands-skye': [
    { label: 'Seabird colony breeding season (offshore islands)', weight: 2, months: { 4: 0.7, 5: 1, 6: 0.7 } },
  ],
  'north-island': [
    { label: 'Spring breeding season (tui, bellbird)', weight: 2, months: { 10: 0.7, 11: 1, 12: 1, 9: 0.4 } },
  ],
  'tbilisi-caucasus': [
    { label: 'Batumi Bottleneck raptor migration', weight: 4, months: { 8: 0.5, 9: 1, 10: 0.7 } },
  ],
  taiwan: [
    { label: 'Grey-faced Buzzard migration (Kenting)', weight: 3, months: { 9: 0.3, 10: 1 } },
  ],
  seychelles: [
    { label: 'Sooty tern colony (Bird Island)', weight: 2, months: { 5: 0.5, 6: 1, 7: 0.7 } },
  ],
  iceland: [
    { label: 'Seabird cliff colonies (puffins, Arctic terns)', weight: 3, months: { 5: 0.5, 6: 1, 7: 1, 8: 0.4 } },
  ],
  lapland: [
    { label: 'Arctic owl & breeding wader season', weight: 2, months: { 5: 0.6, 6: 1 } },
  ],
  nepal: [
    { label: 'Winter migratory waterfowl (Koshi Tappu)', weight: 3, months: { 11: 0.6, 12: 0.85, 1: 1, 2: 1, 3: 0.5 } },
  ],
  kerala: [
    { label: 'Winter migratory waterfowl season', weight: 3, months: { 11: 0.6, 12: 0.85, 1: 1, 2: 1, 3: 0.5 } },
  ],
  'monterey-big-sur': [
    { label: 'Pelagic seabird season (shearwaters, albatross)', weight: 2, months: { 8: 0.7, 9: 1, 10: 0.85 } },
  ],
};

const BASE: Record<string, number> = {
  azores: 6,
  maldives: 2,
};

const OVERVIEWS: Record<string, string> = {
  azores: "The islands are well known among birders for two distinct draws: the Priolo (Azores Bullfinch), one of Europe's most range-restricted endemics, found only in native laurel forest on eastern São Miguel, plus major seabird colonies (Graciosa hosts the main global breeding stronghold of Monteiro's Storm-petrel); and autumn vagrant landbirds blown across the Atlantic from North America, drawing rarity-chasers to Corvo and Flores every fall.",
  maldives: "Minimal land-bird diversity given the atoll geography, but real seabird colonies (frigatebirds, terns) and a documented role as a Central Asian Flyway wintering stopover for migratory waders give this more than a token presence.",
  'tbilisi-caucasus': "Caucasus mountain specialists are present in the region, and nearby Batumi hosts one of the largest raptor migration spectacles on Earth — over a million birds funnel through the Batumi Bottleneck each autumn, a scale comparable to Sicily's Strait of Messina.",
  lapland: "Boreal forest specialists — three-toed woodpecker, Siberian jay, and several owl species — are present year-round, joined by a real late-spring spectacle: Arctic owls displaying and breeding waders arriving as the snow clears.",
  rio: "Atlantic Forest remnants within the city, including Tijuca, hold toucans and other Brazilian forest species — the same forest's breeding season genuinely peaks in the austral spring (September through November), not the cooler months, with activity easing through the southern summer and quietest in the cooler months (May-August).",
  tanzania: "Serengeti plains alongside Zanzibar's coastal mangroves and reef islets — two different bird communities in one destination. Palearctic migrants begin arriving in force from November, with late November often cited as the single best month, building through a January-February plateau alongside resident raptors and Rift Valley specialties.",
  uganda: "Forest, savanna, and wetland habitats combine to hold the Albertine Rift's endemic-rich birdlife — species found almost nowhere else on Earth. Bwindi and Rwenzori forest interiors hold the deepest concentration. The June-August dry season is genuinely the stronger of the region's two dry spells, tied to the endemics' own breeding season; the shorter December-February dry season is real but secondary.",
  'cape-cod-islands': "A genuine Atlantic flyway funnel — fall migration (Aug-Nov) brings cold-front songbird and shorebird fallouts plus strong pelagic seabird activity, on top of the common New England shorebirds and coastal species working the beaches and marshes year-round.",
  egypt: "The Nile Valley hosts large numbers of wintering waterfowl and raptors each northern winter, and Gebel El Zeit on the Red Sea coast is one of the world's great raptor migration bottlenecks — roughly 1.5 million soaring birds (white stork, honey buzzard, steppe eagle) pass through twice yearly, spring and autumn.",
  guatemala: "Highland cloud forest and lowland rainforest around Tikal hold a real diversity of resident species, joined by wintering North American migrants through the dry season. Biotopo del Quetzal, a dedicated cloud-forest reserve, is a real quetzal-breeding-display destination in its own right each spring, on par with Costa Rica's better-known version.",
};

const MONTHLY: Record<string, Record<number, string>> = {
  andalucia: {
    3: 'The Strait of Gibraltar raptor migration is building — one of the best months for spring passage alongside Doñana.',
  },
  algarve: {
    11: 'Autumn passage is tapering off from its September-October peak.',
  },
  athens: {
    6: 'Spring migration is tailing off but still active into early summer.',
  },
  bhutan: {
    10: 'Black-necked cranes are beginning to arrive at Phobjikha ahead of the main winter season.',
  },
  'costa-rica': {
    1: 'Quetzal breeding display season in the cloud forest is building toward its February-April peak — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.',
    5: 'Quetzal display season is winding down but still active; general lowland and coastal birding continues at a strong baseline, with Great Green Macaws still breeding at Boca Tapada.',
  },
  galapagos: {
    10: 'Garua-season seabird activity is easing, though waved albatross breeding and other species remain present on Española.',
    11: 'Cooler-season seabird activity is fading toward its lowest point of the year, though resident seabirds remain present.',
  },
  'colombian-andes': {
    10: 'The first North American migratory birds are beginning to arrive ahead of the main winter season.',
  },
  ethiopia: {
    11: 'One of the best months of the year — the highland landscape is fresh from the rains, migrants have arrived, and crowds are still light.',
  },
  greenland: {
    5: 'Little auks are arriving at their breeding colonies and beginning to display, ahead of peak season.',
  },
  gbr: {
    9: 'Shorebirds are beginning to arrive ahead of the main spring passage.',
  },
  peru: {
    10: 'Dry-season trekking visibility is easing as the season winds down.',
  },
  provence: {
    3: 'Greater flamingos and herons are beginning to settle into breeding territory at the Camargue.',
    7: 'Camargue breeding-season activity is winding down from its peak.',
  },
  rio: {
    1: 'Still within the breeding season, easing from the autumn peak, though noticeably quieter than September-November.',
    2: 'Activity continues easing toward the cooler months.',
    3: 'Breeding-season activity winding down in Tijuca’s forest remnants.',
    9: 'Breeding-season activity building fast — the real peak of the year is beginning.',
    10: 'Peak Atlantic Forest breeding-season activity in Tijuca’s remnants.',
    11: 'Peak Atlantic Forest breeding-season activity in Tijuca’s remnants.',
    12: 'Still near peak, easing slightly as the breeding season winds down.',
  },
  srilanka: {
    11: 'Northern-winter migrants are arriving in good numbers ahead of the main season.',
  },
  tanzania: {
    11: 'Palearctic migrants are arriving in large numbers on the mainland plains — often cited as the single best month of the year, alongside year-round coastal and mangrove species around Zanzibar.',
    12: 'Migrant numbers remain strong, easing only slightly from November.',
  },
  uganda: {
    1: 'The shorter dry season here — real trail access, though not as reliably dry as June through August.',
    2: 'The shorter dry season here — real trail access, though not as reliably dry as June through August.',
    8: 'Peak dry season — the driest, firmest trail conditions of the year, on par with June and July.',
    12: 'The shorter dry season returning — real trail access, though not as reliably dry as the June-August peak.',
  },
  kenya: {
    11: 'Palearctic migrants are arriving in large numbers — often cited as Kenya’s single best birding month.',
  },
  kruger: {
    10: 'The first Palearctic migrants are beginning to arrive ahead of the main wet season.',
    11: 'Migrants continue arriving in growing numbers alongside resident wildlife.',
    4: 'Migrants are departing as the dry season sets in, concentrating wildlife around water.',
  },
  hokkaido: {
    11: 'Red-crowned cranes are beginning to gather at feeding stations near Kushiro ahead of the main season.',
  },
  hongkong: {
    12: 'Winter waterbirds are at their strongest at Mai Po, alongside the tail of the autumn migration.',
    1: 'Winter waterbirds remain strong at Mai Po into the new year.',
  },
  madagascar: {
    12: 'Dry-season endemic access is largely over, though some species remain active into the start of the rains.',
  },
  morocco: {
    11: 'Autumn passage is tapering off from its September-October peak.',
  },
  'cape-cod-islands': {
    8: 'Fall migration is beginning to build, with early shorebird and songbird movement along the coast.',
    9: 'Peak fall migration — cold-front songbird and shorebird fallouts plus strong pelagic seabird activity offshore.',
    10: 'Still peak fall migration season, among the best birding of the year here.',
    11: 'Fall migration is winding down, though movement continues into early winter.',
  },
  egypt: {
    3: 'The Gebel El Zeit raptor bottleneck is building toward its spring peak, alongside the tail of the wintering-waterfowl season.',
    4: 'Peak spring raptor migration at Gebel El Zeit — one of the world’s great raptor bottlenecks, roughly 1.5 million birds passing through.',
    9: 'The Gebel El Zeit raptor bottleneck is active again on the autumn passage.',
    10: 'Peak autumn raptor migration at Gebel El Zeit.',
  },
  guatemala: {
    2: 'Quetzal breeding display season is beginning at Biotopo del Quetzal, alongside wintering migrants and dry conditions elsewhere.',
    3: 'Peak quetzal breeding display season at Biotopo del Quetzal.',
    4: 'Quetzal breeding display season continues at Biotopo del Quetzal, even as migrants elsewhere have largely departed.',
  },
  churchill: {
    6: 'Peak breeding season for tundra and boreal specialists, including shorebirds nesting on the open tundra.',
    7: 'Peak breeding season for tundra and boreal specialists, including shorebirds nesting on the open tundra.',
  },
  edinburgh: {
    4: 'Gannets are beginning to arrive back at Bass Rock ahead of the breeding season.',
    5: 'Bass Rock’s gannet colony is building toward peak.',
    6: 'Peak season at Bass Rock — one of the world’s largest northern gannet colonies, easily reached from the city.',
    7: 'Peak season at Bass Rock’s gannet colony continues.',
    8: 'Bass Rock’s gannet colony remains active, easing slightly from peak.',
    9: 'Gannets are beginning to depart Bass Rock as the breeding season ends.',
  },
  'cape-town': {
    5: 'Winter pelagic season is building — Southern Ocean albatross diversity increases as cold-water species push north.',
    6: 'Winter pelagic season continues, with strong albatross diversity offshore.',
    7: 'Peak winter pelagic season — the year’s best albatross diversity offshore, alongside the Cape’s winter rains.',
    8: 'Peak winter pelagic season continues.',
    9: 'The spring protea bloom brings fynbos endemics like the Cape sugarbird to their most active, as pelagic season eases.',
  },
  'rajasthan-golden-triangle': {
    10: 'Waterfowl are beginning to arrive at Keoladeo Ghat as the dry season approaches.',
  },
  'scottish-highlands-skye': {
    4: 'Seabird colonies are beginning to return to their offshore island cliffs.',
  },
  'north-island': {
    9: 'Forest birds are becoming more vocal as the spring breeding season approaches.',
  },
  'tbilisi-caucasus': {
    8: 'The Batumi Bottleneck raptor migration is beginning to build.',
    9: 'Peak season at the Batumi Bottleneck — over a million raptors funnel through on autumn migration, one of the largest such spectacles on Earth.',
    10: 'The Batumi Bottleneck remains active, easing from peak.',
  },
  taiwan: {
    9: 'Grey-faced Buzzards are beginning to pass through Kenting ahead of the main migration.',
    10: 'Peak Grey-faced Buzzard migration at Kenting, one of the world’s significant raptor migration sites, alongside the resident endemics.',
  },
  seychelles: {
    5: 'Sooty terns are arriving and settling in at Bird Island’s colony ahead of the main breeding season.',
    6: 'Peak sooty tern breeding season at Bird Island — one of the world’s largest colonies, around 1-1.5 million birds, highly synchronized.',
    7: 'Sooty tern colony activity remains strong, easing from peak.',
  },
  iceland: {
    5: 'Puffin colonies and Arctic tern nesting are building toward peak on the sea cliffs and coastal wetlands.',
  },
  lapland: {
    5: 'Arctic owls are displaying and breeding waders are arriving as the snow clears — genuinely the most active month of the year, not just the year-round baseline.',
    6: 'Breeding activity continues at its peak among Arctic owls and waders.',
  },
  nepal: {
    11: 'Winter migratory waterfowl are arriving at Koshi Tappu in strong numbers, alongside the tail of the autumn trekking season.',
    12: 'Winter migratory waterfowl remain strong at Koshi Tappu.',
  },
  kerala: {
    11: 'Winter migratory waterfowl are arriving at the backwaters in strong numbers.',
    12: 'Dry-season conditions give the best access to the backwaters and nearby hill forests, with winter migratory waterfowl at their strongest.',
  },
  'monterey-big-sur': {
    8: 'Pelagic seabird season is building — shearwaters and albatross gathering over the bay’s deep offshore canyons.',
    9: 'Peak pelagic seabird season — Monterey Bay at its most productive for shearwaters and albatross.',
    10: 'Still strong pelagic seabird season, easing slightly from peak.',
  },
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const ids = new Set([...Object.keys(EVENTS), ...Object.keys(BASE), ...Object.keys(OVERVIEWS), ...Object.keys(MONTHLY)]);
  for (const id of ids) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const patch: Record<string, unknown> = {};
    if (EVENTS[id]) patch.sliderEvents = { ...(row.sliderEvents as Record<string, unknown>), [KEY]: EVENTS[id] };
    if (BASE[id] !== undefined) patch.baseScores = { ...(row.baseScores as Record<string, number>), [KEY]: BASE[id] };
    if (OVERVIEWS[id]) patch.sliderOverview = { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] };
    if (MONTHLY[id]) {
      const existing = ((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] ?? new Array(12).fill(null)).slice();
      for (const [idx1, text] of Object.entries(MONTHLY[id])) existing[Number(idx1) - 1] = text;
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: existing };
    }

    let monthly: number[] | undefined;
    if (patch.sliderEvents || patch.baseScores) {
      const scoringRow = { ...row, ...patch };
      const scoring = toScoringPlace(scoringRow as typeof row);
      monthly = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
      const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
      patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve };
    }

    console.log(`${id}${monthly ? `: [${monthly.map((v) => v.toFixed(0)).join(',')}] peak=${Math.max(...monthly)}` : ' (content-only)'}`);

    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
