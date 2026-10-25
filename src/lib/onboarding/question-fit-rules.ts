import type { AnswerRule, FitCheck, QuestionFitRule } from './question-fit';

/**
 * Which columns answer each onboarding question, for the eight interests that already have data (hiking, birding, safari, wildlife viewing,
 * diving, whale watching, surfing, beaches & swimming). Drafted 21 Oct 2026 for the owner's review; see question-fit.ts for what each check means.
 *
 * Keyed "interestKey.questionKey". `answers` follows the order of the question's options in the admin. Questions with no rule yet are
 * listed in QUESTIONS_WAITING_ON_COLUMNS with the reason.
 */

const R = (...answers: Array<AnswerRule | null>): QuestionFitRule => ({ answers });
/** Match-only: a place without the stay is never marked down, it just does not get the green match. */
const B = (...answers: Array<AnswerRule | null>): QuestionFitRule => ({ answers, bonusOnly: true });
const all = (...checks: FitCheck[]): AnswerRule => ({ mode: 'all', checks });
const any = (...checks: FitCheck[]): AnswerRule => ({ mode: 'any', checks });
const within = (column: string, order: string[], allowed: string): AnswerRule => all({ type: 'within', column, order, allowed });
const has = (column: string, ...options: string[]): AnswerRule => all({ type: 'has', column, options });
const atLeast = (value: number, ...columns: string[]): AnswerRule => all({ type: 'atLeast', columns, value });
const animal = (column: string, ...names: string[]): AnswerRule => all({ type: 'named', column, names });
const atMost = (value: number, column: string): AnswerRule => all({ type: 'atMost', column, value });
/** The same checks as a bare FitCheck, for rules that combine them with all() or any(). */
const kHas = (column: string, ...options: string[]): FitCheck => ({ type: 'has', column, options });
const kAtLeast = (value: number, ...columns: string[]): FitCheck => ({ type: 'atLeast', columns, value });

const ALTITUDE = ['low', 'moderate', 'high', 'veryHigh'];
const BOOKING = ['none', 'weeks', 'months'];
const GUIDE = ['Not needed', 'Helpful', 'Recommended', 'Essential'];
const BIRD_ACCESS = ['Easy', 'Moderate', 'Challenging'];
const CONFIDENCE = ['high', 'medium', 'low'];
const CROWDING = ['low', 'medium', 'high'];
const CERTIFICATION = ['none', 'openWater', 'advanced', 'specialty'];
const CURRENT = ['none', 'mild', 'moderate', 'strong'];
const GUIDE_RULES = ['free', 'partly', 'always'];
const GEAR_RENTAL = ['plentiful', 'some', 'few'];
const LOCALISM = ['welcoming', 'mixed', 'protective', 'hostile'];
const range = (column: string, o: { zeroBelow?: number; fullFrom?: number; fullTo?: number; zeroAbove?: number; monthly?: boolean }): AnswerRule => all({ type: 'range', column, ...o });
const onMonth = (column: string): AnswerRule => all({ type: 'month', column, on: true });
const BLOOM_TIMING = ['dependable', 'shifts', 'rainDependent', 'rare'];
const BLOOM_CROWDS = ['quiet', 'beatable', 'festival'];
const GETTING_AROUND = ['walk', 'transit', 'car'];
const SITE_RULES = ['open', 'modest', 'strict'];
const NIGHT = ['warm', 'cool', 'cold'];
const STANDARDS = ['regulated', 'mixed', 'basic'];
const GROUND = ['flat', 'climb', 'rough'];
const ILLNESS_RISK = ['low', 'some', 'high'];
const LATE_NIGHTS = ['allNight', 'late', 'early'];
const DRESS_CODE = ['casual', 'smart', 'strict'];
const HAGGLING = ['fixed', 'some', 'expected'];
const GEAR_RULES_ORDER = ['none', 'some', 'many'];
const WHALE_COLUMNS = ['humpback', 'sperm', 'minke', 'orca', 'blue', 'fin', 'gray', 'right', 'dolphins'];

export const QUESTION_FIT_RULES: Record<string, QuestionFitRule> = {
  // ---- Hiking ----
  'hiking.q2': R(all({ type: 'count', column: 'crowdIndicators', atMost: 1 }), all({ type: 'count', column: 'crowdIndicators', atMost: 3 }), null, null),
  'hiking.q3': R(within('altitude', ALTITUDE, 'low'), within('altitude', ALTITUDE, 'moderate'), within('altitude', ALTITUDE, 'high'), null),
  'hiking.q4': R(within('bookingAhead', BOOKING, 'none'), within('bookingAhead', BOOKING, 'weeks'), null),

  // ---- Birding ----
  'birding.q2': R(within('guide', GUIDE, 'Helpful'), within('guide', GUIDE, 'Recommended'), null),
  'birding.q3': R(within('access', BIRD_ACCESS, 'Easy'), within('access', BIRD_ACCESS, 'Moderate'), null),
  'birding.q4': R(within('drawConfidence', CONFIDENCE, 'high'), null, null),

  // ---- Safari ----
  // Owner, 21 Oct 2026: wild dog counts as a full match at "possible" or better (they are rare everywhere); the other animals need "likely".
  'safari.q1': R(atLeast(8, 'leopard'), atLeast(8, 'lion'), atLeast(8, 'cheetah'), atLeast(8, 'elephant'), atLeast(8, 'rhino'), atLeast(5, 'wildDog'), atLeast(8, 'tiger')),
  'safari.q2': R(within('crowding', CROWDING, 'low'), within('crowding', CROWDING, 'medium'), null),
  // Owner, 21 Oct 2026: even where you can drive in, you can usually fly in, so the fly-in wish is not checked (no column says which places have bush planes or lodge airstrips).
  'safari.q4': R(has('access', 'road', 'mixed'), null, null),
  'safari.q5': R(null, any({ type: 'has', column: 'nightDrives', options: ['yes'] }, { type: 'has', column: 'offRoad', options: ['yes'] }), all({ type: 'has', column: 'nightDrives', options: ['yes'] }, { type: 'has', column: 'offRoad', options: ['yes'] })),

  // ---- Wildlife viewing ----
  'wildlifeViewing.q1': R(has('howWatch', 'vehicle'), has('howWatch', 'onFoot'), has('howWatch', 'boat'), has('howWatch', 'hide'), has('howWatch', 'water')),
  'wildlifeViewing.q2': R(atLeast(4, 'density'), null, null),
  'wildlifeViewing.q3': R(atLeast(6, 'spectacle'), null, atLeast(6, 'closeUp')),

  // ---- Diving ----
  'diving.q1': R(atLeast(5, 'snorkelingRating'), within('certification', CERTIFICATION, 'openWater'), within('certification', CERTIFICATION, 'advanced'), null),
  'diving.q2': R(within('current', CURRENT, 'none'), within('current', CURRENT, 'moderate'), null),
  'diving.q3': R(all({ type: 'warmest', column: 'waterTemp', minF: 78 }), all({ type: 'warmest', column: 'waterTemp', minF: 68 }), all({ type: 'warmest', column: 'waterTemp', minF: 55 }), null),
  'diving.q4': R(has('accessStyle', 'shore'), has('accessStyle', 'dayBoat'), has('accessStyle', 'liveaboard')),
  'diving.q5': R(animal('animals', 'manta'), animal('animals', 'whale shark'), animal('animals', 'hammerhead'), animal('animals', 'turtle'), animal('animals', 'seahorse', 'pygmy', 'nudibranch', 'frogfish', 'macro'), animal('animals', 'reef shark')),

  // ---- Whale watching ----
  'whaleWatching.q1': R(null, all({ type: 'atMost', column: 'seasick', value: 5 }), all({ type: 'atMost', column: 'seasick', value: 3 })),
  'whaleWatching.q2': R(has('boatStyle', 'inflatable'), has('boatStyle', 'midsize'), has('boatStyle', 'large'), has('boatStyle', 'sailing')),
  'whaleWatching.q3': R(atLeast(10, ...WHALE_COLUMNS), atLeast(8, ...WHALE_COLUMNS), null),
  'whaleWatching.q4': R(all({ type: 'has', column: 'swimAllowed', options: ['true'] }), null, null),

  // ---- Beaches & Swimming ---- (columns and thresholds approved 22 Oct 2026)
  'beachesSwimming.q1': R(all({ type: 'warmest', column: 'seaTempF', minF: 82 }), all({ type: 'warmest', column: 'seaTempF', minF: 75 }), null, null),
  'beachesSwimming.q2': R(has('beachAccess', 'door'), has('beachAccess', 'door', 'short'), null),
  'beachesSwimming.q3': R(atLeast(8, 'calmWater'), atLeast(6, 'calmWater'), atLeast(4, 'calmWater'), null),
  'beachesSwimming.q4': R(has('beachAccess', 'door', 'short'), any({ type: 'has', column: 'beachAccess', options: ['trip'] }, { type: 'atLeast', columns: ['remoteBeaches'], value: 7 }), null),

  // ---- Mountaineering & Rock Climbing ---- (columns approved 22 Oct 2026; Always guided and Guided for the hard parts ask for nothing)
  'mountaineering.q1': R(has('climbingLevels', 'beginner'), has('climbingLevels', 'beginner'), has('climbingLevels', 'intermediate'), has('climbingLevels', 'advanced')),
  'mountaineering.q2': R(null, null, within('guideRules', GUIDE_RULES, 'free')),
  'mountaineering.q3': R(has('routeCommitment', 'single'), has('routeCommitment', 'multi'), has('routeCommitment', 'alpine'), has('routeCommitment', 'expedition')),
  'mountaineering.q4': R(within('gearRental', GEAR_RENTAL, 'some'), null, null),

  // ---- Wind sports ---- (columns approved 22 Oct 2026; Everything and Bring my own / No preference ask for nothing)
  'windSports.q1': R(has('waterType', 'flat'), has('waterType', 'chop', 'flat'), has('waterType', 'waves'), null),
  'windSports.q2': R(has('levelsServed', 'beginner'), has('levelsServed', 'intermediate'), has('levelsServed', 'advanced')),
  'windSports.q3': R(has('windStrength', 'light'), has('windStrength', 'medium'), has('windStrength', 'strong')),
  'windSports.q4': R(within('gearRental', GEAR_RENTAL, 'some'), null, null),

  // ---- Blooms and Fall Colors ---- (columns approved 23 Oct 2026; Gamble on a rare event and The crowd is part of the fun ask for nothing)
  'wildflowerBlooms.q1': R(within('timingReliability', BLOOM_TIMING, 'dependable'), within('timingReliability', BLOOM_TIMING, 'shifts'), null),
  'wildflowerBlooms.q2': R(has('howSeen', 'road'), has('howSeen', 'easy'), has('howSeen', 'hike')),
  'wildflowerBlooms.q3': R(null, within('bloomCrowds', BLOOM_CROWDS, 'beatable'), within('bloomCrowds', BLOOM_CROWDS, 'quiet')),

  // ---- Hot Springs ---- (plan approved 23 Oct 2026; Fine with nude gendered baths, Year-round ask for nothing; the two month answers need the month the traveler is going)
  'hotSprings.q1': R(has('bathingStyles', 'swimsuit'), null, has('bathingStyles', 'private')),
  'hotSprings.q2': R(onMonth('coldMonths'), null, onMonth('coolMonths')),
  'hotSprings.q3': R(has('waterHeat', 'gentle'), has('waterHeat', 'hot'), has('waterHeat', 'veryHot')),

  // ---- Northern Lights / Aurora ---- (plan approved 23 Oct 2026; Properly cold is fine and Two weeks ask for nothing; the mild-winter answer needs the month the traveler is going)
  'auroraChasing.q1': R(all({ type: 'month', column: 'coldMonths', on: false }), null),
  'auroraChasing.q2': R(has('howSeen', 'tour'), has('howSeen', 'car'), has('howSeen', 'lodge')),
  'auroraChasing.q3': R(atLeast(9, 'auroraStrength'), atLeast(7, 'auroraStrength'), atLeast(5, 'auroraStrength'), null),

  // ---- Scenic Landscapes ---- (plan approved 23 Oct 2026; I want THE spot ... is iconic 7+, A bit of both asks nothing; question 4 (gear) has no place column, so it is asked but changes nothing)
  'scenicLandscapes.q1': R(has('viewAccess', 'roadside'), has('viewAccess', 'short'), has('viewAccess', 'halfDay', 'longHike', 'backcountry'), has('viewAccess', 'airBoat')),
  'scenicLandscapes.q2': R(atLeast(7, 'iconicRating'), atLeast(6, 'hiddenGemsRating'), null),
  'scenicLandscapes.q3': R(has('viewAccess', 'roadside', 'short'), has('viewAccess', 'halfDay'), has('viewAccess', 'longHike'), has('viewAccess', 'backcountry')),
  // 25 Oct 2026: gear. A phone and one lens meet no rules anywhere; a tripod kit is held back where tripods or drones are restricted, and several cameras where drones are restricted at all.
  'scenicLandscapes.q4': R(null, null, within('gearRules', GEAR_RULES_ORDER, 'some'), within('gearRules', GEAR_RULES_ORDER, 'none')),

  // ---- Street Food & Markets ---- (24 Oct 2026; plan approved 23 Oct with Hygiene renamed Illness risk)
  'streetFood.q1': R(has('foodAdventure', 'familiar', 'mixed'), null, null),
  'streetFood.q2': R(within('illnessRisk', ILLNESS_RISK, 'low'), within('illnessRisk', ILLNESS_RISK, 'some'), null),
  'streetFood.q3': R(has('eatingStyle', 'standing'), has('eatingStyle', 'stools', 'table'), has('eatingStyle', 'table')),
  'streetFood.q4': R(null, atLeast(5, 'streetStalls'), atLeast(8, 'streetStalls')),

  // ---- Luxury Hotels ---- (24 Oct 2026; the dream-stay answer only adds a match, owner's decision of 23 Oct)
  'luxuryHotels.q1': R(null, has('privateVillas', 'plentiful', 'some'), null),
  'luxuryHotels.q2': R(atLeast(7, 'hotelIsDestination'), atLeast(4, 'hotelIsDestination'), null),
  'luxuryHotels.q3': B(has('stayTypes', 'penthouse'), has('stayTypes', 'villaPool'), has('stayTypes', 'castleSuite'), has('stayTypes', 'overwater')),

  // ---- Cycling - Road & Gravel ---- (24 Oct 2026; traffic reads the quiet scenic rating, owner approved 23 Oct)
  'cyclingRoad.q1': R(has('rideLevels', 'easy'), has('rideLevels', 'moderate'), has('rideLevels', 'strong'), has('rideLevels', 'racer')),
  'cyclingRoad.q2': R(within('roadBikeRental', GEAR_RENTAL, 'some'), null, has('eBikeRental', 'true')),
  'cyclingRoad.q3': R(atLeast(7, 'quietScenic'), atLeast(4, 'quietScenic'), null),
  'cyclingRoad.q4': R(has('touringSupport', 'guided'), has('touringSupport', 'luggage'), has('touringSupport', 'selfSupported')),

  // ---- History & Archaeology ---- (25 Oct 2026; plan approved 25 Oct: sites in place read the best of the four site ratings)
  'historyArchaeology.q1': R(null, has('interpretation', 'audio'), has('interpretation', 'local'), has('interpretation', 'expert')),
  'historyArchaeology.q2': R(atLeast(7, 'ancientRuins', 'warHistory', 'prehistoricSites', 'castles'), atLeast(7, 'archaeologyMuseums'), null),
  'historyArchaeology.q3': R(within('roughestGround', GROUND, 'flat'), within('roughestGround', GROUND, 'climb'), null),
  'historyArchaeology.q4': R(null, atLeast(5, 'historyDensity'), atLeast(8, 'historyDensity')),

  // ---- Sunbathing ---- (25 Oct 2026; question 1 reads twelve afternoon highs and the month chosen)
  'sunbathing.q1': R(range('afternoonHighsF', { fullTo: 82, zeroAbove: 92, monthly: true }), range('afternoonHighsF', { zeroBelow: 72, fullFrom: 82, monthly: true }), null),
  'sunbathing.q2': R(onMonth('dryMonths'), all({ type: 'month', column: 'wetMonths', on: false }), null),
  'sunbathing.q3': R(atLeast(7, 'calmShores'), atLeast(4, 'calmShores'), null),
  'sunbathing.q4': R(null, has('serviceLevel', 'snack', 'table'), has('serviceLevel', 'table')),

  // ---- Architecture ---- (25 Oct 2026; private building tours read Buildings you can go inside at 8 or more)
  'architecture.q1': R(atLeast(7, 'historicArchitecture'), null, atLeast(7, 'modernArchitecture')),
  'architecture.q2': R(atLeast(7, 'grandMonuments'), atLeast(7, 'everydayStreets'), null),
  'architecture.q3': R(null, atLeast(6, 'buildingsInside'), atLeast(8, 'buildingsInside')),

  // ---- City Exploration ---- (25 Oct 2026; city size is a population number with soft edges)
  'cityExploration.q1': R(has('gettingAround', 'walk'), within('gettingAround', GETTING_AROUND, 'transit'), null),
  'cityExploration.q2': R(atLeast(7, 'famousSights'), atLeast(6, 'offTheBeatenPath', 'marketsStreetLife'), has('guidedWalks', 'true')),
  'cityExploration.q3': R(range('cityPopulation', { zeroBelow: 1000, fullFrom: 5000 }), range('cityPopulation', { zeroBelow: 50, fullFrom: 300, fullTo: 5000, zeroAbove: 15000 }), range('cityPopulation', { fullTo: 250, zeroAbove: 1000 })),
  'cityExploration.q4': R(null, has('daysItCanFill', '4to5', 'week', 'longer'), has('daysItCanFill', 'week', 'longer'), has('daysItCanFill', 'longer')),

  // ---- Museums & Art ---- (25 Oct 2026; the first three answers read the biggest museum in hours)
  'museumsArt.q1': R(null, range('biggestMuseumHours', { zeroBelow: 1, fullFrom: 3 }), range('biggestMuseumHours', { zeroBelow: 2, fullFrom: 6 }), atLeast(8, 'daysOfMuseums')),
  'museumsArt.q2': R(atLeast(7, 'famousMuseums'), atLeast(7, 'quirkyMuseums'), null),
  'museumsArt.q3': R(null, has('timedEntry', 'widely', 'some'), has('timedEntry', 'widely')),

  // ---- Skiing & Snowboarding ---- (25 Oct 2026)
  'skiingSnowboarding.q1': R(atLeast(6, 'beginnerFriendly'), atLeast(5, 'downhillResort'), atLeast(7, 'advancedTerrain')),
  'skiingSnowboarding.q2': R(null, atLeast(4, 'apres'), atLeast(7, 'apres')),
  'skiingSnowboarding.q3': R(null, atLeast(5, 'snowboardParks'), null),

  // ---- Religious & Spiritual Sites ---- (25 Oct 2026)
  'religiousSites.q1': R(null, within('siteRules', SITE_RULES, 'modest'), within('siteRules', SITE_RULES, 'open')),
  'religiousSites.q2': R(null, atLeast(5, 'religiousDensity'), atLeast(8, 'religiousDensity')),
  'religiousSites.q3': R(null, null, has('templeStays', 'true')),

  // ---- Spa & Wellness ---- (25 Oct 2026; thermal baths are built bathing culture, natural pools are Hot Springs)
  'spaWellness.q1': R(atLeast(7, 'daySpas'), atLeast(6, 'thermalBaths'), atLeast(6, 'clinicalWellness')),
  'spaWellness.q2': R(has('bathingCustoms', 'swimwear'), null, has('bathingCustoms', 'private')),
  'spaWellness.q3': R(null, atLeast(6, 'daySpas', 'thermalBaths'), atLeast(7, 'wellnessResorts')),

  // ---- Stargazing ---- (25 Oct 2026; question 3, the moon, waits for the moon calculator)
  'stargazing.q1': R(range('bortle', { fullTo: 6, zeroAbove: 8 }), range('bortle', { fullTo: 4, zeroAbove: 7 }), range('bortle', { fullTo: 2, zeroAbove: 5 })),
  'stargazing.q2': R(has('nightConditions', 'warm'), within('nightConditions', NIGHT, 'cool'), null),

  // ---- Adventure Sports ---- (25 Oct 2026)
  'adventureSports.q1': R(has('operatorStandards', 'regulated'), within('operatorStandards', STANDARDS, 'mixed'), null),
  'adventureSports.q2': R(has('effortLevels', 'easy'), has('effortLevels', 'easy', 'stamina'), null),
  'adventureSports.q3': R(has('privateTrips', 'true'), null, null),

  // ---- The seven interests finished on 25 Oct 2026 (each answer reads the new columns; blank cells ask for nothing) ----
  'fineDining.q1': R(null, atLeast(5, 'tastingMenus'), atLeast(8, 'tastingMenus')),
  'fineDining.q2': R(within('bookingAhead', BOOKING, 'none'), within('bookingAhead', BOOKING, 'weeks'), null),
  'fineDining.q3': R(range('tastingMenuPrice', { fullTo: 100, zeroAbove: 200 }), range('tastingMenuPrice', { fullTo: 200, zeroAbove: 350 }), null),
  'coffeeTea.q1': R(null, any(kAtLeast(6, 'specialtyCafes'), kHas('coffeeFarms', 'true'), kHas('teaPlantations', 'true')), any(kHas('coffeeFarms', 'true'), kHas('teaPlantations', 'true'))),
  'coffeeTea.q2': R(has('cafeStyles', 'linger'), has('cafeStyles', 'quick'), null),
  'coffeeTea.q3': R(all(kAtLeast(3, 'teaCeremonies'), kHas('ceremonyStyles', 'formal')), all(kAtLeast(3, 'teaCeremonies'), kHas('ceremonyStyles', 'relaxed')), all(kAtLeast(3, 'teaCeremonies'), kHas('ceremonyStyles', 'demonstration'))),
  'nightlife.q1': R(null, null, within('lateNights', LATE_NIGHTS, 'late'), within('lateNights', LATE_NIGHTS, 'allNight')),
  'nightlife.q2': R(within('dressCode', DRESS_CODE, 'casual'), within('dressCode', DRESS_CODE, 'smart'), null),
  'nightlife.q3': R(atLeast(6, 'quietBars'), atLeast(5, 'cocktailBars', 'liveMusic'), atLeast(7, 'clubs')),
  'shopping.q1': R(null, null, within('haggling', HAGGLING, 'fixed')),
  'shopping.q2': R(atLeast(6, 'crowdedBazaars'), null, atMost(4, 'crowdedBazaars')),
  'shopping.q3': R(atLeast(7, 'authenticLocalGoods'), null, any(kAtLeast(4, 'luxuryShopping'), kHas('outletsBargains', 'true'))),
  'traditionalCrafts.q1': R(null, all(kHas('craftWorkshops', 'true'), kHas('courseLengths', 'short', 'multiDay', 'apprenticeship')), all(kHas('craftWorkshops', 'true'), kHas('courseLengths', 'multiDay', 'apprenticeship')), all(kHas('craftWorkshops', 'true'), kHas('courseLengths', 'apprenticeship'))),
  'traditionalCrafts.q2': R(has('craftSettings', 'village'), has('craftSettings', 'studios'), has('craftSettings', 'markets'), has('craftSettings', 'museums')),
  'traditionalCrafts.q3': R(null, null, atLeast(6, 'seriousPieces')),
  'festivals.q1': R(has('festivalScales', 'small'), has('festivalScales', 'mid'), has('festivalScales', 'huge')),
  'festivals.q2': R(within('ticketAvailability', BOOKING, 'none'), within('ticketAvailability', BOOKING, 'weeks'), null),

  // ---- Theme Parks & Attractions ---- (25 Oct 2026; Gentle rides only asks for nothing, the other two read the thrill rating)
  'themeParks.q1': R(null, range('daysOfParks', { zeroBelow: 1, fullFrom: 2 }), range('daysOfParks', { zeroBelow: 1, fullFrom: 3 })),
  'themeParks.q2': R(has('parkHotels', 'onsite'), has('parkHotels', 'onsite', 'nearby'), null),
  'themeParks.q3': R(null, atLeast(4, 'thrillRides'), atLeast(8, 'thrillRides')),

  // ---- Surfing ----
  'surfing.q1': R(atLeast(6, 'beginnerRating'), atLeast(5, 'beginnerRating'), null, atLeast(5, 'advancedRating'), atLeast(7, 'advancedRating')),
  'surfing.q2': R(has('waveDirection', 'lefts', 'both'), has('waveDirection', 'rights', 'both'), null),
  'surfing.q3': R(within('localism', LOCALISM, 'welcoming'), within('localism', LOCALISM, 'mixed'), null),
  'surfing.q4': R(all({ type: 'warmest', column: 'waterTemp', minF: 75 }), all({ type: 'warmest', column: 'waterTemp', minF: 65 }), all({ type: 'warmest', column: 'waterTemp', minF: 55 }), null),
  'surfing.q5': R(has('waveType', 'beach', 'rivermouth'), null, null),
};

/** The text of the reason chip when a question knocks a place down (interest_questions.miss_message). Proposed; the owner edits these in the admin. */
export const PROPOSED_MISS_MESSAGES: Record<string, string> = {
  'hiking.q2': 'Busier than you like',
  'hiking.q3': 'Higher than you like',
  'hiking.q4': 'Needs booking ahead',
  'birding.q2': 'Needs a guide',
  'birding.q3': 'More walking than you want',
  'birding.q4': 'Birds not reliable',
  'safari.q1': 'Less likely to see your animal',
  'safari.q2': 'More vehicles around',
  'safari.q4': 'Different way into camp',
  'safari.q5': 'No night drives or off-road',
  'wildlifeViewing.q1': 'Not the way you like to watch',
  'wildlifeViewing.q2': 'Less abundant',
  'wildlifeViewing.q3': 'Not the style of encounter you like',
  'diving.q1': 'Needs more certification',
  'diving.q2': 'Stronger current',
  'diving.q3': 'Colder water',
  'diving.q4': 'Not your kind of diving',
  'diving.q5': 'Not known for your animal',
  'whaleWatching.q1': 'Rougher seas',
  'whaleWatching.q2': 'Not your kind of boat',
  'whaleWatching.q3': 'Sightings less certain',
  'whaleWatching.q4': 'No swimming with whales',
  'windSports.q1': 'Not the water you want',
  'windSports.q2': 'Not suited to your level',
  'windSports.q3': 'Not the wind you want',
  'windSports.q4': 'Little gear to rent',
  'mountaineering.q1': 'Not suited to your level',
  'mountaineering.q2': 'Needs a guide',
  'mountaineering.q3': 'Not the size of climb you want',
  'mountaineering.q4': 'Little gear to rent',
  'beachesSwimming.q1': 'Colder water',
  'beachesSwimming.q2': 'Farther from where you stay',
  'beachesSwimming.q3': 'Rougher water',
  'beachesSwimming.q4': 'Not the beach access you like',
  'wildflowerBlooms.q1': 'Timing less certain',
  'wildflowerBlooms.q2': 'Not the way you want to see it',
  'wildflowerBlooms.q3': 'Busier than you like',
  'hotSprings.q1': 'Not the bathing you want',
  'hotSprings.q2': 'Not the weather you want',
  'hotSprings.q3': 'Not the water heat you want',
  'auroraChasing.q1': 'Colder than you want',
  'auroraChasing.q2': 'Not the way you want to see it',
  'auroraChasing.q3': 'Needs more nights',
  'scenicLandscapes.q1': 'Not the way you want to see it',
  'scenicLandscapes.q2': 'Not the kind of view you want',
  'scenicLandscapes.q3': 'More effort than you want',
  'streetFood.q1': 'More adventurous than you want',
  'streetFood.q2': 'Higher illness risk than you want',
  'streetFood.q3': 'Not how you like to eat',
  'streetFood.q4': 'Less street food than you want',
  'luxuryHotels.q1': 'Few private villas',
  'luxuryHotels.q2': 'Not a hotel-led trip',
  'luxuryHotels.q3': 'Not the stay you dream of',
  'cyclingRoad.q1': 'Not the rides you want',
  'cyclingRoad.q2': 'Hard to rent the bike you want',
  'cyclingRoad.q3': 'Busier roads than you want',
  'cyclingRoad.q4': 'Not the support you want',
  'historyArchaeology.q1': 'Not explained the way you want',
  'historyArchaeology.q2': 'Not the kind of history you want',
  'historyArchaeology.q3': 'Rougher ground than you want',
  'historyArchaeology.q4': 'Fewer sites close together',
  'sunbathing.q2': 'Wetter than you want',
  'sunbathing.q3': 'Windier than you want',
  'sunbathing.q4': 'Less service than you want',
  'architecture.q1': 'Not the era you want',
  'architecture.q2': 'Not the kind of sights you want',
  'architecture.q3': 'Less access inside',
  'cityExploration.q1': 'Less walkable than you want',
  'cityExploration.q2': 'Not how you like to explore',
  'cityExploration.q3': 'Not the city size you want',
  'cityExploration.q4': 'Not enough to fill your days',
  'museumsArt.q1': 'Smaller museums than you want',
  'museumsArt.q2': 'Not the museum mix you want',
  'museumsArt.q3': 'Longer queues than you want',
  'skiingSnowboarding.q1': 'Not suited to your level',
  'skiingSnowboarding.q2': 'Less apres than you want',
  'skiingSnowboarding.q3': 'Fewer snowboard options',
  'sunbathing.q1': 'Not the heat you want',
  'religiousSites.q1': 'Stricter rules than you want',
  'religiousSites.q2': 'Fewer sites close together',
  'religiousSites.q3': 'No monastery stays',
  'spaWellness.q1': 'Not the kind of spa you want',
  'spaWellness.q2': 'Not your kind of bathing',
  'spaWellness.q3': 'Not enough for that long',
  'stargazing.q1': 'Brighter sky than you want',
  'stargazing.q2': 'Colder than you want',
  'adventureSports.q1': 'Less regulated than you want',
  'adventureSports.q2': 'Harder than you want',
  'adventureSports.q3': 'No private trips',
  'fineDining.q1': 'Not enough fine dining for that',
  'fineDining.q2': 'Needs booking ahead',
  'fineDining.q3': 'Pricier than you want',
  'coffeeTea.q1': 'Not much to taste or learn',
  'coffeeTea.q2': 'Not the café style you want',
  'coffeeTea.q3': 'Not the kind of ceremony you want',
  'nightlife.q1': 'Winds down earlier than you want',
  'nightlife.q2': 'Dressier than you want',
  'nightlife.q3': 'Not the crowd you want',
  'shopping.q1': 'Haggling is part of it',
  'shopping.q2': 'Not the bazaar crowd you want',
  'shopping.q3': 'Not the kind of goods you want',
  'traditionalCrafts.q1': 'No course that long',
  'traditionalCrafts.q2': 'Not where you want to find it',
  'traditionalCrafts.q3': 'Hard to ship home',
  'festivals.q1': 'Not the festival size you want',
  'festivals.q2': 'Needs booking ahead',
  'scenicLandscapes.q4': 'Camera gear rules may limit you',
  'themeParks.q1': 'Not enough parks for that long',
  'themeParks.q2': 'No hotel at the parks',
  'themeParks.q3': 'Fewer big rides than you want',
  'surfing.q1': 'Not suited to your level',
  'surfing.q2': 'Waves peel the other way',
  'surfing.q3': 'Heavier local scene',
  'surfing.q4': 'Colder water',
  'surfing.q5': 'Shallow reef and rocks',
};
