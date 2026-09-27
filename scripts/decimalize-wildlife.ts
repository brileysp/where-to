import { runDecimalize } from './decimalize-runner';

// Wildlife Viewing decimalization pass. The earlier "de-flattening" pass fixed
// specific bugs but left 94% of monthly scores whole/half numbers, so the by-
// interest rank list was a wall of ties (found Sep 2026 — see playbook §1 Step 6,
// "Resolution check"). Text is NOT touched: every place keeps its blurbs, and
// every month keeps its shape. What changes is the caliber decimal. Each place
// gets a target peak (CALIBER) from a within-tier specialist ordering, kept
// within roughly +/-0.6 of its old peak so no existing tier judgement is
// overturned, and each month is re-derived as
//     new = old + (target - oldPeak) * (old / oldPeak)^2
// so identical old scores (identical text groups) stay identical, the peak lands
// exactly on the target, and weak months barely move. Written into
// scoreOverrides.wildlifeViewing as decimals, like every other decimal interest.
// Literal 10s. The playbook's rule is per PLACE, not per catalog: an anchor
// (anchors.ts wildlifeViewing.ten) may hold the literal 10 for its narrowest best
// 1-3 months (4 for a two-season place like Uganda) and nothing wider. TENS lists
// those months (0-indexed). Every other month of that place is scaled toward its
// caliber target in CALIBER, so a shoulder month can still be 9.x. Anchors whose
// peak text repeats over 4+ months (Serengeti, Galapagos, Okavango, Pantanal,
// Madagascar, Hwange, Peruvian Amazon, Costa Rica) get no 10: identical text can't
// be split, and a 4+ month plateau at the cap is exactly what Step 6 forbids.
const tens = {
  rwanda: [5, 6, 7], uganda: [0, 1, 5, 6], kenya: [7, 8, 9],
  // Serengeti: the Ndutu calving Jan-Mar (3 identical months) is what its own overview calls
  // "predictable and dramatic, arguably more reliable" than the crossings; the Jun-Oct
  // crossings (5 identical months, "not guaranteed on any single day") stay at the plateau score.
  tanzania: [0, 1, 2],
  // Okavango: Jul-Sep are the flood-pulse peak; Jun and Oct now carry their own text (below)
  // so the literal 10 doesn't sit on a 5-month identical-text plateau.
  botswana: [6, 7, 8],
};

// Land beats sea (user call, Sep 2026): diving, snorkeling and whale watching are
// their own interests, so marine life earns wildlife credit but less than big land
// animals — the way birding is handled. Raja Ampat (already a 10 in diving), Komodo
// (the dragons are the land draw; the 10 came from manta season) and every
// whale-/reef-led place therefore sit below the land-safari tier here. Denali and
// Yellowstone are the pinnacle of North American wildlife but not comparable to a
// peak African safari, so neither holds a 10, and Svalbard (cruise-based, polar bears
// not guaranteed) also sits below 10. Only Antarctica keeps a 10 outside Africa/gorillas.
//
// Hand-set curves where the generic scaling would under-rate a top land park:
const custom = {
  // Maasai Mara: Aug-Oct river crossings are the literal 10s; the off-migration
  // months are still lions, elephants and resident big cats near-certain, i.e. the
  // world's best baseline, and the Mar-May text (migration moved on, density lower) is
  // the only real dip.
  kenya: [9.5, 9.5, 8.9, 8.9, 8.9, 9.3, 9.7, 10, 10, 10, 9.5, 9.5],
};

const text = {
  botswana: {
    5: 'The flood pulse is at or near full extent and wildlife is concentrating along the channels, though sightings are not yet at their most concentrated. This is also a good time for African wild dogs.',
    9: 'Still within the flood-pulse season — floodwaters begin to recede and the heat builds, but sightings remain highly concentrated around the remaining water. This is also a good time for African wild dogs.',
  },
};
const set = { botswana: { 5: 9.5, 9: 9.5 } };

// Land beats sea (user call, Sep 2026): diving, snorkeling and whale watching are
// their own interests, so marine life earns wildlife credit but less than big land
// animals — the way birding is handled. Raja Ampat (already a 10 in diving), Komodo
// (the dragons are the land draw; the 10 came from manta season) and every
// whale-/reef-led place therefore sit below the land-safari tier here. Denali and
// Yellowstone are the pinnacle of North American wildlife but not comparable to a
// peak African safari, so neither holds a 10, and Svalbard (cruise-based, polar bears
// not guaranteed) also sits below 10. Only Antarctica keeps a 10 outside Africa/gorillas.
//
// Hand-set curves where the generic scaling would under-rate a top land park:
const CUSTOM: Record<string, number[]> = {
  // Maasai Mara: Aug-Oct river crossings are the literal 10s; the off-migration
  // months are still lions, elephants and resident big cats near-certain, i.e. the
  // world's best baseline, and the Mar-May text (migration moved on, density lower) is
  // the only real dip.
  kenya: [9.5, 9.5, 8.9, 8.9, 8.9, 9.3, 9.7, 10, 10, 10, 9.5, 9.5],
};
const flat = { galapagos: 9.7 };

const caliber = {
  // anchors (shoulder / plateau caliber; the literal 10s are in TENS)
  tanzania: 9.8, uganda: 9.8, rwanda: 9.7, galapagos: 9.7, pantanal: 9.7, svalbard: 8.8, botswana: 9.6,
  madagascar: 9.4, zimbabwe: 9.3, 'peruvian-amazon': 9.2, komodo: 9.0, 'costa-rica': 9.0,
  'denali-interior': 8.8, kenya: 9.8, rajaampat: 8.0,
  // old 9
  yellowstone: 8.6, kruger: 9.0, srilanka: 8.9, borneo: 8.9, zambia: 8.8, kaziranga: 8.8,
  namibia: 8.7, 'southeast-alaska': 8.6, 'torres-del-paine': 8.6, falklands: 8.2, gbr: 7.5,
  ethiopia: 8.4, 'rajasthan-golden-triangle': 8.4, tasmania: 8.3,
  // old 8
  churchill: 8.5, 'monterey-big-sur': 7.9, 'vancouver-island': 8.3, banff: 8.2, 'tierra-del-fuego': 8.1,
  'big-island': 7.2, everglades: 7.9, iceland: 7.9, ladakh: 7.8, nepal: 7.8, hokkaido: 7.7,
  belize: 7.4, maldives: 6.5, ghana: 7.5, nicaragua: 7.4,
  // old 7 / 6.5
  'rocky-mountain': 7.5, 'glacier-waterton': 7.4, maui: 6.5, 'los-cabos': 6.3, olympic: 7.2,
  azores: 6.2, 'scottish-highlands-skye': 7.0, 'nova-scotia': 7.0, 'great-smoky-mountains': 6.9,
  seychelles: 6.9, kerala: 6.8, 'cape-cod-islands': 6.0, thailand: 6.7, rivieramaya: 6.0,
  guatemala: 6.6, 'zion-bryce': 6.6,
  // old 6
  'badlands-black-hills': 6.5, 'cape-town': 6.4, redwood: 6.3, lofoten: 6.2, uyuni: 6.1, 'el-chalten': 6.1,
  'papua-new-guinea': 6.0, 'ecuadorian-andes': 6.0, palawan: 5.9, 'colombian-andes': 5.9, palau: 5.0,
  atacama: 5.8, bali: 5.7, 'punta-cana': 5.6, grandcanyon: 5.5,
  // old 5
  greenland: 5.4, 'north-cascades': 5.3, 'faroe-islands': 5.2, 'upper-peninsula': 5.1, whistler: 5.0,
  yosemite: 5.1, chiapas: 5.0, provence: 4.9, peru: 4.9, uluru: 4.8, okinawa: 4.2, barbados: 4.6,
  // old 4
  'milford-sound-fiordland': 4.5, mongolia: 4.5, panama: 4.5, lapland: 4.4, 'chiang-mai': 4.4,
  chamonix: 4.3, fjords: 4.3, 'new-orleans': 4.3, aspen: 4.2, 'sequoia-kings-canyon': 4.2,
  'argentine-lake-district': 4.1, bhutan: 4.1, 'north-island': 4.0, 'bend-crater-lake': 4.0,
  singapore: 4.0, canaries: 4.0, sydney: 3.9, borabora: 3.4, kyrgyzstan: 3.8, rio: 3.8, vermont: 3.8,
  mauritius: 3.7, vietnam: 3.7, pakistan: 3.7, 'tbilisi-caucasus': 3.6,
  // old 3
  'marlborough-abel-tasman': 3.4, taiwan: 3.4, ireland: 3.4, luangprabang: 3.4, bahamas: 3.0,
  'puerto-rico': 3.3, 'turks-caicos': 3.0, jordan: 3.3, 'charleston-savannah': 3.3, swissalps: 3.3, cornwall: 3.3,
  acadia: 3.2, dolomites: 3.2, angkor: 3.2, morocco: 3.2, 'texas-hill-country': 3.2, 'chilean-lake-district': 3.2,
  egypt: 3.1, 'lake-district': 3.1, mendoza: 3.1,
  snowdonia: 3.0, 'colombian-caribbean': 3.0, aruba: 3.0, sardinia: 3.0, algarve: 3.0, queenstown: 3.0, 'st-andrews-fife': 3.0,
  'bavaria-munich': 2.9, jamaica: 2.9,
  sedona: 2.8, 'black-forest': 2.8, 'guilin-yangshuo': 2.8, hongkong: 2.8, 'hudson-valley': 2.8,
  sicily: 2.7, 'basque-country': 2.6, edinburgh: 2.6, tuscany: 2.6, havana: 2.5,
  // old 2
  madeira: 2.7, andalucia: 2.6, 'arches-canyonlands': 2.6, 'joshua-tree': 2.5, 'quebec-city': 2.4, 'death-valley': 2.4,
  croatia: 2.4, fiji: 2.1, mallorca: 2.3, belfast: 2.2, 'belfast-giants-causeway': 2.2, 'tokyo-kyoto': 2.2,
  'nice-riviera': 2.2, buenosaires: 2.2, cotswolds: 2.1, mexicocity: 2.0, nyc: 2.0, copenhagen: 2.0, seoul: 2.0,
  lisbon: 2.0, oaxaca: 2.0, rioja: 1.9, beijing: 1.9, berlin: 1.9, 'douro-valley-porto': 1.9, piedmont: 1.9,
  napa: 1.9, puglia: 1.9, london: 1.8, 'san-miguel-guanajuato': 1.8, istanbul: 1.8, amalfi: 1.8, bordeaux: 1.8,
  santorini: 1.8, bagan: 1.8, athens: 1.7, bangkok: 1.7, uzbekistan: 1.7,
  // old 1
  chicago: 1.2, dubai: 1.2, venice: 1.1, vienna: 1.1, champagne: 1.0, barcelona: 1.0, paris: 0.9, prague: 0.9,
  budapest: 0.9, amsterdam: 0.9, rome: 0.8,
};

// Antarctica: hard 10 season + 7 closed months, left as authored.
runDecimalize({ key: 'wildlifeViewing', caliber, tens, custom, text, set, flat, skip: ['antarctica'] });
