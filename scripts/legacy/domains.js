/* ---------------------------------------------------------------------
   Where To? — Special-interest domain registry
   -----------------------------------------------------------------
   This is the hierarchical interest model: a domain is a broad area
   (Birding, Surfing, Cycling, Landscape Photography, ...) that can have
   its own deeper "Level 2" card set, unlocked once the Travel DNA
   Builder sees real repeated signal in that area rather than one swipe.

   WHY A SEPARATE REGISTRY (not just a field on each card):
   Cards don't need to individually "know" every domain they might
   contribute to. A domain definition here declares how to RECOGNIZE
   signal for it (matchCategories / matchTags) and, optionally, its own
   deep card set (hasDeepCards + subdimensions + unlock thresholds +
   transition copy). That means:
     - Existing broad cards (e.g. the 5 original Birding cards) count
       toward a domain's signal automatically via category/tag matching,
       with zero changes to those card objects.
     - A brand new domain can be registered with just matchCategories/
       matchTags pointing at cards that already exist (see the "future
       domains" stubs below) — genuinely zero new app code.
     - A domain gets full Level 1 -> Level 2 depth only when someone
       deliberately builds out subdimensions + a deep card set + unlock
       rules for it, which is exactly the four domains implemented here.

   HOW TO ADD A NEW FULLY-DEEP DOMAIN LATER:
     1. Add an entry below with subdimensions, unlock thresholds, an emoji
        (used for the deep-dive-complete badge), and transitionCard copy
        (see BIRDING/SURFING/CYCLING/LANDSCAPE_PHOTO).
     2. Set hasDeepCards: true.
     3. Add `stage: 'deep', domain: '<Your Domain>', subdimensions: [...],
        unlockConditions: {...}, diagnosticPurpose: '...'` cards to
        cards.js (see the "deep" sections for the four existing domains).
     4. Add any new subdimension attribute names to PREFERENCE_ATTRIBUTES
        in traveldna.js so they're tracked in the profile from the start.
   No other file needs to change — chooseNextCard(), the unlock check,
   and the summary screen all read this registry generically.

   HOW TO ADD A LIGHTWEIGHT FUTURE DOMAIN (no deep cards yet):
     Just add an entry with hasDeepCards: false and matchCategories/
     matchTags pointing at whatever already exists. It'll show up in
     domain signal tracking and the summary's "strong domains" section
     immediately, with no card-writing required. See the stubs below.
--------------------------------------------------------------------- */

const DOMAIN_REGISTRY = {
  Birding: {
    key: 'Birding',
    label: 'Birding',
    emoji: '🐦',
    matchCategories: ['Birding'],
    matchTags: ['birding'],
    subdimensions: [
      'rareEndemics', 'photography', 'speciesCount', 'guidedBirding', 'independentBirding',
      'birdingFromHides', 'pelagicBirding', 'owling', 'migrationSpectacle', 'rainforestBirding',
      'wetlandsBirding', 'difficultTargetChasing', 'casualBirding', 'comfortSacrifice',
      'earlyMorningTolerance', 'patience', 'weatherTolerance', 'listing', 'viewQualityTolerance',
    ],
    unlock: { minPositive: 4, minLove: 2 },
    transitionCard: {
      title: 'Birding looks like more than a casual interest.',
      body: "Let's get specific.",
    },
    hasDeepCards: true,
  },
  Surfing: {
    key: 'Surfing',
    label: 'Surfing',
    emoji: '🏄',
    matchCategories: ['Surfing'],
    matchTags: ['surfing'],
    subdimensions: [
      'beginnerFriendly', 'reefBreaks', 'warmWater', 'uncrowded', 'surfCamp', 'luxurySurf',
      'longboarding', 'consistentSwell', 'surfPlusCulture', 'surfPlusNightlife', 'surfPlusWellness',
      'remoteSurf', 'travelForConditions', 'basicLodgingTolerance', 'familyFriendlySurf',
      'surfAsMainPurpose', 'surfAsSideActivity',
    ],
    unlock: { minPositive: 4, minLove: 2 },
    transitionCard: {
      title: 'Strong surf signal.',
      body: "Let's figure out what kind of surf trip you actually want.",
    },
    hasDeepCards: true,
  },
  Cycling: {
    key: 'Cycling',
    label: 'Cycling',
    emoji: '🚴',
    matchCategories: ['Cycling'],
    matchTags: ['cycling'],
    subdimensions: [
      'scenicRoadCycling', 'hardClimbing', 'fastDescents', 'gravelRiding', 'mountainBiking',
      'eBikeFriendly', 'bikeTouring', 'cafeToCafe', 'luxuryInnToInn', 'performanceFocus',
      'casualCycling', 'lowTrafficRoads', 'famousRoutes', 'remoteLandscapes',
      'supportVehiclePreference', 'cyclingAsMainPurpose', 'cyclingAsSideActivity',
      'longDayTolerance', 'nightComfort', 'comfortAfterEffort', 'innToInn',
    ],
    unlock: { minPositive: 4, minLove: 2 },
    transitionCard: {
      title: 'Cycling trips can mean very different things.',
      body: "Let's narrow down what you're after.",
    },
    hasDeepCards: true,
  },
  'Landscape Photography': {
    key: 'Landscape Photography',
    label: 'Landscape Photography',
    emoji: '📷',
    matchCategories: ['Photography'],
    matchTags: ['landscapePhotography'],
    subdimensions: [
      'goldenHour', 'earlyMorningTolerance', 'iconicLandscapes', 'obscureLandscapes', 'mountains',
      'deserts', 'coastlines', 'forests', 'waterfalls', 'astrophotography', 'dramaticWeather',
      'patience', 'gearHeavy', 'photoAsMainPurpose', 'photoAsSideActivity', 'hikingForTheShot',
      'roadTrip', 'droneFriendly', 'solitude', 'weatherTolerance', 'lateNightTolerance',
    ],
    unlock: { minPositive: 4, minLove: 2 },
    transitionCard: {
      title: 'Landscape photography looks like a real driver for you.',
      body: "Let's nail down what conditions matter most.",
    },
    hasDeepCards: true,
  },

  // ---- Future domains: lightweight stubs -----------------------------------
  // Registered now so signal tracking / the summary's domain list already
  // works for them, using categories or tags that already exist in
  // cards.js. No deep card sets yet — hasDeepCards stays false until
  // someone builds one out following the pattern above.
  Wildlife:              { key: 'Wildlife', matchCategories: ['Wildlife'], matchTags: ['wildlife'], subdimensions: [], hasDeepCards: false },
  'Wildlife Photography':{ key: 'Wildlife Photography', matchCategories: [], matchTags: ['wildlife', 'photography'], subdimensions: [], hasDeepCards: false },
  Fishing:               { key: 'Fishing', matchCategories: ['Fishing'], matchTags: ['fishing'], subdimensions: [], hasDeepCards: false },
  Golf:                  { key: 'Golf', matchCategories: ['Golf'], matchTags: ['golf'], subdimensions: [], hasDeepCards: false },
  Hiking:                { key: 'Hiking', matchCategories: ['Hiking'], matchTags: ['hiking'], subdimensions: [], hasDeepCards: false },
  Food:                  { key: 'Food', matchCategories: ['Food'], matchTags: ['food'], subdimensions: [], hasDeepCards: false },
  Wine:                  { key: 'Wine', matchCategories: ['Wine & Spirits'], matchTags: ['wine'], subdimensions: [], hasDeepCards: false },
  Culture:               { key: 'Culture', matchCategories: ['Culture'], matchTags: ['culture'], subdimensions: [], hasDeepCards: false },
  Cities:                { key: 'Cities', matchCategories: ['Cities'], matchTags: ['cities'], subdimensions: [], hasDeepCards: false },
  Beaches:               { key: 'Beaches', matchCategories: ['Beach'], matchTags: ['beach'], subdimensions: [], hasDeepCards: false },
  'Snorkeling & Diving':  { key: 'Snorkeling & Diving', matchCategories: ['Snorkeling & Diving'], matchTags: ['diving', 'snorkeling'], subdimensions: [], hasDeepCards: false },
  'Skiing & Snow':        { key: 'Skiing & Snow', matchCategories: ['Snow Sports'], matchTags: ['snowsports'], subdimensions: [], hasDeepCards: false },
  Wellness:              { key: 'Wellness', matchCategories: ['Wellness'], matchTags: ['wellness'], subdimensions: [], hasDeepCards: false },
  'Luxury Lodging':      { key: 'Luxury Lodging', matchCategories: ['Luxury Lodging'], matchTags: ['luxury'], subdimensions: [], hasDeepCards: false },
  'Remote Wilderness':   { key: 'Remote Wilderness', matchCategories: ['Remote Wilderness'], matchTags: ['remoteWilderness'], subdimensions: [], hasDeepCards: false },
  'Family Travel':       { key: 'Family Travel', matchCategories: ['Family'], matchTags: ['family'], subdimensions: [], hasDeepCards: false },
  Architecture:          { key: 'Architecture', matchCategories: [], matchTags: ['architecture'], subdimensions: [], hasDeepCards: false },
  'Art & Museums':       { key: 'Art & Museums', matchCategories: [], matchTags: ['museum'], subdimensions: [], hasDeepCards: false },
  History:               { key: 'History', matchCategories: [], matchTags: ['history', 'ancient'], subdimensions: [], hasDeepCards: false },
  'Desert Travel':       { key: 'Desert Travel', matchCategories: [], matchTags: ['desert'], subdimensions: [], hasDeepCards: false },
  'Mountain Travel':     { key: 'Mountain Travel', matchCategories: [], matchTags: ['mountains'], subdimensions: [], hasDeepCards: false },
  Safari:                { key: 'Safari', matchCategories: [], matchTags: ['safari'], subdimensions: [], hasDeepCards: false },
  Sailing:               { key: 'Sailing', matchCategories: ['Sailing & Yachting'], matchTags: ['sailing'], subdimensions: [], hasDeepCards: false },
  'Road Trips':          { key: 'Road Trips', matchCategories: [], matchTags: ['roadTrip'], subdimensions: [], hasDeepCards: false },
  'Festivals & Events':  { key: 'Festivals & Events', matchCategories: [], matchTags: ['festival'], subdimensions: [], hasDeepCards: false },
};

/**
 * Every domain a card contributes signal to — usually one, sometimes more
 * (a card can be tagged into several domains' matchTags at once). Checks
 * the card's own explicit `domain` field first (used by deep cards, which
 * always declare exactly which domain unlocked them), then falls back to
 * registry-driven category/tag matching so broad cards don't need to be
 * individually retrofitted for every domain that might care about them.
 */
function cardDomains(card) {
  const domains = new Set();
  if (card.domain) domains.add(card.domain);
  Object.values(DOMAIN_REGISTRY).forEach(def => {
    if (def.matchCategories && def.matchCategories.includes(card.category)) domains.add(def.key);
    if (def.matchTags && card.tags && def.matchTags.some(t => card.tags.includes(t))) domains.add(def.key);
  });
  return [...domains];
}

export { DOMAIN_REGISTRY, cardDomains };
