import type { AnswerRule, FitCheck, QuestionFitRule } from './question-fit';

/**
 * Which columns answer each onboarding question, for the seven interests that already have data (hiking, birding, safari, wildlife viewing,
 * diving, whale watching, surfing). Drafted 21 Oct 2026 for the owner's review; see question-fit.ts for what each check means.
 *
 * Keyed "interestKey.questionKey". `answers` follows the order of the question's options in the admin. Questions with no rule yet are
 * listed in QUESTIONS_WAITING_ON_COLUMNS with the reason.
 */

const R = (...answers: Array<AnswerRule | null>): QuestionFitRule => ({ answers });
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
const MALARIA = ['none', 'low', 'seasonal', 'high'];
const CROWDING = ['low', 'medium', 'high'];
const CERTIFICATION = ['none', 'openWater', 'advanced', 'specialty'];
const CURRENT = ['none', 'mild', 'moderate', 'strong'];
const LOCALISM = ['welcoming', 'mixed', 'protective', 'hostile'];
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
  'safari.q3': R(within('malaria', MALARIA, 'low'), within('malaria', MALARIA, 'seasonal'), null),
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
  'safari.q3': 'Malaria risk',
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
  'surfing.q1': 'Not suited to your level',
  'surfing.q2': 'Waves peel the other way',
  'surfing.q3': 'Heavier local scene',
  'surfing.q4': 'Colder water',
  'surfing.q5': 'Shallow reef and rocks',
};
