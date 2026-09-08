import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve } from '../src/lib/scoring/curve';

/**
 * Birding seasons for all 107 destinations scoring above 4.
 *
 * 66 of them had no birdingPeak and no events at all — a flat line through
 * the year on the one interest where timing matters more than anywhere
 * else. Birding is not a thing you can do "in summer"; it is a thing you do
 * in the three weeks the birds are there.
 *
 * This authors WHEN, not HOW GOOD. Every destination keeps the peak VALUE
 * it already has, so nothing is re-ranked and the anchor set in anchors.ts
 * is untouched — only the shape of the year changes, plus how deep the
 * off-season trough goes.
 *
 * The six drivers, and what each implies for the trough:
 *
 *   A  BOREAL-WINTER MIGRANT ARRIVAL. Migrants arrive Oct-Mar into a dry
 *      season, so timing and weather agree and there is no tension. The
 *      resident avifauna stays behind, so the trough is shallow.
 *
 *   B  PASSAGE / BOTTLENECK. The birds funnel through rather than staying:
 *      two peaks a year, spring and autumn, with a real dip between. Needs
 *      sliderEvents rather than a single month list — a single window would
 *      assert one of the two peaks doesn't exist.
 *
 *   C  GREEN-SEASON ARRIVAL. Intra-African migrants arrive WITH the rains
 *      and breeding follows. Rain is the peak. This is the Kruger case, and
 *      the wet-month penalty must not fire here.
 *
 *   D  DRY-SEASON CONCENTRATION AND ACCESS. Two mechanisms pointing the same
 *      way: birds concentrate at shrinking water, and you can physically
 *      reach the site. The monsoon or green season is genuinely unbirdable —
 *      India in July, Costa Rica in September — so the trough is deep. This
 *      is the only group where weather is doing the heavy lifting, which is
 *      the point: weather is modelled where it would actually wreck a trip,
 *      and ignored where it merely rains.
 *
 *   E  BREEDING AND PLUMAGE. Song, display and colour rather than arrival.
 *      Split in two, because the troughs are nothing alike: at a SEABIRD
 *      COLONY the birds are physically absent for eight months of the year,
 *      so the trough is near zero; a temperate woodland in January is quiet
 *      but perfectly birdable.
 *
 *   F  SINGLE-SPECIES SPECTACLE. One bird sets the calendar — Hokkaido's
 *      cranes, Bali's starling. Outside its window the destination reverts
 *      to ordinary.
 *
 * Where a destination sits in two groups, ACCESS WINS: a perfect breeding
 * month you cannot reach is not a peak. Uyuni is the case that settled it —
 * Andean flamingos breed on the altiplano in the wet season when the
 * lagoons fill, but that is also when the salar floods and access is worst,
 * so it is authored as dry-season access.
 */

type Group = 'A' | 'B' | 'C' | 'D' | 'E-colony' | 'E-temperate' | 'F';

/**
 * FLOORS ARE ABSOLUTE, NOT A FRACTION OF THE PEAK.
 *
 * The first version of this script set trough = peak x fraction, which is a
 * RELATIVE measure on a scale that has to be absolute and cross-comparable.
 * It failed in both directions, which is what gave the mechanism away:
 *
 *   Costa Rica's July read 3.0 while Lofoten's July read 7.0 — the model
 *   claimed Lofoten was more than twice the birding. Lofoten in July has
 *   roughly forty breeding species; Costa Rica has six hundred residents
 *   and you will see a hundred in a day.
 *
 *   Panama's worst month (2.4) fell below the Great Smokies' BEST (5.0).
 *
 *   And Kaziranga, whose gates are locked for the monsoon, came out at 2.7
 *   — too generous — because a percentage cannot express "closed".
 *
 * A floor is a claim about what the birding is genuinely worth in the worst
 * month, on the same 0-10 scale as every other destination. It answers two
 * questions: can you get there and move around, and what fraction of the
 * avifauna is present year-round.
 *
 * On the first question, note that a destination is a REGION, not a gate.
 * Kaziranga's park shuts for the monsoon but Assam does not — the
 * Brahmaputra floodplain, the tea estates and Nameri are all still there,
 * so its floor is 2 rather than the 0.5 "closed" would imply. Antarctica is
 * the only genuine zero-access case in the catalogue: no ships sail.
 *
 * The bands the floors below are drawn from:
 *    0.5-1   nobody can be there at all
 *    1-2     the birds are physically absent (seabird colonies)
 *    2.5-3.5 temperate, resident species only
 *    3.5-4.5 arid, thin resident base
 *    5.5-6.5 savanna: migrants gone, residents rich
 *    6.5-8   resident-rich rainforest and cloud forest, where the marquee
 *            birds never leave and only comfort changes
 */
const FLOOR: Record<string, number> = {
  // A - boreal-winter migrant arrival
  kenya: 6.5, tanzania: 6.5, srilanka: 6, 'rajasthan-golden-triangle': 4, egypt: 3,
  vietnam: 5, thailand: 3.5, 'colombian-andes': 7.5, bhutan: 5.5, canaries: 4, dubai: 3,
  oaxaca: 3.5, mexicocity: 4, guatemala: 3.5, nicaragua: 5, belize: 5.5, bagan: 3.5,
  bangkok: 4, angkor: 4, luangprabang: 4, hongkong: 4, singapore: 4, jordan: 3,
  ladakh: 2, mongolia: 2.5,
  // thailand, guatemala and oaxaca are floored well under what their
  // resident avifauna deserves, purely because their PEAKS are 5 — the same
  // peak as the Great Smoky Mountains, for countries holding a thousand-plus
  // species. The floor cannot exceed the peak, so the incoherence surfaces
  // here but does not belong here: their peaks are the thing that is wrong,
  // and re-ranking peaks is a separate decision from authoring seasons.
  // B - passage bottleneck
  morocco: 3.5, algarve: 3.5, 'new-orleans': 3, 'texas-hill-country': 3, gbr: 4,
  // C - green-season arrival. Kruger's ~500 species are about 350 resident
  // and 100-150 migrant, so the migrants are a bonus tier and the residents
  // carry the dry season; 6.5, not the 4.8 a percentage produced.
  kruger: 6.5, zambia: 5.5, zimbabwe: 5.5, botswana: 6, namibia: 5.5,
  // D - dry-season concentration and access
  pantanal: 7, kaziranga: 2, madagascar: 6, 'peruvian-amazon': 7, ethiopia: 5.5,
  uganda: 7, rwanda: 6.5, peru: 7, 'costa-rica': 7, nepal: 4, kerala: 4, chiapas: 5.5,
  ghana: 5, panama: 7, 'colombian-caribbean': 6, palawan: 5.5, komodo: 4, rajaampat: 6,
  atacama: 3.5, uyuni: 3, mauritius: 3.5, fiji: 3.5, barbados: 3, maldives: 3,
  seychelles: 4.5, borneo: 7, taiwan: 4.5,
  // E-colony - the birds are genuinely gone. Galapagos is the exception and
  // was miscategorised: its boobies, finches and frigatebirds are resident
  // endemics, not a seasonal colony, so only the emphasis changes month to
  // month and its floor belongs with the rainforest band.
  iceland: 1.5, 'faroe-islands': 1.5, lofoten: 1.5, svalbard: 1, antarctica: 0.5,
  falklands: 2, galapagos: 7, azores: 2, madeira: 2.5, 'puerto-rico': 3.5,
  'monterey-big-sur': 3, 'vancouver-island': 3, 'southeast-alaska': 2.5,
  // E-temperate - quiet, never impossible
  yellowstone: 2.5, 'denali-interior': 1.5, churchill: 1.5, banff: 2.5,
  'glacier-waterton': 2.5, acadia: 2.5, olympic: 3, yosemite: 3,
  'great-smoky-mountains': 3, 'upper-peninsula': 2.5, 'badlands-black-hills': 2.5,
  'scottish-highlands-skye': 2.5, 'nova-scotia': 2.5, tasmania: 4, 'north-island': 3.5,
  'milford-sound-fiordland': 3, queenstown: 3, 'chilean-lake-district': 3,
  'argentine-lake-district': 3, 'el-chalten': 2.5, 'torres-del-paine': 3,
  'tierra-del-fuego': 3, 'cape-town': 5, everglades: 4, uluru: 3, sydney: 3.5,
  mallorca: 3, mendoza: 3, 'ecuadorian-andes': 8,
  // F - single-species spectacle
  hokkaido: 3, bali: 4, 'papua-new-guinea': 8,
};

type Entry = {
  id: string;
  group: Group;
  /** Peak months, 1-12. For group B, the SPRING passage window. */
  peak: number[];
  /** Group B only: the autumn passage window. */
  peak2?: number[];
  why: string;
};

const ENTRIES: Entry[] = [
  // ---- A · boreal-winter migrant arrival, dry season agrees -------------
  { id: 'kenya', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Palearctic migrants Nov-Mar, over the short-rains green flush' },
  { id: 'tanzania', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Palearctic migrants Nov-Mar' },
  { id: 'srilanka', group: 'A', peak: [12, 1, 2, 3], why: 'northern-winter migrants Dec-Mar, dry in the south-west' },
  { id: 'rajasthan-golden-triangle', group: 'A', peak: [11, 12, 1, 2], why: 'Keoladeo wintering waterfowl and cranes' },
  { id: 'egypt', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Nile wintering wildfowl and raptor passage' },
  { id: 'vietnam', group: 'A', peak: [11, 12, 1, 2, 3], why: 'northern winter migrants, dry season' },
  { id: 'thailand', group: 'A', peak: [11, 12, 1, 2], why: 'northern winter migrants, dry season' },
  { id: 'colombian-andes', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Nearctic migrants overwinter in the coffee belt' },
  { id: 'bhutan', group: 'A', peak: [11, 12, 1, 2], why: 'black-necked cranes at Phobjikha, Nov-Feb' },
  { id: 'canaries', group: 'A', peak: [10, 11, 12, 1, 2, 3], why: 'wintering migrants alongside the resident endemics' },
  { id: 'dubai', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Gulf wintering waders; summer is unbearable' },
  { id: 'oaxaca', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Nearctic migrants, dry season' },
  { id: 'mexicocity', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Nearctic migrants, dry season' },
  { id: 'guatemala', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Nearctic migrants, dry season' },
  { id: 'nicaragua', group: 'A', peak: [12, 1, 2, 3], why: 'Nearctic migrants, dry season' },
  { id: 'belize', group: 'A', peak: [12, 1, 2, 3, 4], why: 'Nearctic migrants, dry season' },
  { id: 'bagan', group: 'A', peak: [11, 12, 1, 2], why: 'dry-season migrants on the Irrawaddy' },
  { id: 'bangkok', group: 'A', peak: [11, 12, 1, 2], why: 'wintering waders in the Gulf saltpans' },
  { id: 'angkor', group: 'A', peak: [12, 1, 2, 3], why: 'Tonle Sap waterbirds at their dry-season concentration' },
  { id: 'luangprabang', group: 'A', peak: [11, 12, 1, 2], why: 'dry-season migrants' },
  { id: 'hongkong', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Mai Po wintering waders and spoonbills' },
  { id: 'singapore', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Sungei Buloh wintering waders' },
  { id: 'jordan', group: 'A', peak: [11, 12, 1, 2, 3], why: 'Rift Valley wintering and passage' },
  { id: 'ladakh', group: 'A', peak: [6, 7, 8], why: 'high-altitude summer breeders; the passes are shut otherwise' },
  { id: 'mongolia', group: 'A', peak: [5, 6, 7, 8], why: 'steppe and lake breeders in the brief summer' },

  // ---- B · passage bottleneck, two peaks a year -------------------------
  { id: 'morocco', group: 'B', peak: [3, 4], peak2: [9, 10, 11], why: 'raptor passage over the Strait, both directions' },
  { id: 'algarve', group: 'B', peak: [3, 4], peak2: [9, 10, 11], why: 'Sagres autumn raptor concentration, spring return' },
  { id: 'new-orleans', group: 'B', peak: [4, 5], peak2: [9, 10], why: 'Gulf trans-migrant fallout at Grand Isle' },
  { id: 'texas-hill-country', group: 'B', peak: [4, 5], peak2: [9, 10], why: 'central flyway fallout, spring and autumn' },
  { id: 'gbr', group: 'B', peak: [10, 11], peak2: [3, 4], why: 'seabird nesting on the cays, plus wader passage' },

  // ---- C · green-season arrival, rain IS the peak -----------------------
  { id: 'kruger', group: 'C', peak: [11, 12, 1, 2, 3], why: 'Palearctic and intra-African migrants arrive with the rains' },
  { id: 'zambia', group: 'C', peak: [12, 1, 2, 3], why: 'green-season migrant arrivals and breeding' },
  { id: 'zimbabwe', group: 'C', peak: [11, 12, 1, 2, 3], why: 'green-season migrant arrivals' },
  { id: 'botswana', group: 'C', peak: [11, 12, 1, 2, 3], why: 'Okavango green season; migrants arrive and breed' },
  { id: 'namibia', group: 'C', peak: [12, 1, 2, 3], why: 'Etosha fills, migrants arrive with the rain' },

  // ---- D · dry-season concentration and access; monsoon disqualifying ---
  { id: 'pantanal', group: 'D', peak: [6, 7, 8, 9, 10], why: 'riverbank concentration as the floods recede' },
  { id: 'kaziranga', group: 'D', peak: [11, 12, 1, 2, 3], why: 'the park shuts entirely for the monsoon' },
  { id: 'madagascar', group: 'D', peak: [9, 10, 11], why: 'end of dry season; tracks passable, birds displaying' },
  { id: 'peruvian-amazon', group: 'D', peak: [6, 7, 8, 9], why: 'low water opens the trails and beaches' },
  { id: 'ethiopia', group: 'D', peak: [10, 11, 12, 1, 2], why: 'dry season; the summer rains close the highlands' },
  { id: 'uganda', group: 'D', peak: [12, 1, 2, 6, 7, 8], why: 'the two dry windows — forest trails are impassable otherwise' },
  { id: 'rwanda', group: 'D', peak: [12, 1, 2, 6, 7, 8], why: 'the two dry windows, Nyungwe trails' },
  { id: 'peru', group: 'D', peak: [5, 6, 7, 8, 9], why: 'dry season on the east slope; the wet season closes roads' },
  { id: 'costa-rica', group: 'D', peak: [12, 1, 2, 3, 4], why: 'dry season; September and October are a genuine washout' },
  { id: 'nepal', group: 'D', peak: [10, 11, 2, 3, 4], why: 'the two clear windows either side of the monsoon' },
  { id: 'kerala', group: 'D', peak: [12, 1, 2, 3], why: 'Thattekad in the dry months; the monsoon is total' },
  { id: 'chiapas', group: 'D', peak: [11, 12, 1, 2, 3], why: 'dry season in the cloud forest' },
  { id: 'ghana', group: 'D', peak: [11, 12, 1, 2], why: 'dry season; Atewa and Kakum are unworkable in the rains' },
  { id: 'panama', group: 'D', peak: [12, 1, 2, 3, 4], why: 'dry season on the Canal corridor' },
  { id: 'colombian-caribbean', group: 'D', peak: [12, 1, 2, 3], why: 'Santa Marta endemics, dry season' },
  { id: 'palawan', group: 'D', peak: [12, 1, 2, 3, 4], why: 'dry season; the endemics are hard work in the rain' },
  { id: 'komodo', group: 'D', peak: [5, 6, 7, 8, 9], why: 'dry season' },
  { id: 'rajaampat', group: 'D', peak: [10, 11, 12, 3, 4], why: 'calm seas reach the remote sites' },
  { id: 'atacama', group: 'D', peak: [9, 10, 11, 12], why: 'altiplano lagoons accessible, flamingos present' },
  { id: 'uyuni', group: 'D', peak: [5, 6, 7, 8, 9], why: 'access wins over breeding — the flooded salar cuts the lagoons off in the wet' },
  { id: 'mauritius', group: 'D', peak: [8, 9, 10, 11], why: 'dry, cool, and outside cyclone season' },
  { id: 'fiji', group: 'D', peak: [5, 6, 7, 8, 9], why: 'dry season, outside the cyclones' },
  { id: 'barbados', group: 'D', peak: [12, 1, 2, 3, 4], why: 'dry season; the hurricane months are not birding months' },
  { id: 'maldives', group: 'D', peak: [12, 1, 2, 3], why: 'north-east monsoon is the settled season' },
  { id: 'seychelles', group: 'D', peak: [5, 6, 9, 10], why: 'Aride and Cousin seabirds outside the monsoon extremes' },
  { id: 'borneo', group: 'D', peak: [3, 4, 5, 6, 7, 8], why: 'drier months; Danum and Kinabalu trails' },
  { id: 'taiwan', group: 'D', peak: [10, 11, 12, 1, 2, 3], why: 'cool dry season, plus wintering cranes and spoonbills' },
  { id: 'nepal-placeholder-unused', group: 'D', peak: [1], why: 'unused' },

  // ---- E · seabird colonies — the birds are absent most of the year -----
  { id: 'iceland', group: 'E-colony', peak: [5, 6, 7], why: 'puffin and seabird cliffs; empty by August' },
  { id: 'faroe-islands', group: 'E-colony', peak: [5, 6, 7], why: 'puffin nesting' },
  { id: 'lofoten', group: 'E-colony', peak: [5, 6, 7], why: 'seabird colonies' },
  { id: 'svalbard', group: 'E-colony', peak: [6, 7, 8], why: 'the colonies are under ice and dark the rest of the year' },
  { id: 'antarctica', group: 'E-colony', peak: [11, 12, 1], why: 'penguin breeding; nobody can even reach it otherwise' },
  { id: 'falklands', group: 'E-colony', peak: [11, 12, 1, 2], why: 'penguin and albatross breeding' },
  { id: 'galapagos', group: 'E-colony', peak: [4, 5, 6, 12], why: 'waved albatross ashore Apr-Dec; booby courtship in the warm months' },
  { id: 'azores', group: 'E-colony', peak: [5, 6, 7, 8], why: "Cory's shearwater colonies" },
  { id: 'madeira', group: 'E-colony', peak: [5, 6, 7, 8], why: 'Zino’s petrel and the seabird colonies' },
  { id: 'puerto-rico', group: 'E-colony', peak: [12, 1, 2, 3, 4], why: 'dry season plus wintering warblers' },
  { id: 'monterey-big-sur', group: 'E-colony', peak: [8, 9, 10], why: 'autumn upwelling drives the pelagics' },
  { id: 'vancouver-island', group: 'E-colony', peak: [5, 6, 7], why: 'seabird colonies and breeding season' },
  { id: 'southeast-alaska', group: 'E-colony', peak: [5, 6, 7], why: 'seabird colonies in the brief summer' },

  // ---- E · temperate breeding — quiet in winter, never impossible -------
  { id: 'yellowstone', group: 'E-temperate', peak: [5, 6], why: 'spring arrival and breeding song' },
  { id: 'denali-interior', group: 'E-temperate', peak: [5, 6, 7], why: 'subarctic breeders in the short summer' },
  { id: 'churchill', group: 'E-temperate', peak: [6, 7], why: 'tundra breeders; a four-week season' },
  { id: 'banff', group: 'E-temperate', peak: [5, 6], why: 'spring migration into breeding' },
  { id: 'glacier-waterton', group: 'E-temperate', peak: [5, 6], why: 'spring migration into breeding' },
  { id: 'acadia', group: 'E-temperate', peak: [5, 6], why: 'warbler migration and breeding' },
  { id: 'olympic', group: 'E-temperate', peak: [5, 6], why: 'spring migration into breeding' },
  { id: 'yosemite', group: 'E-temperate', peak: [5, 6], why: 'spring migration into breeding' },
  { id: 'great-smoky-mountains', group: 'E-temperate', peak: [4, 5, 6], why: 'the great eastern warbler wave' },
  { id: 'upper-peninsula', group: 'E-temperate', peak: [5, 6], why: 'boreal breeders and spring passage' },
  { id: 'badlands-black-hills', group: 'E-temperate', peak: [5, 6], why: 'grassland breeders' },
  { id: 'scottish-highlands-skye', group: 'E-temperate', peak: [4, 5, 6], why: 'moorland and seabird breeding' },
  { id: 'nova-scotia', group: 'E-temperate', peak: [5, 6], why: 'spring migration into breeding' },
  { id: 'tasmania', group: 'E-temperate', peak: [10, 11, 12], why: 'austral spring; the endemics are calling' },
  { id: 'north-island', group: 'E-temperate', peak: [10, 11, 12], why: 'austral spring breeding' },
  { id: 'milford-sound-fiordland', group: 'E-temperate', peak: [11, 12, 1], why: 'austral spring; the fiord tracks are open' },
  { id: 'queenstown', group: 'E-temperate', peak: [10, 11, 12], why: 'austral spring breeding' },
  { id: 'chilean-lake-district', group: 'E-temperate', peak: [11, 12, 1], why: 'austral spring breeding' },
  { id: 'argentine-lake-district', group: 'E-temperate', peak: [11, 12, 1], why: 'austral spring breeding' },
  { id: 'el-chalten', group: 'E-temperate', peak: [11, 12, 1], why: 'austral spring; the steppe species are displaying' },
  { id: 'torres-del-paine', group: 'E-temperate', peak: [11, 12, 1], why: 'austral spring breeding' },
  { id: 'tierra-del-fuego', group: 'E-temperate', peak: [11, 12, 1], why: 'austral spring breeding' },
  { id: 'cape-town', group: 'E-temperate', peak: [9, 10, 11], why: 'fynbos spring — sunbirds and sugarbirds on the proteas' },
  { id: 'everglades', group: 'E-temperate', peak: [12, 1, 2, 3, 4], why: 'wading-bird rookeries at their fullest as the water drops' },
  { id: 'uluru', group: 'E-temperate', peak: [8, 9, 10], why: 'after winter rain; desert species breed and disperse' },
  { id: 'sydney', group: 'E-temperate', peak: [9, 10, 11], why: 'austral spring breeding' },
  { id: 'mallorca', group: 'E-temperate', peak: [4, 5], why: 'Albufera spring passage and breeding' },
  { id: 'mendoza', group: 'E-temperate', peak: [10, 11, 12], why: 'austral spring breeding' },
  { id: 'ecuadorian-andes', group: 'E-temperate', peak: [6, 7, 8, 12, 1], why: 'resident endemics year-round; the drier windows are best' },
  { id: 'nepal-unused-2', group: 'E-temperate', peak: [1], why: 'unused' },

  // ---- F · single-species spectacle -------------------------------------
  { id: 'hokkaido', group: 'F', peak: [12, 1, 2], why: 'red-crowned cranes at Kushiro and Steller’s sea eagle' },
  { id: 'bali', group: 'F', peak: [4, 5, 6, 7, 8, 9], why: 'Bali starling at West Bali NP, dry season' },
  { id: 'papua-new-guinea', group: 'F', peak: [6, 7, 8, 9], why: 'birds-of-paradise display leks' },
];

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

/** Anchors spread across the peak window, ramping from the trough either side. */
function curveFor(peak: number, trough: number, months: number[], months2?: number[]) {
  const on = new Set([...months, ...(months2 ?? [])]);
  const shoulder = Math.round((trough + (peak - trough) * 0.45) * 10) / 10;
  const anchors: { month: number; value: number; steepness?: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const prev = m === 1 ? 12 : m - 1;
    const next = m === 12 ? 1 : m + 1;
    if (on.has(m)) anchors.push({ month: m, value: peak, steepness: 2 });
    else if (on.has(prev) || on.has(next)) anchors.push({ month: m, value: shoulder, steepness: 2 });
    else anchors.push({ month: m, value: trough, steepness: 1 });
  }
  return anchors;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  const inScope = new Set(
    scored
      .filter((d) => !isSliderNA(d, 'birding') && Math.max(...(d.monthly.birding ?? [0])) > 4)
      .map((d) => d.id),
  );

  const entries = ENTRIES.filter((e) => !e.id.includes('unused'));
  const seen = new Set<string>();
  let invalid = false;
  for (const e of entries) {
    if (seen.has(e.id)) { console.error(`${e.id}: listed twice`); invalid = true; }
    seen.add(e.id);
    if (!byId.has(e.id)) { console.error(`${e.id}: not a primary destination`); invalid = true; }
    else if (!inScope.has(e.id)) { console.error(`${e.id}: not scoring above 4 for birding`); invalid = true; }
  }
  const unassigned = [...inScope].filter((id) => !seen.has(id));
  if (unassigned.length) {
    console.error(`\nUnassigned (${unassigned.length}):\n  ${unassigned.join(' ')}`);
    invalid = true;
  }
  if (invalid) { console.error('\nRefusing to write.'); process.exit(1); }

  const counts: Record<string, number> = {};
  for (const e of entries) {
    const row = byId.get(e.id)!;
    const monthly = scored.find((x) => x.id === e.id)!.monthly.birding ?? [];
    const peakValue = Math.max(...monthly);
    const trough = FLOOR[e.id];
    if (trough === undefined) { console.error(`${e.id}: no floor declared`); process.exit(1); }
    if (trough >= peakValue) { console.error(`${e.id}: floor ${trough} is not below its peak ${peakValue}`); process.exit(1); }
    const anchors = curveFor(peakValue, trough, e.peak, e.peak2);
    const curve = parseSliderCurve({ anchors });

    const patch: Record<string, unknown> = {
      birdingPeakMonths: [...e.peak, ...(e.peak2 ?? [])].sort((a, b) => a - b),
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), birding: curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), 'birding'])),
    };

    // Group B is the reason sliderEvents exists — two separate windows a
    // year. A single birdingPeak list would merge them into one long season
    // and assert the summer lull isn't there.
    if (e.peak2) {
      const monthsMap = (ms: number[]) => Object.fromEntries(ms.map((m) => [m, 1]));
      patch.sliderEvents = {
        ...(row.sliderEvents as Record<string, unknown>),
        birding: [
          { label: 'Spring passage', weight: peakValue - trough, months: monthsMap(e.peak) },
          { label: 'Autumn passage', weight: peakValue - trough, months: monthsMap(e.peak2) },
        ],
      };
    }

    counts[e.group] = (counts[e.group] ?? 0) + 1;
    console.log(`  ${e.id.padEnd(26)} ${e.group.padEnd(11)} peak ${peakValue.toFixed(0)} trough ${trough.toFixed(1)}  [${e.peak.join(',')}${e.peak2 ? ` + ${e.peak2.join(',')}` : ''}]  ${e.why}`);

    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: e.id,
          action: 'update',
          beforeValue: row,
          afterValue: { ...row, ...patch },
        });
      });
    }
    byId.set(e.id, { ...row, ...patch } as typeof row);
  }

  console.log('\nby driver: ' + Object.entries(counts).sort().map(([g, n]) => `${g}:${n}`).join('  '));
  console.log(dryRun ? `\ndry run — ${entries.length} would change.` : `\ndone: ${entries.length} authored.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
