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
const onMonth = (column: string): AnswerRule => all({ type: 'month', column, on: true });
const BLOOM_TIMING = ['dependable', 'shifts', 'rainDependent', 'rare'];
const BLOOM_CROWDS = ['quiet', 'beatable', 'festival'];
const GROUND = ['flat', 'climb', 'rough'];
const ILLNESS_RISK = ['low', 'some', 'high'];
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

  // ---- Sunbathing ---- (25 Oct 2026; question 1, how hot, waits on a source for properly hot months)
  'sunbathing.q2': R(onMonth('dryMonths'), all({ type: 'month', column: 'wetMonths', on: false }), null),
  'sunbathing.q3': R(atLeast(7, 'calmShores'), atLeast(4, 'calmShores'), null),
  'sunbathing.q4': R(null, has('serviceLevel', 'snack', 'table'), has('serviceLevel', 'table')),

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
  'surfing.q1': 'Not suited to your level',
  'surfing.q2': 'Waves peel the other way',
  'surfing.q3': 'Heavier local scene',
  'surfing.q4': 'Colder water',
  'surfing.q5': 'Shallow reef and rocks',
};
