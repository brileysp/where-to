import { PLACE } from '@/lib/places/keys.generated';
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
    // destinations.ts): zimbabwe and komodo reach real authored peaks (Hwange
    // dry-season waterholes; dragons plus manta season). raja-ampat and
    // denali-interior were on this list and were taken off in Sep 2026: Raja
    // Ampat's 10 is marine life, which diving already scores as a 10 (land
    // animals outrank sea life in this interest), and Denali, like Yellowstone,
    // is the pinnacle of North American wildlife but not comparable to a peak
    // African safari. pantanal removed 2026-09-29: the Wildlife Viewing
    // Authoring Directive (v2, see prompts/wildlifeViewing/v2.md) explicitly
    // places it in the 8.5-9.0 "world-class megafauna hub" tier ("Pantanal
    // jaguars"), same tier as Denali — a real jaguar-density specialty, not
    // a global-pinnacle claim on the level of a Serengeti crossing or an
    // Antarctic hatching season.
    ten: [
      PLACE['galapagos-islands'], PLACE['maasai-mara-and-amboseli'], PLACE['northern-tanzania'], PLACE['okavango-delta'], PLACE['antarctic-peninsula'], PLACE.svalbard,
      PLACE.madagascar, PLACE.rwanda, PLACE.uganda, PLACE['costa-rica'], PLACE['peruvian-amazon'],
      PLACE['victoria-falls-and-hwange'], PLACE['komodo-and-flores'],
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
      PLACE['colombian-andes'], PLACE['cusco-and-sacred-valley'], PLACE['ecuadorian-andes'], PLACE['peruvian-amazon'],
      PLACE['papua-new-guinea'], PLACE.madagascar, PLACE['maasai-mara-and-amboseli'], PLACE.uganda, PLACE['northern-tanzania'],
    ],
  },
  safari: {
    definition: 'The classic big-game safari at its global best.',
    ten: [PLACE['maasai-mara-and-amboseli'], PLACE['northern-tanzania'], PLACE['okavango-delta']],
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
      PLACE['monterey-and-big-sur'], PLACE['vancouver-island'], PLACE['southeast-alaska-and-the-inside-passage'], PLACE['los-cabos'],
      PLACE.maui, PLACE.azores, PLACE.churchill, PLACE['cape-town'], PLACE['antarctic-peninsula'],
      PLACE.sydney,
    ],
  },
  scenicLandscapes: {
    definition: 'The global reference for landscape — the scenery IS the trip.',
    // 21 Nov 2026 (owner's rank checks): ten of these fifteen peak at 10 (El Chaltén & El Calafate, Iceland, Yosemite, Dolomites, Norwegian Fjords, Chamonix,
    // Zermatt, Nepal, Lofoten, Torres del Paine). Five are anchors held below 10 by recorded decision: Milford Sound & Fiordland 9.9, Atacama 9.8 and Salar de
    // Uyuni 9.8 (each is one kind of landscape), Guilin & Yangshuo 9.7, Greenland 9.6. Nobody outside this list is at 10.
    ten: [
      PLACE['el-chalten-and-el-calafate'], PLACE.iceland, PLACE['yosemite-national-park'], PLACE['atacama-desert'], PLACE.dolomites, PLACE['norwegian-fjords'],
      PLACE.greenland, PLACE['chamonix-and-the-french-alps'], PLACE['zermatt-and-the-swiss-alps'], PLACE.nepal, PLACE['lofoten-islands'],
      PLACE['milford-sound-and-fiordland'], PLACE['torres-del-paine'], PLACE['salar-de-uyuni'], PLACE['guilin-and-yangshuo'],
    ],
  },
  landscapePhotography: {
    definition:
      'A landscape photographer plans a trip around it. May exceed the ' +
      "destination's own scenicLandscapes peak (owner decision, 21 Nov 2026).",
    // 21 Nov 2026: the owner decided the cap does not apply. A place can be better to photograph than to look at (Salar de Uyuni, Namibia), so photography may
    // exceed the Scenic peak. This is a hidden slider and no data was changed.",
    ten: [
      PLACE['el-chalten-and-el-calafate'], PLACE.iceland, PLACE['yosemite-national-park'], PLACE['atacama-desert'], PLACE.dolomites, PLACE['norwegian-fjords'],
      PLACE.greenland, PLACE['chamonix-and-the-french-alps'], PLACE['zermatt-and-the-swiss-alps'], PLACE.nepal, PLACE['lofoten-islands'],
      PLACE['milford-sound-and-fiordland'], PLACE['torres-del-paine'], PLACE['salar-de-uyuni'], PLACE['guilin-and-yangshuo'],
    ],
  },
  nationalParks: {
    definition:
      'The park IS the destination and defines the category worldwide. Separate ' +
      'from the US-centric signatureTier notch, which gates how much audience ' +
      'weight the claim earns rather than how good the park is.',
    ten: [
      PLACE['yellowstone-national-park'], PLACE['yosemite-national-park'], PLACE['grand-canyon'], PLACE['torres-del-paine'], PLACE['denali-and-the-interior'],
      PLACE['milford-sound-and-fiordland'], PLACE['banff-and-jasper-national-parks'], PLACE['zion-and-bryce-canyon'], PLACE['sequoia-and-kings-canyon'], PLACE['kruger-and-sabi-sands'],
    ],
  },
  campingBackcountry: {
    definition:
      'Multi-day self-supported wilderness is the point of going, and the ' +
      'terrain, permit culture and route network are a world reference.',
    ten: [
      PLACE['yosemite-national-park'], PLACE['sequoia-and-kings-canyon'], PLACE['glacier-and-waterton-lakes'], PLACE['denali-and-the-interior'],
      PLACE['yellowstone-national-park'], PLACE['north-cascades'], PLACE['banff-and-jasper-national-parks'], PLACE['torres-del-paine'], PLACE['el-chalten-and-el-calafate'],
      PLACE.nepal, PLACE.greenland, PLACE.mongolia,
    ],
  },
  stargazing: {
    definition: 'Certified-dark, dry, high or remote — among the best night skies on earth.',
    ten: [PLACE['palm-springs-and-joshua-tree'], PLACE['big-island'], PLACE['atacama-desert'], PLACE.namibia, PLACE['death-valley-national-park'], PLACE['uluru-and-the-outback'], PLACE['salar-de-uyuni']],
  },
  auroraChasing: {
    definition: 'High-latitude, long dark season, statistically reliable aurora.',
    ten: [PLACE.iceland, PLACE.churchill, PLACE.svalbard, PLACE['finnish-lapland'], PLACE['lofoten-islands']],
  },
  geologyVolcanoes: {
    definition:
      'The rock is the destination: active volcanism you can stand near, or a ' +
      'formation that is the textbook example of its kind.',
    ten: [
      PLACE.iceland, PLACE['big-island'], PLACE['yellowstone-national-park'], PLACE['grand-canyon'], PLACE.ethiopia,
      PLACE['north-island'], PLACE.sicily, PLACE['atacama-desert'], PLACE['salar-de-uyuni'], PLACE['canary-islands'],
    ],
  },
  wildflowerBlooms: {
    definition: 'A bloom that draws travellers on its own — a named, dated, mass event.',
    // iceland removed — no real authored bloom event; its old 10 was a
    // stale artifact of the wildlifePeak fallback bug, not a researched
    // claim (Iceland's subarctic flora isn't a classic bloom destination).
    // amsterdam added Sep 2026: Keukenhof and the Bollenstreek bulb fields are the world's
    // reference tulip event — a named, dated, mass bloom that draws travellers on its own.
    ten: [PLACE['canary-islands'], PLACE['cape-town'], PLACE['tokyo-and-kyoto'], PLACE['glacier-and-waterton-lakes'], PLACE.amsterdam],
  },

  // ---- Sports & Recreation ----------------------------------------------
  hiking: {
    definition: 'A global trekking reference — world walking, not good walking.',
    ten: [
      PLACE.nepal, PLACE.dolomites, PLACE['torres-del-paine'], PLACE['el-chalten-and-el-calafate'], PLACE['chamonix-and-the-french-alps'],
      PLACE['zermatt-and-the-swiss-alps'], PLACE.pakistan, PLACE.ladakh,
    ],
  },
  mountaineering: {
    definition:
      'A world centre for alpinism or big-wall climbing — where the sport is ' +
      'practised at its highest level and where its history was made.',
    ten: [
      PLACE['chamonix-and-the-french-alps'], PLACE.nepal, PLACE.pakistan, PLACE['yosemite-national-park'], PLACE['el-chalten-and-el-calafate'], PLACE['denali-and-the-interior'],
      PLACE['zermatt-and-the-swiss-alps'], PLACE.dolomites,
    ],
  },
  cyclingRoad: {
    definition:
      'Road and gravel riding is a reason to fly there: legendary climbs, ' +
      'surfaces and routes. City-cycling culture is a different thing and does ' +
      'not earn a 10 here.',
    ten: [
      PLACE.mallorca, PLACE.dolomites, PLACE.provence, PLACE.tuscany, PLACE['chamonix-and-the-french-alps'], PLACE['zermatt-and-the-swiss-alps'],
      PLACE.andalucia, PLACE['colombian-andes'],
    ],
  },
  mountainBiking: {
    definition: 'A destination trail network riders travel internationally to ride.',
    ten: [
      PLACE['vancouver-and-whistler'], PLACE['arches-and-canyonlands'], PLACE.queenstown, PLACE['bend-and-crater-lake'],
      PLACE['north-island'], PLACE.tasmania, PLACE.sedona, PLACE.vermont, PLACE['zermatt-and-the-swiss-alps'], PLACE['cape-town'],
    ],
  },
  skiingSnowboarding: {
    definition: 'A world-reference ski destination on terrain, snow and scale.',
    ten: [PLACE['chamonix-and-the-french-alps'], PLACE['zermatt-and-the-swiss-alps'], PLACE.hokkaido, PLACE.dolomites, PLACE['vancouver-and-whistler'], PLACE['aspen-snowmass']],
  },
  surfing: {
    definition: 'A world-reference wave.',
    // Set by the owner on 11 Oct 2026 (was Bali, Maui, Lisbon). French Polynesia is Teahupo'o, Fiji is Cloudbreak, Namibia is Skeleton Bay.
    // 17 Oct 2026: Lisbon dropped (Gemini scores it 9.0, a wave for every level but no single world-reference wave). Namibia stays on the list
    // with no 10, a recorded decision: Skeleton Bay breaks only a few days a year, so it peaks at 9.4.
    ten: [PLACE.bali, PLACE.maui, PLACE['french-polynesia'], PLACE.fiji, PLACE.namibia],
  },
  diving: {
    definition: 'Among the best reefs or marine encounters on the planet.',
    ten: [
      PLACE['raja-ampat'], PLACE.palau, PLACE['great-barrier-reef'], PLACE['galapagos-islands'], PLACE['red-sea-and-nile'], PLACE.maldives, PLACE['komodo-and-flores'],
      PLACE['malaysian-borneo'], PLACE.belize, PLACE.fiji,
    ],
  },
  sailing: { definition: 'A world cruising ground.', ten: [PLACE['dalmatian-coast'], PLACE['santorini-and-cyclades'], PLACE.bahamas] },
  windSports: {
    definition:
      'A world-reference wind-sports coastline — the sport\'s own competitive ' +
      'circuit stops here, or it carries an international "capital of the wind" ' +
      'reputation in its own right.',
    // Each of these seven has hard evidence, not just a good local spot: a
    // multi-decade world-tour venue (canaries' Sotavento PWA World Cup, since
    // the late 1980s), a marquee annual event (aruba's Hi-Winds since 1986,
    // cape-town's Red Bull King of the Air), or an internationally-recognized
    // "capital" branding (andalucia's Tarifa, "Europe's windsurfing/kitesurfing
    // capital"; morocco's Essaouira, the "Windy City of Africa"). Set during
    // windSports' initial authoring pass — a stronger evidentiary bar than
    // surfing's 3-destination anchor set needed, so 7 felt right, but this is
    // a first draft: worth revisiting once real destinations are compared
    // side by side in the sample round.
    ten: [PLACE.maui, PLACE.aruba, PLACE.mauritius, PLACE['cape-town'], PLACE['marrakech-and-atlas'], PLACE['canary-islands'], PLACE.andalucia],
  },
  kayakingRafting: {
    definition: 'A world-reference river or paddling coast.',
    ten: [PLACE['south-luangwa'], PLACE['victoria-falls-and-hwange'], PLACE['grand-canyon'], PLACE['marlborough-and-abel-tasman']],
  },
  adventureSports: {
    definition:
      'An adventure capital — several world-class adrenaline activities in one ' +
      'place, with the operator infrastructure to match.',
    ten: [
      PLACE.queenstown, PLACE['chamonix-and-the-french-alps'], PLACE['zermatt-and-the-swiss-alps'], PLACE['costa-rica'], PLACE['vancouver-and-whistler'], PLACE.nepal,
      PLACE['victoria-falls-and-hwange'], PLACE.dolomites,
    ],
  },
  golf: {
    definition: 'A bucket-list course or cluster golfers plan a trip around.',
    ten: [PLACE['monterey-and-big-sur'], PLACE.dubai, PLACE['los-cabos'], PLACE.algarve, PLACE['st-andrews-and-fife']],
  },
  fishing: {
    definition: 'A named world fishery — the fish is the reason for the trip.',
    ten: [
      PLACE['costa-rica'], PLACE['argentine-lake-district'], PLACE.belize,
      PLACE['southeast-alaska-and-the-inside-passage'], PLACE['yellowstone-national-park'], PLACE['los-cabos'], PLACE.bahamas, PLACE.pantanal,
    ],
  },
  horsebackRiding: {
    definition: 'A riding culture you travel into — multi-day riding across open country.',
    ten: [PLACE.iceland, PLACE.mongolia, PLACE.kyrgyzstan, PLACE['argentine-lake-district'], PLACE.provence, PLACE.andalucia],
  },
  trailRunning: {
    definition: 'A trail-running destination with the races and the terrain to prove it.',
    ten: [
      PLACE['el-chalten-and-el-calafate'], PLACE['lake-district'], PLACE['canary-islands'], PLACE['cape-town'], PLACE.dolomites, PLACE['chamonix-and-the-french-alps'],
      PLACE['zermatt-and-the-swiss-alps'], PLACE['rocky-mountain-national-park'], PLACE.nepal,
    ],
  },

  // ---- Culture & Discovery ----------------------------------------------
  historyArchaeology: {
    definition: 'A site of world-historical importance that people travel specifically to see.',
    ten: [PLACE.athens, PLACE['red-sea-and-nile'], PLACE['cusco-and-sacred-valley'], PLACE.cambodia, PLACE['petra-and-wadi-rum'], PLACE.myanmar, PLACE['beijing-and-great-wall'], PLACE.rome, PLACE['samarkand-and-bukhara']],
  },
  museumsArt: {
    definition:
      'Holds collections that are a reason in themselves to visit the city — ' +
      'the museums, not the monuments.',
    ten: [
      PLACE.paris, PLACE.london, PLACE['new-york-city'], PLACE.rome, PLACE.tuscany, PLACE.vienna, PLACE.amsterdam, PLACE.berlin,
      PLACE['mexico-city'], PLACE.athens,
    ],
  },
  architecture: {
    definition:
      'A world reference for the built environment — people study it, not just ' +
      'photograph it.',
    ten: [
      PLACE.rome, PLACE.paris, PLACE.venice, PLACE.istanbul, PLACE.barcelona, PLACE['tokyo-and-kyoto'], PLACE['beijing-and-great-wall'],
      PLACE.cambodia, PLACE.vienna, PLACE.prague, PLACE.andalucia, PLACE['new-york-city'], PLACE.chicago, PLACE['samarkand-and-bukhara'],
      // Florence, Siena, Pisa. Added when the hiking deflation dropped
      // Tuscany out of its expected band and its profile showed why: it was
      // riding an inflated hiking 9 while the Duomo, the Uffizi and the
      // Palazzo Vecchio sat at an 8.
      PLACE.tuscany,
    ],
  },
  cityExploration: {
    definition: 'One of the great cities to simply walk around in.',
    ten: [PLACE['tokyo-and-kyoto'], PLACE.paris, PLACE.london, PLACE.istanbul, PLACE['hong-kong'], PLACE['new-york-city'], PLACE.rome, PLACE.barcelona],
  },
  indigenousCultures: {
    definition: 'Living indigenous culture, met on its own terms, is central to the visit.',
    ten: [PLACE['cusco-and-sacred-valley'], PLACE['uluru-and-the-outback'], PLACE['papua-new-guinea']],
  },
  religiousSites: {
    definition: 'A first-rank pilgrimage or sacred landscape of global significance.',
    ten: [PLACE.ethiopia, PLACE.bhutan, PLACE.myanmar, PLACE.rome],
  },
  festivals: {
    definition: 'A festival famous enough that people time the whole trip to it.',
    ten: [
      PLACE['rio-de-janeiro'], PLACE['bavaria-and-munich'], PLACE.edinburgh, PLACE.oaxaca, PLACE.andalucia, PLACE['chiang-mai-and-northern-thailand'],
      PLACE['tokyo-and-kyoto'], PLACE['papua-new-guinea'],
    ],
  },
  traditionalCrafts: {
    definition: 'A living craft tradition worth travelling for.',
    ten: [PLACE['marrakech-and-atlas'], PLACE.oaxaca],
  },
  streetFood: {
    definition: 'Eating on the street is one of the top reasons to go, and among the best anywhere.',
    ten: [
      PLACE.bangkok, PLACE['mexico-city'], PLACE.oaxaca, PLACE.istanbul, PLACE['hong-kong'], PLACE.taiwan, PLACE.vietnam,
      PLACE.singapore, PLACE.seoul, PLACE['marrakech-and-atlas'],
    ],
  },
  fineDining: {
    definition: 'A global restaurant capital people book flights around.',
    ten: [
      PLACE.paris, PLACE['tokyo-and-kyoto'], PLACE['new-york-city'], PLACE.copenhagen, PLACE['basque-country'], PLACE.london,
      PLACE['hong-kong'], PLACE.barcelona, PLACE['mexico-city'], PLACE.piedmont,
    ],
  },
  wineSpirits: {
    definition: 'A benchmark wine or spirits region with the visitor culture to match.',
    ten: [
      PLACE.rioja, PLACE.bordeaux, PLACE['marlborough-and-abel-tasman'], PLACE.provence, PLACE['douro-valley-and-porto'],
      PLACE.mendoza, PLACE['tbilisi-and-the-caucasus'], PLACE.piedmont, PLACE.tuscany, PLACE['napa-and-sonoma'], PLACE.champagne,
    ],
  },
  coffeeTea: {
    definition: 'The origin or the ritual is world-defining.',
    ten: [PLACE.ethiopia, PLACE['colombian-andes']],
  },

  // ---- Relaxation, Leisure & Practical ----------------------------------
  beachesSwimming: {
    definition: 'Among the best beaches on earth to actually swim from.',
    ten: [
      PLACE['turks-and-caicos'], PLACE.maldives, PLACE['french-polynesia'], PLACE.seychelles, PLACE.bahamas, PLACE.barbados,
      PLACE.palawan, PLACE.fiji, PLACE.maui, PLACE.mauritius,
    ],
  },
  sunbathing: {
    definition:
      'Near-guaranteed sun and a beach built for lying on it. This is about ' +
      'reliability and lounging, not scenery.',
    ten: [
      PLACE['turks-and-caicos'], PLACE.maldives, PLACE['french-polynesia'], PLACE.barbados, PLACE.aruba, PLACE.bahamas,
      PLACE['dominican-republic'], PLACE['riviera-maya'], PLACE['canary-islands'], PLACE.algarve, PLACE['red-sea-and-nile'], PLACE['los-cabos'],
    ],
  },
  luxuryHotels: {
    definition: 'Holds hotels or lodges that are themselves the destination.',
    ten: [
      PLACE.maldives, PLACE['french-polynesia'], PLACE['okavango-delta'], PLACE['maasai-mara-and-amboseli'], PLACE['northern-tanzania'], PLACE['kruger-and-sabi-sands'], PLACE.paris,
      PLACE.london, PLACE['tokyo-and-kyoto'], PLACE['new-york-city'], PLACE.dubai, PLACE.bali,
    ],
  },
  allInclusive: { definition: 'The global centre of gravity for the resort format.', ten: [PLACE['dominican-republic'], PLACE['riviera-maya']] },
  spaWellness: {
    definition: 'A wellness destination in its own right, not a hotel amenity.',
    ten: [PLACE['french-polynesia'], PLACE.maldives, PLACE.sedona, PLACE['phuket-and-the-andaman-coast'], PLACE.budapest, PLACE.kerala, PLACE.bali],
  },
  hotSprings: {
    definition: 'A world bathing culture.',
    // Hokkaido was added after the seasonal-sign fix. Japanese onsen culture
    // plainly belongs here, and it was missing only because the swim formula
    // docked -5 for a cold month: Hokkaido's rotenburo in the snow — the
    // single most iconic image of the whole interest — were being scored as
    // its worst season, so it never reached a 10 for anyone to notice.
    ten: [PLACE.iceland, PLACE.budapest, PLACE.hokkaido],
  },
  yogaRetreats: { definition: 'A world centre of the practice.', ten: [PLACE.kerala, PLACE.bali] },
  themeParks: { definition: 'A world-reference park cluster.', ten: [] },
  nightlife: {
    definition: 'A night out here is a reason people choose the city.',
    ten: [PLACE['buenos-aires'], PLACE['hong-kong'], PLACE['new-orleans'], PLACE['rio-de-janeiro'], PLACE.berlin, PLACE.bangkok, PLACE['new-york-city'], PLACE.seoul, PLACE.barcelona],
  },
  shopping: {
    definition: 'A global shopping capital, whether luxury retail or a great market city.',
    ten: [PLACE.paris, PLACE.london, PLACE['hong-kong'], PLACE.singapore, PLACE['marrakech-and-atlas'], PLACE.dubai, PLACE.bangkok, PLACE['rajasthan-and-the-golden-triangle'], PLACE['new-york-city'], PLACE.seoul],
  },
  familyFun: {
    definition: 'Genuinely built for travelling with children, end to end.',
    ten: [PLACE['costa-rica'], PLACE['turks-and-caicos'], PLACE.maui],
  },
  roadtrip: {
    definition:
      'The drive is the trip. A named touring route where the road itself is ' +
      'the attraction, not a park you drive to and then stop.',
    ten: [
      PLACE.iceland, PLACE.ireland, PLACE['scottish-highlands-and-isle-of-skye'], PLACE['norwegian-fjords'], PLACE['monterey-and-big-sur'],
      PLACE['banff-and-jasper-national-parks'], PLACE['glacier-and-waterton-lakes'], PLACE.queenstown, PLACE.namibia, PLACE['argentine-lake-district'],
      PLACE.dolomites, PLACE['cape-town'],
    ],
  },

  // `deals` and `crowds` are trip constraints, not interests — they carry no
  // ceiling claim and are deliberately absent.
};
