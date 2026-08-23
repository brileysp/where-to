/**
 * Best-effort emoji for a cost-item label, matched by keyword rather than
 * authored per item — keeps costItems (label/price/unit) free of a fourth
 * field to maintain. Ordered most-specific first so compound labels (e.g.
 * "Hot-air balloon safari") hit the more distinctive match before a
 * broader one later in the list. Unmatched labels (regional dish names
 * like "Rösti" have no reliable generic keyword) fall back to a generic
 * price tag rather than a guessed, possibly-wrong category icon.
 */
const FALLBACK_ICON = '🏷️';

const RULES: [string[], string][] = [
  [['eiffel tower'], '🗼'],
  [['louvre'], '🖼️'],
  [["doge's palace", 'doge palace'], '🏛️'],
  [['skytree', 'empire state', 'skypark', 'observation deck', 'observatory', 'viewing platform', 'burj khalifa'], '🏙️'],
  [['mule ride'], '🐴'],
  // "Peak Tram" before the generic tram rule below — it's a funicular, not
  // a street tram. "Gondola ride" (Venice's boat) must be checked before
  // the bare "gondola" catch-all right after — ski resorts (Banff, Queenstown)
  // name their aerial cable cars "___ Gondola" with no "ride" in the label.
  [['cable car', 'cableway', 'glacier paradise', 'aerial tram', 'peak tram'], '🚡'],
  [['gondola ride'], '🛶'],
  [['gondola'], '🚡'],
  [['catamaran', 'boat tour', 'cruise', 'expedition ship', 'cabin, peak season', 'premium ship', 'liveaboard', 'houseboat'], '⛵'],
  [['tented camp', 'luxury camp', 'ultra-luxury camp', 'lodge package', 'refugio', 'ger camp', 'yurt'], '🏕️'],
  [['rafting'], '🚣'],
  [['rock climbing', 'bouldering'], '🧗'],
  [['paragliding', 'paraglide'], '🪂'],
  [['vaporetto', 'water bus'], '⛴️'],
  [['speedboat', 'ferry', 'boat transfer'], '🚤'],
  // "charter flight" / "internal flight" / "Flight, " (capitalized, comma —
  // the scheduled-route label format), never bare "flight" — a wine
  // "tasting flight" is a flight of wines, not an airplane.
  [['charter flight', 'internal flight', 'charter plane', 'winnipeg–churchill'], '✈️'],
  [['train', 'railway', 'shinkansen'], '🚆'],
  [['songthaew', 'matatu', 'colectivo', 'trotro', 'tro-tro'], '🚌'],
  [['bus'], '🚌'],
  [['métro', 'metro', 'subway', 'skytrain', 'bts', 'mrt', 'mtr', 'underground', 'tube ticket', 'light rail', 'subte'], '🚇'],
  [['tram'], '🚋'],
  [['moto-taxi', 'moto taxi', 'motorbike'], '🛵'],
  [['boda-boda', 'boda boda', 'rickshaw', 'tuk-tuk', 'tuk tuk', 'auto-rickshaw', 'tricycle'], '🛺'],
  [['scooter'], '🛵'],
  [['taxi', 'uber', 'grab car', 'grab/taxi', 'grab ride'], '🚕'],
  // "Bike rental"/"Kayak rental" before the generic rental rule below — a
  // bicycle or a kayak getting a car icon would be a wrong-category guess.
  [['bike rental', 'bicycle'], '🚲'],
  [['kayak'], '🛶'],
  [['rental', 'driver', 'transfer'], '🚗'],
  [['cocktail', 'spritz', 'mojito'], '🍸'],
  [['juice', 'smoothie'], '🧃'],
  [['vermouth', 'wine', 'limoncello', 'champagne', 'cuvée', 'cuvee', 'mamajuana'], '🍷'],
  // Not bare "pint" — it's a substring of "pinto" (as in gallo pinto) and
  // "pintxos", and every real pint-of-beer label already contains "beer" or
  // "guinness" too, so it's a pure collision risk with nothing to lose.
  [['beer', 'guinness'], '🍺'],
  // Compound tea terms, not bare "tea" — a bare match risks false hits on
  // unrelated words that happen to contain the substring (e.g. "steak").
  [['turkish tea', 'çay', 'chai', 'milk tea', 'green tea', 'iced tea', 'mint tea', 'sweet tea', 'bubble tea'], '🍵'],
  // "Cannabis coffeeshop" before the plain coffee rule below — it contains
  // "coffee" as a substring but is a completely different purchase.
  [['cannabis coffeeshop', 'cannabis', 'nargile', 'hookah', 'shisha'], '🌿'],
  [['coffee', 'espresso', 'cafezinho', 'flat white', 'melange', 'cappuccino'], '☕'],
  [['myanmar tea'], '🍵'],
  [['whisky tasting', 'whiskey tasting', 'mezcal tasting'], '🥃'],
  [['spa', 'massage', 'treatment'], '💆'],
  [['balloon'], '🎈'],
  [['photography expedition', 'photography tour'], '📷'],
  [['birding', 'bird-watching', 'birdwatching'], '🦜'],
  [['gorilla'], '🦍'],
  [['chimpanzee', 'chimp tracking', 'lemur'], '🐒'],
  [['jaguar'], '🐆'],
  [['reindeer'], '🦌'],
  [['fishing'], '🎣'],
  [['husky', 'toboggan'], '🛷'],
  [['safari', 'game drive'], '🚙'],
  [['snorkel', 'diving', 'dive'], '🤿'],
  [['park entrance', 'park & conservancy', 'conservancy', 'conservation fee', 'entrance', 'entry', 'admission', 'ticket', 'pass', 'transit control card', 'transit card', 'surcharge', 'scout fee', 'permit'], '🎫'],
  [['picnic'], '🧺'],
  [['trek package', 'via ferrata', 'guided hike', 'guided alpine hike', 'volcano hike'], '🥾'],
  [['elephant'], '🐘'],
  [['truffle'], '🍄'],
  [['tour'], '🧭'],
  // Specific dishes before the generic "it's street food" catch-all below —
  // otherwise a label like "Pad thai from a street stall" hits the location
  // descriptor ("street stall") and never reaches the noodle keyword.
  [['pizza'], '🍕'],
  [['lobster'], '🦞'],
  [['flamenco'], '💃'],
  [['pretzel'], '🥨'],
  [['conch'], '🐚'],
  [['flying fish'], '🐟'],
  [['tamale'], '🫔'],
  [['pasty'], '🥧'],
  [['cream tea'], '🫖'],
  // Bare "pho" is handled separately below with a word-boundary check —
  // as a plain substring it would match inside "photography", "phone", etc.
  [['pad thai', 'ramen', 'noodle', 'laksa', 'soba'], '🍜'],
  [['stroopwafel', 'waffle'], '🧇'],
  [['hummus'], '🥙'],
  [['poutine', 'fries'], '🍟'],
  [['snack'], '🍿'],
  [['fried rice', 'rice bowl', 'koshari', 'rice', 'plov'], '🍚'],
  [['taco'], '🌮'],
  [['dim sum', 'empanada', 'dumpling', 'khinkali', 'momo', 'pierogi', 'gyoza', 'jiaozi'], '🥟'],
  [['falafel'], '🧆'],
  [['açaí', 'acai'], '🥣'],
  [['fish and chips', 'fish & chips', 'sardines', 'fish burger'], '🐟'],
  [['mussels'], '🦪'],
  [['orecchiette'], '🍝'],
  [['jerk chicken'], '🍗'],
  [['skewer'], '🍢'],
  [['chocolate'], '🍫'],
  [['hot dog', 'pylsur'], '🌭'],
  [['meat pie', 'pie'], '🥧'],
  [['sandwich', 'bocadillo', 'panino', 'smørrebrød'], '🥪'],
  [['wrap', 'enchilada'], '🌯'],
  [['curry', 'biryani'], '🍛'],
  // "pancake" before the bare "cake" catch-all — it contains "cake" as a
  // substring but is a completely different dish.
  [['pancake'], '🥞'],
  [['torte', 'cake', 'pastel de nata'], '🍰'],
  [['pastry'], '🥐'],
  [['salad'], '🥗'],
  [['braai', 'roast', 'ćevapi', 'cevapi', 'svíčková'], '🍖'],
  [['mofongo', 'matoke'], '🍽️'],
  [['bungy', 'bungee'], '🤸'],
  [['tee time', 'round of golf', 'golf round'], '⛳'],
  [['breakfast'], '🍳'],
  [['groceries'], '🛒'],
  [['stew', 'tapas', 'cicchetti', 'soup', 'feijoada', 'tagine', 'goulash', 'pepián', 'pepian'], '🍲'],
  [['dinner', 'lunch', 'meal'], '🍽️'],
  // Generic "it's a cooked, unspecified dish" catch-all — a pan of food
  // rather than a specific plate (taco, curry) so it doesn't imply one
  // cuisine over another. Covers both named-but-obscure dishes (Rösti) and
  // genuinely unspecified ones ("street-food mix").
  [['rösti', 'rosti', 'street-food', 'street food', 'street stall', 'street cart'], '🥘'],
];

// "pho" (the Vietnamese noodle soup) is too short to safely substring-match
// — it collides with "photography", "phone", "phở" transliterations, etc.
// Checked as a standalone word, ahead of the general RULES pass.
const PHO_WORD = /\bpho\b/i;

// A route-style label ("Flight, Bali–Labuan Bajo") always starts with this
// exact prefix — checking startsWith (not includes) keeps it from matching
// "Wine tasting flight, Luján de Cuyo", which contains "flight, " mid-string.
const FLIGHT_LABEL_PREFIX = 'flight, ';

export function costItemIcon(label: string): string {
  const lower = label.toLowerCase();
  if (PHO_WORD.test(lower)) return '🍜';
  if (lower.startsWith(FLIGHT_LABEL_PREFIX)) return '✈️';
  for (const [keywords, icon] of RULES) {
    if (keywords.some((k) => lower.includes(k))) return icon;
  }
  return FALLBACK_ICON;
}
