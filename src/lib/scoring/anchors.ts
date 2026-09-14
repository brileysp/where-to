/**
 * What a 10 means, per interest.
 *
 * Every score in this catalogue is a claim on a 0-10 scale, but until this
 * file existed the scale was implicit — which is exactly how the same
 * catalogue came to hold Yosemite at 4 for scenery and Zion at 8, and how
 * 117 of 200 destinations arrived at a perfect scenic 10 that nobody had
 * ever actually claimed.
 *
 * An anchor set is the closed list of destinations allowed to hold a 10 for
 * an interest, plus one sentence saying what that 10 asserts. It is the
 * ceiling of the scale and nothing else: it says nothing about the ordering
 * below 10, and it is deliberately short — usually 8 to 14 — because a top
 * grade held by a quarter of the catalogue conveys no information.
 *
 * This is the reviewable artifact, not the enforcement. `audit-anchors.ts`
 * reads it and reports both directions of drift (an anchor that has fallen
 * below 10, a non-anchor that has climbed to it). Editing a list here is
 * how you change the scale; re-running that audit is how you find out what
 * the change implies.
 *
 * `ten` holds place ids. An interest with no entry has no ceiling defined
 * yet — the audit lists those separately rather than treating them as
 * anchor-free.
 */
export type InterestAnchor = {
  /** What a 10 asserts about a destination for this interest. */
  definition: string;
  /** The only destinations permitted a peak of 10. */
  ten: string[];
};

/**
 * Keyed by slider key. `audit-anchors.ts` validates the keys against
 * SLIDERS and the ids against the catalogue, so a typo here fails loudly
 * rather than silently exempting an interest from its own ceiling.
 */
export const INTEREST_ANCHORS: Record<string, InterestAnchor> = {
  // ---- Nature & Wildlife -------------------------------------------------
  wildlifeViewing: {
    definition:
      'Seeing wild animals is the reason the trip exists, and the density or ' +
      'accessibility of them is a global reference. A place where you WILL see ' +
      'remarkable animals, not one where you might.',
    // Found fixing the wildlifePeak fallback bug (see the 'wildlife' case in
    // destinations.ts): raja-ampat, denali-interior, zimbabwe, and komodo all
    // reach 10 on real authored sliderEvents (marine biodiversity, caribou/
    // bear salmon runs, Hwange dry-season waterholes, and marine life
    // respectively) — genuinely deserving, just never added here.
    ten: [
      'galapagos', 'kenya', 'tanzania', 'botswana', 'antarctica', 'svalbard',
      'madagascar', 'rwanda', 'uganda', 'pantanal', 'costa-rica', 'peruvian-amazon',
      'rajaampat', 'denali-interior', 'zimbabwe', 'komodo',
    ],
  },
  birding: {
    definition:
      'A destination birders travel across the world for: top-tier species ' +
      'counts, endemism, or a bird nobody sees anywhere else.',
    // costa-rica, pantanal, and ethiopia were removed from this list —
    // audit-birding-model.ts's first-principles model (species count,
    // endemism, charisma, spectacle) puts all three at a precise 9.1/8.8/
    // 9.1, genuinely a notch below the true ceiling, not tied for it.
    ten: [
      'colombian-andes', 'peru', 'ecuadorian-andes', 'peruvian-amazon',
      'papua-new-guinea', 'madagascar', 'kenya', 'uganda', 'tanzania',
    ],
  },
  safari: {
    definition: 'The classic big-game safari at its global best.',
    ten: ['kenya', 'tanzania', 'botswana'],
  },
  whaleWatching: {
    definition:
      'Reliable, close, world-class cetacean encounters in season — the whales ' +
      'are a headline reason people book the trip.',
    // nova-scotia removed — it carried no real authored whale event at all;
    // its old 10 was a stale artifact, not a researched claim (Bay of Fundy
    // humpback watching is real but a genuine event still needs authoring).
    // churchill (beluga whales, Jul-Aug) and cape-town (southern right whales
    // at Hermanus) reach 10 on real authored events, found fixing the
    // wildlifePeak fallback bug. antarctica added when its own whaleWatching
    // event was authored (was flat 8, no within-season gradient) — Feb-Mar
    // humpback/minke/orca sightings there are genuinely world-class, same
    // tier as the rest of this list. srilanka and iceland REMOVED after
    // researching a "would a serious whale-watching enthusiast agree these
    // are equally world-class" question — srilanka has a well-documented,
    // ongoing boat-overcrowding/weak-enforcement problem off Mirissa (10-25
    // boats observed chasing a single blue whale; Kaikoura/Azores cap
    // simultaneous boats at 3), and iceland's sightings skew heavily toward
    // minke whales (a NAMMCO study confirms this), which serious enthusiasts
    // regard as a lesser encounter than blue/humpback. Both still real,
    // dialed down rather than removed from the catalog.
    ten: [
      'monterey-big-sur', 'vancouver-island', 'southeast-alaska', 'los-cabos',
      'maui', 'azores', 'churchill', 'cape-town', 'antarctica',
      'sydney',
    ],
  },
  scenicLandscapes: {
    definition: 'The global reference for landscape — the scenery IS the trip.',
    ten: [
      'el-chalten', 'iceland', 'yosemite', 'atacama', 'dolomites', 'fjords',
      'greenland', 'chamonix', 'swissalps', 'nepal', 'lofoten',
      'milford-sound-fiordland', 'torres-del-paine', 'uyuni', 'guilin-yangshuo',
    ],
  },
  landscapePhotography: {
    definition:
      'A landscape photographer plans a trip around it. Capped at the ' +
      "destination's own scenicLandscapes peak — a photograph cannot beat the " +
      'landscape it is a photograph of.',
    ten: [
      'el-chalten', 'iceland', 'yosemite', 'atacama', 'dolomites', 'fjords',
      'greenland', 'chamonix', 'swissalps', 'nepal', 'lofoten',
      'milford-sound-fiordland', 'torres-del-paine', 'uyuni', 'guilin-yangshuo',
    ],
  },
  nationalParks: {
    definition:
      'The park IS the destination and defines the category worldwide. Separate ' +
      'from the US-centric signatureTier notch, which gates how much audience ' +
      'weight the claim earns rather than how good the park is.',
    ten: [
      'yellowstone', 'yosemite', 'grandcanyon', 'torres-del-paine', 'denali-interior',
      'milford-sound-fiordland', 'banff', 'zion-bryce', 'sequoia-kings-canyon', 'kruger',
    ],
  },
  campingBackcountry: {
    definition:
      'Multi-day self-supported wilderness is the point of going, and the ' +
      'terrain, permit culture and route network are a world reference.',
    ten: [
      'yosemite', 'sequoia-kings-canyon', 'glacier-waterton', 'denali-interior',
      'yellowstone', 'north-cascades', 'banff', 'torres-del-paine', 'el-chalten',
      'nepal', 'greenland', 'mongolia',
    ],
  },
  stargazing: {
    definition: 'Certified-dark, dry, high or remote — among the best night skies on earth.',
    ten: ['joshua-tree', 'big-island', 'atacama', 'namibia', 'death-valley', 'uluru', 'uyuni'],
  },
  auroraChasing: {
    definition: 'High-latitude, long dark season, statistically reliable aurora.',
    ten: ['iceland', 'churchill', 'svalbard', 'lapland', 'lofoten'],
  },
  geologyVolcanoes: {
    definition:
      'The rock is the destination: active volcanism you can stand near, or a ' +
      'formation that is the textbook example of its kind.',
    ten: [
      'iceland', 'big-island', 'yellowstone', 'grandcanyon', 'ethiopia',
      'north-island', 'sicily', 'atacama', 'uyuni', 'canaries',
    ],
  },
  wildflowerBlooms: {
    definition: 'A bloom that draws travellers on its own — a named, dated, mass event.',
    // iceland removed — no real authored bloom event; its old 10 was a
    // stale artifact of the wildlifePeak fallback bug, not a researched
    // claim (Iceland's subarctic flora isn't a classic bloom destination).
    ten: ['canaries', 'cape-town', 'tokyo-kyoto', 'glacier-waterton'],
  },

  // ---- Sports & Recreation ----------------------------------------------
  hiking: {
    definition: 'A global trekking reference — world walking, not good walking.',
    ten: [
      'nepal', 'dolomites', 'torres-del-paine', 'el-chalten', 'chamonix',
      'swissalps', 'pakistan', 'ladakh',
    ],
  },
  mountaineering: {
    definition:
      'A world centre for alpinism or big-wall climbing — where the sport is ' +
      'practised at its highest level and where its history was made.',
    ten: [
      'chamonix', 'nepal', 'pakistan', 'yosemite', 'el-chalten', 'denali-interior',
      'swissalps', 'dolomites',
    ],
  },
  cyclingRoad: {
    definition:
      'Road and gravel riding is a reason to fly there: legendary climbs, ' +
      'surfaces and routes. City-cycling culture is a different thing and does ' +
      'not earn a 10 here.',
    ten: [
      'mallorca', 'dolomites', 'provence', 'tuscany', 'chamonix', 'swissalps',
      'andalucia', 'colombian-andes',
    ],
  },
  mountainBiking: {
    definition: 'A destination trail network riders travel internationally to ride.',
    ten: [
      'whistler', 'arches-canyonlands', 'queenstown', 'bend-crater-lake',
      'north-island', 'tasmania', 'sedona', 'vermont', 'swissalps', 'cape-town',
    ],
  },
  skiingSnowboarding: {
    definition: 'A world-reference ski destination on terrain, snow and scale.',
    ten: ['chamonix', 'swissalps', 'hokkaido', 'dolomites', 'whistler', 'aspen'],
  },
  surfing: {
    definition: 'A world-reference wave.',
    ten: ['bali', 'maui', 'lisbon'],
  },
  diving: {
    definition: 'Among the best reefs or marine encounters on the planet.',
    ten: [
      'rajaampat', 'palau', 'gbr', 'galapagos', 'egypt', 'maldives', 'komodo',
      'borneo', 'belize', 'fiji',
    ],
  },
  sailing: { definition: 'A world cruising ground.', ten: ['croatia', 'santorini', 'bahamas'] },
  kayakingRafting: {
    definition: 'A world-reference river or paddling coast.',
    ten: ['zambia', 'zimbabwe', 'grandcanyon', 'marlborough-abel-tasman'],
  },
  adventureSports: {
    definition:
      'An adventure capital — several world-class adrenaline activities in one ' +
      'place, with the operator infrastructure to match.',
    ten: [
      'queenstown', 'chamonix', 'swissalps', 'costa-rica', 'whistler', 'nepal',
      'zimbabwe', 'dolomites',
    ],
  },
  golf: {
    definition: 'A bucket-list course or cluster golfers plan a trip around.',
    ten: ['monterey-big-sur', 'dubai', 'los-cabos', 'algarve', 'st-andrews-fife'],
  },
  fishing: {
    definition: 'A named world fishery — the fish is the reason for the trip.',
    ten: [
      'costa-rica', 'argentine-lake-district', 'belize',
      'southeast-alaska', 'yellowstone', 'los-cabos', 'bahamas', 'pantanal',
    ],
  },
  horsebackRiding: {
    definition: 'A riding culture you travel into — multi-day riding across open country.',
    ten: ['iceland', 'mongolia', 'kyrgyzstan', 'argentine-lake-district', 'provence', 'andalucia'],
  },
  trailRunning: {
    definition: 'A trail-running destination with the races and the terrain to prove it.',
    ten: [
      'el-chalten', 'lake-district', 'canaries', 'cape-town', 'dolomites', 'chamonix',
      'swissalps', 'rocky-mountain', 'nepal',
    ],
  },

  // ---- Culture & Discovery ----------------------------------------------
  historyArchaeology: {
    definition: 'A site of world-historical importance that people travel specifically to see.',
    ten: ['athens', 'egypt', 'peru', 'angkor', 'jordan', 'bagan', 'beijing', 'rome', 'uzbekistan'],
  },
  museumsArt: {
    definition:
      'Holds collections that are a reason in themselves to visit the city — ' +
      'the museums, not the monuments.',
    ten: [
      'paris', 'london', 'nyc', 'rome', 'tuscany', 'vienna', 'amsterdam', 'berlin',
      'mexicocity', 'athens',
    ],
  },
  architecture: {
    definition:
      'A world reference for the built environment — people study it, not just ' +
      'photograph it.',
    ten: [
      'rome', 'paris', 'venice', 'istanbul', 'barcelona', 'tokyo-kyoto', 'beijing',
      'angkor', 'vienna', 'prague', 'andalucia', 'nyc', 'chicago', 'uzbekistan',
      // Florence, Siena, Pisa. Added when the hiking deflation dropped
      // Tuscany out of its expected band and its profile showed why: it was
      // riding an inflated hiking 9 while the Duomo, the Uffizi and the
      // Palazzo Vecchio sat at an 8.
      'tuscany',
    ],
  },
  cityExploration: {
    definition: 'One of the great cities to simply walk around in.',
    ten: ['tokyo-kyoto', 'paris', 'london', 'istanbul', 'hongkong', 'nyc', 'rome', 'barcelona'],
  },
  indigenousCultures: {
    definition: 'Living indigenous culture, met on its own terms, is central to the visit.',
    ten: ['peru', 'uluru', 'papua-new-guinea'],
  },
  religiousSites: {
    definition: 'A first-rank pilgrimage or sacred landscape of global significance.',
    ten: ['ethiopia', 'bhutan', 'bagan', 'rome'],
  },
  festivals: {
    definition: 'A festival famous enough that people time the whole trip to it.',
    ten: [
      'rio', 'bavaria-munich', 'edinburgh', 'oaxaca', 'andalucia', 'chiang-mai',
      'tokyo-kyoto', 'papua-new-guinea',
    ],
  },
  traditionalCrafts: {
    definition: 'A living craft tradition worth travelling for.',
    ten: ['morocco', 'oaxaca'],
  },
  streetFood: {
    definition: 'Eating on the street is one of the top reasons to go, and among the best anywhere.',
    ten: [
      'bangkok', 'mexicocity', 'oaxaca', 'istanbul', 'hongkong', 'taiwan', 'vietnam',
      'singapore', 'seoul', 'morocco',
    ],
  },
  fineDining: {
    definition: 'A global restaurant capital people book flights around.',
    ten: [
      'paris', 'tokyo-kyoto', 'nyc', 'copenhagen', 'basque-country', 'london',
      'hongkong', 'barcelona', 'mexicocity', 'piedmont',
    ],
  },
  wineSpirits: {
    definition: 'A benchmark wine or spirits region with the visitor culture to match.',
    ten: [
      'rioja', 'bordeaux', 'marlborough-abel-tasman', 'provence', 'douro-valley-porto',
      'mendoza', 'tbilisi-caucasus', 'piedmont', 'tuscany', 'napa', 'champagne',
    ],
  },
  coffeeTea: {
    definition: 'The origin or the ritual is world-defining.',
    ten: ['ethiopia', 'colombian-andes'],
  },

  // ---- Relaxation, Leisure & Practical ----------------------------------
  beachesSwimming: {
    definition: 'Among the best beaches on earth to actually swim from.',
    ten: [
      'turks-caicos', 'maldives', 'borabora', 'seychelles', 'bahamas', 'barbados',
      'palawan', 'fiji', 'maui', 'mauritius',
    ],
  },
  sunbathing: {
    definition:
      'Near-guaranteed sun and a beach built for lying on it. This is about ' +
      'reliability and lounging, not scenery.',
    ten: [
      'turks-caicos', 'maldives', 'borabora', 'barbados', 'aruba', 'bahamas',
      'punta-cana', 'rivieramaya', 'canaries', 'algarve', 'egypt', 'los-cabos',
    ],
  },
  luxuryHotels: {
    definition: 'Holds hotels or lodges that are themselves the destination.',
    ten: [
      'maldives', 'borabora', 'botswana', 'kenya', 'tanzania', 'kruger', 'paris',
      'london', 'tokyo-kyoto', 'nyc', 'dubai', 'bali',
    ],
  },
  allInclusive: { definition: 'The global centre of gravity for the resort format.', ten: ['punta-cana', 'rivieramaya'] },
  spaWellness: {
    definition: 'A wellness destination in its own right, not a hotel amenity.',
    ten: ['borabora', 'maldives', 'sedona', 'thailand', 'budapest', 'kerala', 'bali'],
  },
  hotSprings: {
    definition: 'A world bathing culture.',
    // Hokkaido was added after the seasonal-sign fix. Japanese onsen culture
    // plainly belongs here, and it was missing only because the swim formula
    // docked -5 for a cold month: Hokkaido's rotenburo in the snow — the
    // single most iconic image of the whole interest — were being scored as
    // its worst season, so it never reached a 10 for anyone to notice.
    ten: ['iceland', 'budapest', 'hokkaido'],
  },
  yogaRetreats: { definition: 'A world centre of the practice.', ten: ['kerala', 'bali'] },
  themeParks: { definition: 'A world-reference park cluster.', ten: [] },
  nightlife: {
    definition: 'A night out here is a reason people choose the city.',
    ten: ['buenosaires', 'hongkong', 'new-orleans', 'rio', 'berlin', 'bangkok', 'nyc', 'seoul', 'barcelona'],
  },
  shopping: {
    definition: 'A global shopping capital, whether luxury retail or a great market city.',
    ten: ['paris', 'london', 'hongkong', 'singapore', 'morocco', 'dubai', 'bangkok', 'rajasthan-golden-triangle', 'nyc', 'seoul'],
  },
  familyFun: {
    definition: 'Genuinely built for travelling with children, end to end.',
    ten: ['costa-rica', 'turks-caicos', 'maui'],
  },
  spectatorSports: { definition: 'A world sporting occasion.', ten: ['london'] },
  roadtrip: {
    definition:
      'The drive is the trip. A named touring route where the road itself is ' +
      'the attraction, not a park you drive to and then stop.',
    ten: [
      'iceland', 'ireland', 'scottish-highlands-skye', 'fjords', 'monterey-big-sur',
      'banff', 'glacier-waterton', 'queenstown', 'namibia', 'argentine-lake-district',
      'dolomites', 'cape-town',
    ],
  },

  // `deals` and `crowds` are trip constraints, not interests — they carry no
  // ceiling claim and are deliberately absent.
};
