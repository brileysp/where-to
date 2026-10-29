// 24 Oct 2026: connects the approved chips of Street Food, Luxury Hotels and Road Cycling to their new columns and makes them live.
// A chip must be approved first; nothing unapproved is touched. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/connect-chips-oct24.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type Driver = { column: string; option?: string; fullAt?: number };
const MAP: Array<[string, string, Driver[]]> = [
  ['streetFood', 'night-markets', [{ column: 'nightMarkets' }]],
  ['streetFood', 'cooking-classes', [{ column: 'cookingClasses' }]],
  ['streetFood', 'fresh-produce-markets', [{ column: 'produceMarkets' }]],
  ['streetFood', 'street-stalls-and-hawker-centres', [{ column: 'streetStalls' }]],
  ['streetFood', 'food-tours', [{ column: 'foodTours' }]],
  ['luxuryHotels', 'boutique-hotels', [{ column: 'boutiqueHotels' }]],
  ['luxuryHotels', 'grand-and-historic-hotels', [{ column: 'grandHotels' }]],
  ['luxuryHotels', 'remote-luxury-lodges', [{ column: 'remoteLodges' }]],
  ['cyclingRoad', 'quiet-scenic-road-riding', [{ column: 'quietScenic' }]],
  ['cyclingRoad', 'gravel-and-dirt-roads', [{ column: 'gravel' }]],
  ['cyclingRoad', 'big-mountain-climbs', [{ column: 'iconicClimbs', fullAt: 5 }]],
  ['cyclingRoad', 'multi-day-touring', [{ column: 'multiDayTouring' }]],
  ['historyArchaeology', 'ancient-ruins', [{ column: 'ancientRuins' }]],
  ['historyArchaeology', 'war-and-battlefield-history', [{ column: 'warHistory' }]],
  ['historyArchaeology', 'prehistoric-sites', [{ column: 'prehistoricSites' }]],
  ['historyArchaeology', 'castles', [{ column: 'castles' }]],
  ['sunbathing', 'beach-clubs-and-loungers', [{ column: 'beachClubs' }]],
  ['sunbathing', 'quiet-shores', [{ column: 'quietShores' }]],
  ['sunbathing', 'resort-pool-days', [{ column: 'resortPoolDays' }]],
  ['architecture', 'castles-and-palaces', [{ column: 'castlesPalaces' }]],
  ['architecture', 'modern-and-contemporary', [{ column: 'modernArchitecture' }]],
  ['architecture', 'art-nouveau-and-art-deco', [{ column: 'artNouveauDeco' }]],
  ['cityExploration', 'markets-and-street-life', [{ column: 'marketsStreetLife' }]],
  ['cityExploration', 'neighborhoods-off-the-tourist-trail', [{ column: 'offTheBeatenPath' }]],
  ['cityExploration', 'historic-old-towns', [{ column: 'historicOldTown' }]],
  ['museumsArt', 'fine-art-masterworks', [{ column: 'fineArt' }]],
  ['museumsArt', 'street-art-and-murals', [{ column: 'streetArt' }]],
  ['museumsArt', 'history-and-natural-history-museums', [{ column: 'historyMuseums' }]],
  ['museumsArt', 'modern-art', [{ column: 'modernArt' }]],
  ['skiingSnowboarding', 'off-piste-and-backcountry', [{ column: 'offPiste' }]],
  ['skiingSnowboarding', 'cross-country-skiing', [{ column: 'crossCountry' }]],
  ['skiingSnowboarding', 'downhill-resort-skiing', [{ column: 'downhillResort' }]],
  ['skiingSnowboarding', 'heli-skiing-and-cat-skiing', [{ column: 'heliCat' }]],
  ['religiousSites', 'mosques-and-islamic-heritage', [{ column: 'mosquesIslamic' }]],
  ['religiousSites', 'pilgrimage-routes', [{ column: 'pilgrimageRoutes' }]],
  ['religiousSites', 'cathedrals-and-churches', [{ column: 'cathedralsChurches' }]],
  ['religiousSites', 'temples-and-shrines', [{ column: 'templesShrines' }]],
  ['spaWellness', 'day-spas-and-massage', [{ column: 'daySpas' }]],
  ['spaWellness', 'thermal-baths-and-hammams', [{ column: 'thermalBaths' }]],
  ['spaWellness', 'wellness-resort-stays', [{ column: 'wellnessResorts' }]],
  ['stargazing', 'certified-dark-sky-places', [{ column: 'darkSkyCertified' }]],
  ['stargazing', 'remote-and-high-altitude-clear-skies', [{ column: 'clearHighSkies' }]],
  ['stargazing', 'night-sky-photography', [{ column: 'skyPhotography' }]],
  ['stargazing', 'southern-sky', [{ column: 'skyHemisphere', option: 'southern' }]],
  ['adventureSports', 'paragliding', [{ column: 'paragliding' }]],
  ['adventureSports', 'ziplining-and-aerial-parks', [{ column: 'aerialParks' }]],
  ['adventureSports', 'skydiving-and-bungee', [{ column: 'skydivingBungee' }]],
  ['adventureSports', 'canyoneering', [{ column: 'canyoneering' }]],
  ['birding', 'seabirds', [{ column: 'habitats', option: 'ocean' }]],
  // 25 Oct 2026: the seven interests whose columns existed but whose chips were still drafts.
  ['fineDining', 'farm-to-table', [{ column: 'farmToTable' }]],
  ['fineDining', 'dining-with-a-view', [{ column: 'diningWithView' }]],
  ['fineDining', 'michelin-starred-restaurants', [{ column: 'michelinRestaurants', fullAt: 8 }]],
  ['fineDining', 'tasting-menus-and-chef-s-tables', [{ column: 'tastingMenus' }]],
  ['coffeeTea', 'specialty-caf-s-and-roasteries', [{ column: 'specialtyCafes' }]],
  ['coffeeTea', 'tea-ceremonies-and-tea-houses', [{ column: 'teaCeremonies' }]],
  ['coffeeTea', 'coffee-farms', [{ column: 'coffeeFarms' }]],
  ['coffeeTea', 'tea-plantations', [{ column: 'teaPlantations' }]],
  ['nightlife', 'clubs-and-dancing', [{ column: 'clubs' }]],
  ['nightlife', 'live-music-venues', [{ column: 'liveMusic' }]],
  ['nightlife', 'cocktail-and-rooftop-bars', [{ column: 'cocktailBars' }]],
  ['nightlife', 'lgbtq-scene', [{ column: 'lgbtqScene' }]],
  ['nightlife', 'beach-and-island-parties', [{ column: 'beachParties' }]],
  ['shopping', 'luxury-and-designer', [{ column: 'luxuryShopping' }]],
  ['shopping', 'markets-and-bazaars', [{ column: 'marketsBazaars' }]],
  ['shopping', 'local-crafts-and-souvenirs', [{ column: 'localCrafts' }]],
  ['shopping', 'vintage-and-antiques', [{ column: 'vintageAntiques' }]],
  ['traditionalCrafts', 'pottery-and-ceramics', [{ column: 'potteryCeramics' }]],
  ['traditionalCrafts', 'textiles-and-weaving', [{ column: 'textilesWeaving' }]],
  ['traditionalCrafts', 'carving-and-metalwork', [{ column: 'carvingMetalwork' }]],
  ['festivals', 'music-festivals', [{ column: 'musicFestivals' }]],
  ['festivals', 'sporting-events', [{ column: 'sportingEvents' }]],
  ['festivals', 'food-and-drink-festivals', [{ column: 'foodFestivals' }]],
  ['festivals', 'cultural-celebrations', [{ column: 'culturalCelebrations' }]],
  ['themeParks', 'thrill-rides-and-coasters', [{ column: 'thrillRides' }]],
  ['themeParks', 'water-parks', [{ column: 'waterParks' }]],
  ['themeParks', 'zoos-and-aquariums', [{ column: 'zoosAquariums' }]],
  ['allInclusive', 'adults-only', [{ column: 'adultsOnly' }]],
  ['allInclusive', 'family-resorts', [{ column: 'familyResorts' }]],
  ['allInclusive', 'luxury-all-inclusive', [{ column: 'luxuryAllInclusive' }]],
  ['golf', 'links-golf', [{ column: 'linksGolf' }]],
  ['golf', 'resort-courses', [{ column: 'resortCourses' }]],
  ['golf', 'scenic-coastal-and-mountain-courses', [{ column: 'scenicCourses' }]],
  ['golf', 'bucket-list-courses', [{ column: 'bucketListCourses' }]],
  ['mountainBiking', 'lift-served-downhill-parks', [{ column: 'liftServedParks' }]],
  ['mountainBiking', 'bikepacking', [{ column: 'bikepackingRoutes' }]],
  ['mountainBiking', 'easy-flow-trails', [{ column: 'easyFlowTrails' }]],
  ['campingBackcountry', 'glamping', [{ column: 'glamping' }]],
  ['campingBackcountry', 'free-wild-camping-allowed', [{ column: 'wildCampingLaw', option: 'allowed' }]],
  ['campingBackcountry', 'car-camping', [{ column: 'campgrounds' }]],
  ['campingBackcountry', 'backpacking', [{ column: 'backcountry' }]],
  ['horsebackRiding', 'beach-rides', [{ column: 'beachRides' }]],
  ['horsebackRiding', 'ranch-stays-and-cattle-drives', [{ column: 'ranchStays' }]],
  ['horsebackRiding', 'multi-day-treks', [{ column: 'multiDayTreks' }]],
  ['sailing', 'sheltered-island-hopping', [{ column: 'shelteredIslandHopping' }]],
  ['sailing', 'racing-and-regattas', [{ column: 'racingRegattas' }]],
  ['sailing', 'expedition-sailing', [{ column: 'expeditionSailing' }]],
  ['kayakingRafting', 'whitewater-rafting', [{ column: 'whitewaterRafting' }]],
  ['kayakingRafting', 'sea-kayaking', [{ column: 'seaKayaking' }]],
  ['kayakingRafting', 'calm-water-paddling', [{ column: 'calmWaterPaddling' }]],
  ['kayakingRafting', 'multi-day-river-trips', [{ column: 'multiDayRiverTrips' }]],
  ['trailRunning', 'coastal-and-island-trails', [{ column: 'coastalIslandTrails' }]],
  ['trailRunning', 'mountain-trail-running', [{ column: 'mountainTrailRunning' }]],
  ['trailRunning', 'ultra-distances-and-races', [{ column: 'raceHost' }]],
  ['trailRunning', 'hut-to-hut-running', [{ column: 'hutToHutRuns' }]],
  ['geologyVolcanoes', 'active-volcanoes', [{ column: 'volcanicLandscapes' }]],
  ['geologyVolcanoes', 'geysers-and-geothermal-fields', [{ column: 'geothermalFeatures' }]],
  ['geologyVolcanoes', 'glaciers-and-ice-caves', [{ column: 'glaciersIce' }]],
  ['geologyVolcanoes', 'caves-and-lava-tubes', [{ column: 'cavesKarst' }]],
  ['indigenousCultures', 'indigenous-led-tours', [{ column: 'indigenousLed' }]],
  ['indigenousCultures', 'homestays', [{ column: 'communityHomestay' }]],
  ['yogaRetreats', 'yoga-retreats', [{ column: 'yogaRetreat' }]],
  ['yogaRetreats', 'detox-retreats', [{ column: 'detoxRetreat' }]],
  ['yogaRetreats', 'meditation-and-silent-retreats', [{ column: 'meditationRetreat' }]],
  ['fishing', 'big-ocean-game-fish', [{ column: 'bigGameFish' }]],
  ['fishing', 'flats-fish', [{ column: 'flatsFish' }]],
  ['fishing', 'trout-and-char', [{ column: 'troutChar' }]],
  ['fishing', 'salmon-and-steelhead', [{ column: 'salmonSteelhead' }]],
  ['fishing', 'freshwater-predators', [{ column: 'freshwaterPredators' }]],
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const { driverProblem } = await import('../src/lib/admin/interest-pages/chips');
  for (const [interestKey, chipKey, drivers] of MAP) {
    const defs = factDefsFor(interestKey);
    const where = and(eq(interestChips.interestKey, interestKey), eq(interestChips.chipKey, chipKey));
    const [cur] = await db.select().from(interestChips).where(where);
    if (!cur) throw new Error(`no chip ${interestKey}:${chipKey}`);
    if (!cur.approvedAt) { console.log(`${chipKey}: NOT approved, left alone`); continue; }
    const problem = driverProblem(drivers[0], defs);
    if (problem) throw new Error(`${chipKey}: ${problem}`);
    console.log(`${interestKey}/${chipKey}: ${cur.status} -> live, reads ${drivers.map((d) => d.column).join(', ')}`);
    if (!apply) continue;
    const next = { ...cur, drivers, needsColumn: '', status: 'live' as const, updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_chip', entityId: `${interestKey}:${chipKey}`, action: 'update', before: cur, after: next, write: (tx) => tx.update(interestChips).set({ drivers, needsColumn: '', status: 'live', updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() }).where(where).returning() });
  }
  if (!apply) console.log('dry run');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
