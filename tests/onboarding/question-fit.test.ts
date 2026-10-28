import { describe, expect, it } from 'vitest';
import { checkFit, lowestTempF, namedAnimalFit, questionFit, describeAnswerRule, type FitCheck } from '@/lib/onboarding/question-fit';
import { PROPOSED_MISS_MESSAGES, QUESTION_FIT_RULES } from '@/lib/onboarding/question-fit-rules';
import { factDefsFor } from '@/lib/admin/interest-pages/config';

const hiking = factDefsFor('hiking');
const fit = (c: FitCheck, facts: Record<string, any>, interest = 'hiking') => checkFit(c, factDefsFor(interest), facts);

describe('question fit checks', () => {
  const alt: FitCheck = { type: 'within', column: 'altitude', order: ['low', 'moderate', 'high', 'veryHigh'], allowed: 'moderate' };
  it('within: inside the limit is 1, one step over loses half, two steps lose it all', () => {
    expect(fit(alt, { altitude: 'low' })).toBe(1);
    expect(fit(alt, { altitude: 'moderate' })).toBe(1);
    expect(fit(alt, { altitude: 'high' })).toBe(0.5);
    expect(fit(alt, { altitude: 'veryHigh' })).toBe(0);
  });
  it('no data is null, never a zero', () => {
    expect(fit(alt, {})).toBeNull();
    expect(fit(alt, { altitude: 'low' }, 'hiking')).toBe(1);
    expect(fit(alt, { altitude: 'unknown' })).toBeNull();
    expect(fit({ type: 'atMost', column: 'x', value: 3 }, { other: 1 })).toBeNull();
  });
  it('has: choice, multi and tick columns', () => {
    expect(fit({ type: 'has', column: 'waveDirection', options: ['lefts', 'both'] }, { waveDirection: 'both' }, 'surfing')).toBe(1);
    expect(fit({ type: 'has', column: 'waveDirection', options: ['lefts', 'both'] }, { waveDirection: 'rights' }, 'surfing')).toBe(0);
    expect(fit({ type: 'has', column: 'accessStyle', options: ['shore'] }, { accessStyle: ['dayBoat', 'shore'] }, 'diving')).toBe(1);
    expect(fit({ type: 'has', column: 'accessStyle', options: ['shore'] }, { accessStyle: ['dayBoat'] }, 'diving')).toBe(0);
    expect(fit({ type: 'has', column: 'accessStyle', options: ['shore'] }, { accessStyle: [], divingRating: 4 }, 'diving')).toBeNull();
    // whale ticks: only a tick is stored, so a place with other facts and no tick reads as not ticked
    expect(fit({ type: 'has', column: 'swimAllowed', options: ['true'] }, { seasick: 4 }, 'whaleWatching')).toBe(0);
    expect(fit({ type: 'has', column: 'swimAllowed', options: ['true'] }, { swimAllowed: true }, 'whaleWatching')).toBe(1);
  });
  it('atLeast: the best reading among the columns, as a share of the target', () => {
    expect(fit({ type: 'atLeast', columns: ['dayHikeRating'], value: 8 }, { dayHikeRating: 6 })).toBe(0.75);
    expect(fit({ type: 'atLeast', columns: ['dayHikeRating'], value: 5 }, { dayHikeRating: 9 })).toBe(1);
    const odds: FitCheck = { type: 'atLeast', columns: ['hippo', 'giraffe'], value: 8 };
    expect(fit(odds, { hippo: 'possible', giraffe: 'likely' }, 'safari')).toBe(1);
    expect(fit(odds, { hippo: 'possible', giraffe: 'notPresent' }, 'safari')).toBe(0.625);
  });
  it('atMost: at or under is 1, above falls away to nothing at 10', () => {
    const c: FitCheck = { type: 'atMost', column: 'seasick', value: 4 };
    expect(fit(c, { seasick: 3 }, 'whaleWatching')).toBe(1);
    expect(fit(c, { seasick: 7 }, 'whaleWatching')).toBe(0.5);
    expect(fit(c, { seasick: 10 }, 'whaleWatching')).toBe(0);
  });
  it('count: signs of crowding, a place with none documented is quiet', () => {
    const c: FitCheck = { type: 'count', column: 'crowdIndicators', atMost: 1 };
    expect(fit(c, { crowdIndicators: ['controls'], altitude: 'low' })).toBe(1);
    expect(fit(c, { crowdIndicators: ['controls', 'volume', 'queues'], altitude: 'low' })).toBe(0);
    expect(fit(c, { altitude: 'low' })).toBe(1);
  });
  it('warmest: reads the lowest temperature in the text', () => {
    expect(lowestTempF('54-79 F, 3/2 mm in winter')).toBe(54);
    expect(lowestTempF('81-86 F')).toBe(81);
    expect(lowestTempF('3/2 mm wetsuit')).toBeNull();
    expect(lowestTempF('')).toBeNull();
    const c: FitCheck = { type: 'warmest', column: 'waterTemp', minF: 68 };
    expect(fit(c, { waterTemp: '72-84 F' }, 'diving')).toBe(1);
    expect(fit(c, { waterTemp: '63-80 F' }, 'diving')).toBeCloseTo(0.5, 5);
    expect(fit(c, { waterTemp: '40-58 F' }, 'diving')).toBe(0);
    expect(fit(c, { waterTemp: 'varies', divingRating: 3 }, 'diving')).toBeNull();
  });
  it('named: finds the animal by name and scores its odds', () => {
    const text = 'Manta ray (likely, Jun-Sep), Whale shark (possible, Oct), Green turtle (guaranteed)';
    expect(namedAnimalFit(text, ['manta'])).toBe(8);
    expect(namedAnimalFit(text, ['whale shark'])).toBe(5);
    expect(namedAnimalFit(text, ['turtle'])).toBe(10);
    expect(namedAnimalFit(text, ['hammerhead'])).toBe(0);
    expect(namedAnimalFit('', ['manta'])).toBeNull();
    expect(namedAnimalFit(undefined, ['manta'])).toBeNull();
  });
});

describe('questionFit', () => {
  const rule = QUESTION_FIT_RULES['hiking.q3'];
  const low = { altitude: 'low' };
  const high = { altitude: 'high' };
  it('an answer that asks for nothing skips the whole question', () => {
    expect(questionFit(rule, [3], hiking, high)).toBeNull();
    expect(questionFit(rule, [], hiking, high)).toBeNull();
  });
  it('checks the answer against the place', () => {
    expect(questionFit(rule, [0], hiking, low)).toBe(1);
    expect(questionFit(rule, [0], hiking, high)).toBe(0);
    expect(questionFit(rule, [2], hiking, high)).toBe(1);
  });
  it('two picks: the best one counts; a pick that asks for nothing skips the question', () => {
    const animals = QUESTION_FIT_RULES['safari.q1'];
    const defs = factDefsFor('safari');
    expect(questionFit(animals, [0, 1], defs, { leopard: 'unlikely', lion: 'guaranteed' })).toBe(1);
    expect(questionFit(QUESTION_FIT_RULES['wildlifeViewing.q3'], [0, 1], factDefsFor('wildlifeViewing'), { spectacle: 1 })).toBeNull();
  });
  it('any and all', () => {
    const q = QUESTION_FIT_RULES['safari.q5'];
    const defs = factDefsFor('safari');
    expect(questionFit(q, [1], defs, { nightDrives: 'yes', offRoad: 'no' })).toBe(1);
    expect(questionFit(q, [2], defs, { nightDrives: 'yes', offRoad: 'no' })).toBe(0);
    expect(questionFit(q, [2], defs, { nightDrives: 'yes', offRoad: 'yes' })).toBe(1);
  });
});

describe('the drafted rules', () => {
  const columnsOf = (c: FitCheck): string[] => (c.type === 'atLeast' ? c.columns : [c.column]);
  for (const [id, rule] of Object.entries(QUESTION_FIT_RULES)) {
    const [interest] = id.split('.');
    const defs = factDefsFor(interest);
    it(`${id} reads real columns with sensible options`, () => {
      expect(rule.answers.length).toBeGreaterThan(1);
      for (const a of rule.answers) {
        for (const c of a?.checks ?? []) {
          for (const col of columnsOf(c)) expect(defs.some((d) => d.key === col), `${col} is a column of ${interest}`).toBe(true);
          const def = defs.find((d) => d.key === columnsOf(c)[0])!;
          if (c.type === 'within') {
            const values = (def.options ?? []).map((o) => o.value);
            for (const v of c.order) expect(values, `${v} is an option of ${c.column}`).toContain(v);
            expect(c.order).toContain(c.allowed);
          }
          if (c.type === 'has' && def.type !== 'bool') {
            const values = (def.options ?? []).map((o) => o.value);
            for (const o of c.options) expect(values, `${o} is an option of ${c.column}`).toContain(o);
          }
          if (c.type === 'atMost' || (c.type === 'atLeast' && def.type === 'rating')) expect(def.type).toBe('rating');
          if (c.type === 'count') expect(def.type).toBe('multi');
          if (c.type === 'named') expect(def.type).toBe('text');
          if (c.type === 'warmest') expect(['text', 'int']).toContain(def.type);
        }
        expect(describeAnswerRule(a, defs).length).toBeGreaterThan(0);
      }
    });
    it(`${id} has a reason-chip message`, () => {
      expect(PROPOSED_MISS_MESSAGES[id]).toBeTruthy();
      expect(PROPOSED_MISS_MESSAGES[id].length).toBeLessThanOrEqual(40);
    });
  }
});

describe('Beaches & Swimming questions', () => {
  const defs = factDefsFor('beachesSwimming');
  const fit = (q: string, picked: number[], facts: Record<string, never | number | string[]>) => questionFit(QUESTION_FIT_RULES[`beachesSwimming.${q}`], picked, defs, facts as never);
  it('reads a plain number of degrees F for the water', () => {
    expect(lowestTempF(84)).toBe(84);
    expect(lowestTempF(5)).toBeNull();
  });
  it('bath-warm water needs 82 F or more; refreshing is fine never misses', () => {
    expect(fit('q1', [0], { seaTempF: 85 })).toBe(1);
    expect(fit('q1', [0], { seaTempF: 77 })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [1], { seaTempF: 77 })).toBe(1);
    expect(fit('q1', [2], { seaTempF: 55 })).toBeNull();
  });
  it('calm water reads the calm rating', () => {
    expect(fit('q3', [0], { calmWater: 10 })).toBe(1);
    expect(fit('q3', [0], { calmWater: 4 })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [3], { calmWater: 1 })).toBeNull();
  });
  it('access: steps away, short walk, secluded hike', () => {
    expect(fit('q2', [0], { beachAccess: ['door', 'trip'] })).toBe(1);
    expect(fit('q2', [0], { beachAccess: ['short'] })).toBe(0);
    expect(fit('q2', [1], { beachAccess: ['short'] })).toBe(1);
    expect(fit('q4', [1], { beachAccess: ['door'], remoteBeaches: 9 })).toBe(1);
    expect(fit('q4', [1], { beachAccess: ['door'], remoteBeaches: 2 })).toBeCloseTo(2 / 7, 5);
    expect(fit('q4', [2], { beachAccess: ['door'] })).toBeNull();
  });
  it('a place with no data is not marked down', () => {
    expect(fit('q3', [0], {})).toBeNull();
  });
});

describe('Mountaineering questions', () => {
  const defs = factDefsFor('mountaineering');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number>) => questionFit(QUESTION_FIT_RULES[`mountaineering.${q}`], picked, defs, facts as never);
  it('level: beginners need a beginner option, advanced climbers an advanced one', () => {
    expect(fit('q1', [0], { climbingLevels: ['beginner', 'intermediate'] })).toBe(1);
    expect(fit('q1', [1], { climbingLevels: ['advanced'] })).toBe(0);
    expect(fit('q1', [3], { climbingLevels: ['beginner', 'intermediate'] })).toBe(0);
    expect(fit('q1', [2], { climbingLevels: ['intermediate'] })).toBe(1);
  });
  it('independent climbers lose half where a guide is needed for the big climbs, all where for almost everything', () => {
    expect(fit('q2', [2], { guideRules: 'free' })).toBe(1);
    expect(fit('q2', [2], { guideRules: 'partly' })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [2], { guideRules: 'always' })).toBe(0);
    expect(fit('q2', [0], { guideRules: 'always' })).toBeNull();
  });
  it('commitment and gear', () => {
    expect(fit('q3', [3], { routeCommitment: ['single', 'expedition'] })).toBe(1);
    expect(fit('q3', [2], { routeCommitment: ['single'] })).toBe(0);
    expect(fit('q4', [0], { gearRental: 'plentiful' })).toBe(1);
    expect(fit('q4', [0], { gearRental: 'few' })).toBeCloseTo(0.5, 5);
    expect(fit('q4', [1], { gearRental: 'few' })).toBeNull();
  });
});

describe('Wind sports questions', () => {
  const defs = factDefsFor('windSports');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number>) => questionFit(QUESTION_FIT_RULES[`windSports.${q}`], picked, defs, facts as never);
  it('water: a flat-water rider needs flat water, a wave rider needs waves, everything asks nothing', () => {
    expect(fit('q1', [0], { waterType: ['flat', 'chop'] })).toBe(1);
    expect(fit('q1', [0], { waterType: ['waves'] })).toBe(0);
    expect(fit('q1', [1], { waterType: ['flat'] })).toBe(1);
    expect(fit('q1', [2], { waterType: ['chop'] })).toBe(0);
    expect(fit('q1', [3], { waterType: ['chop'] })).toBeNull();
  });
  it('level and wind strength', () => {
    expect(fit('q2', [0], { levelsServed: ['beginner', 'intermediate'] })).toBe(1);
    expect(fit('q2', [2], { levelsServed: ['beginner'] })).toBe(0);
    expect(fit('q3', [2], { windStrength: ['medium', 'strong'] })).toBe(1);
    expect(fit('q3', [0], { windStrength: ['strong'] })).toBe(0);
  });
  it('gear: renting needs Some or Plentiful', () => {
    expect(fit('q4', [0], { gearRental: 'plentiful' })).toBe(1);
    expect(fit('q4', [0], { gearRental: 'few' })).toBeCloseTo(0.5, 5);
    expect(fit('q4', [1], { gearRental: 'few' })).toBeNull();
  });
});

describe('Blooms and Fall Colors questions', () => {
  const defs = factDefsFor('wildflowerBlooms');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number>) => questionFit(QUESTION_FIT_RULES[`wildflowerBlooms.${q}`], picked, defs, facts as never);
  it('timing: near-certain needs a dependable bloom, a good chance allows a shifting one, gambling asks nothing', () => {
    expect(fit('q1', [0], { timingReliability: 'dependable' })).toBe(1);
    expect(fit('q1', [0], { timingReliability: 'shifts' })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [1], { timingReliability: 'shifts' })).toBe(1);
    expect(fit('q1', [1], { timingReliability: 'rainDependent' })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [1], { timingReliability: 'rare' })).toBe(0);
    expect(fit('q1', [2], { timingReliability: 'rare' })).toBeNull();
  });
  it('how you see it', () => {
    expect(fit('q2', [0], { howSeen: ['road', 'easy'] })).toBe(1);
    expect(fit('q2', [2], { howSeen: ['road', 'easy'] })).toBe(0);
    expect(fit('q2', [2], { howSeen: ['hike'] })).toBe(1);
  });
  it('crowds: the crowd is fun asks nothing, early mornings allows busy but beatable, quiet only needs quiet', () => {
    expect(fit('q3', [0], { bloomCrowds: 'festival' })).toBeNull();
    expect(fit('q3', [1], { bloomCrowds: 'beatable' })).toBe(1);
    expect(fit('q3', [1], { bloomCrowds: 'festival' })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [2], { bloomCrowds: 'beatable' })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [2], { bloomCrowds: 'quiet' })).toBe(1);
  });
});

describe('Hot Springs questions', () => {
  const defs = factDefsFor('hotSprings');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>, month?: number | null) => questionFit(QUESTION_FIT_RULES[`hotSprings.${q}`], picked, defs, facts as never, month);
  it('bathing customs: swimsuit and private baths read the list, onsen style asks for nothing', () => {
    expect(fit('q1', [0], { bathingStyles: ['swimsuit', 'private'] })).toBe(1);
    expect(fit('q1', [0], { bathingStyles: ['gendered', 'private'] })).toBe(0);
    expect(fit('q1', [2], { bathingStyles: ['gendered', 'private'] })).toBe(1);
    expect(fit('q1', [1], { bathingStyles: ['swimsuit'] })).toBeNull();
  });
  it('the heat levels on offer', () => {
    expect(fit('q3', [0], { waterHeat: ['gentle', 'hot'] })).toBe(1);
    expect(fit('q3', [2], { waterHeat: ['gentle', 'hot'] })).toBe(0);
    expect(fit('q3', [2], { waterHeat: ['hot', 'veryHot'] })).toBe(1);
  });
  it('winter in the snow and cool weather need the month the traveler is going', () => {
    const hokkaido = { coldMonths: ['dec', 'jan', 'feb', 'mar'], coolMonths: ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may'], waterHeat: ['hot'] };
    expect(fit('q2', [0], hokkaido, 0)).toBe(1); // January
    expect(fit('q2', [0], hokkaido, 6)).toBe(0); // July
    expect(fit('q2', [2], hokkaido, 10)).toBe(1); // November is cool
    expect(fit('q2', [2], hokkaido, 7)).toBe(0); // August
    expect(fit('q2', [0], hokkaido, null)).toBeNull(); // no month chosen: asks for nothing
    expect(fit('q2', [1], hokkaido, 6)).toBeNull(); // year-round asks for nothing
  });
  it('a place with data but no cold months does not fit winter in the snow', () => {
    expect(fit('q2', [0], { waterHeat: ['gentle'] }, 0)).toBe(0);
    expect(fit('q2', [2], { waterHeat: ['gentle'] }, 0)).toBe(0);
  });
});

describe('Aurora questions', () => {
  const defs = factDefsFor('auroraChasing');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>, month?: number | null) => questionFit(QUESTION_FIT_RULES[`auroraChasing.${q}`], picked, defs, facts as never, month);
  it('mild winter only reads the properly cold months and the trip month', () => {
    const fairbanks = { auroraStrength: 9, coldMonths: ['nov', 'dec', 'jan', 'feb', 'mar'] };
    expect(fit('q1', [0], fairbanks, 8)).toBe(1); // September
    expect(fit('q1', [0], fairbanks, 1)).toBe(0); // February
    expect(fit('q1', [0], { auroraStrength: 6 }, 1)).toBe(1); // Iceland has no cold months
    expect(fit('q1', [0], fairbanks, null)).toBeNull();
    expect(fit('q1', [1], fairbanks, 1)).toBeNull();
  });
  it('tour, car or lodge', () => {
    expect(fit('q2', [0], { howSeen: ['tour'] })).toBe(1);
    expect(fit('q2', [1], { howSeen: ['tour'] })).toBe(0);
    expect(fit('q2', [1], { howSeen: ['tour', 'car', 'lodge'] })).toBe(1);
  });
  it('nights read the strength rating', () => {
    expect(fit('q3', [0], { auroraStrength: 9 })).toBe(1);
    expect(fit('q3', [0], { auroraStrength: 6 })).toBeCloseTo(6 / 9, 5);
    expect(fit('q3', [1], { auroraStrength: 8 })).toBe(1);
    expect(fit('q3', [2], { auroraStrength: 6 })).toBe(1);
    expect(fit('q3', [3], { auroraStrength: 2 })).toBeNull();
  });
});

describe('Scenic Landscapes questions', () => {
  const defs = factDefsFor('scenicLandscapes');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`scenicLandscapes.${q}`], picked, defs, facts as never);
  it('how you take in a view', () => {
    expect(fit('q1', [0], { viewAccess: ['roadside', 'short'] })).toBe(1);
    expect(fit('q1', [2], { viewAccess: ['roadside', 'short'] })).toBe(0);
    expect(fit('q1', [2], { viewAccess: ['longHike'] })).toBe(1);
    expect(fit('q1', [3], { viewAccess: ['airBoat'] })).toBe(1);
  });
  it('iconic spots or gems, and a bit of both asks nothing', () => {
    expect(fit('q2', [0], { iconicRating: 10, hiddenGemsRating: 3 })).toBe(1);
    expect(fit('q2', [1], { iconicRating: 10, hiddenGemsRating: 3 })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [2], { iconicRating: 3 })).toBeNull();
  });
  it('how far you will go for the shot', () => {
    expect(fit('q3', [0], { viewAccess: ['short'] })).toBe(1);
    expect(fit('q3', [3], { viewAccess: ['roadside', 'short', 'halfDay'] })).toBe(0);
    expect(fit('q3', [3], { viewAccess: ['backcountry'] })).toBe(1);
  });
});

describe('Street Food questions', () => {
  const defs = factDefsFor('streetFood');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`streetFood.${q}`], picked, defs, facts as never);
  it('safe favorites need familiar or mixed food; the others ask for nothing', () => {
    expect(fit('q1', [0], { foodAdventure: 'mixed' })).toBe(1);
    expect(fit('q1', [0], { foodAdventure: 'adventurous' })).toBe(0);
    expect(fit('q1', [2], { foodAdventure: 'adventurous' })).toBeNull();
  });
  it('very careful needs low illness risk, normal care allows some', () => {
    expect(fit('q2', [0], { illnessRisk: 'low' })).toBe(1);
    expect(fit('q2', [0], { illnessRisk: 'some' })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [1], { illnessRisk: 'some' })).toBe(1);
    expect(fit('q2', [2], { illnessRisk: 'high' })).toBeNull();
  });
  it('eating style and how much of your eating', () => {
    expect(fit('q3', [2], { eatingStyle: ['standing', 'stools'] })).toBe(0);
    expect(fit('q3', [1], { eatingStyle: ['table'] })).toBe(1);
    expect(fit('q4', [2], { streetStalls: 8 })).toBe(1);
    expect(fit('q4', [1], { streetStalls: 3 })).toBeCloseTo(0.6, 5);
    expect(fit('q4', [0], { streetStalls: 1 })).toBeNull();
  });
});

describe('Luxury Hotels questions', () => {
  const defs = factDefsFor('luxuryHotels');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`luxuryHotels.${q}`], picked, defs, facts as never);
  it('a private villa needs a villa market', () => {
    expect(fit('q1', [1], { privateVillas: 'plentiful' })).toBe(1);
    expect(fit('q1', [1], { privateVillas: 'few' })).toBe(0);
    expect(fit('q1', [0], { privateVillas: 'few' })).toBeNull();
  });
  it('the hotel is the trip reads the rating', () => {
    expect(fit('q2', [0], { hotelIsDestination: 7 })).toBe(1);
    expect(fit('q2', [0], { hotelIsDestination: 3.5 })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [2], { hotelIsDestination: 1 })).toBeNull();
  });
  it('the dream stay only adds a match and never marks a place down', () => {
    expect(fit('q3', [3], { stayTypes: ['overwater', 'villaPool'] })).toBe(1);
    expect(fit('q3', [3], { stayTypes: ['penthouse'] })).toBeNull();
  });
});

describe('Road Cycling questions', () => {
  const defs = factDefsFor('cyclingRoad');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`cyclingRoad.${q}`], picked, defs, facts as never);
  it('ride level', () => {
    expect(fit('q1', [3], { rideLevels: ['moderate', 'racer'] })).toBe(1);
    expect(fit('q1', [0], { rideLevels: ['strong', 'racer'] })).toBe(0);
  });
  it('renting a road bike or an e-bike', () => {
    expect(fit('q2', [0], { roadBikeRental: 'plentiful' })).toBe(1);
    expect(fit('q2', [0], { roadBikeRental: 'few' })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [1], { roadBikeRental: 'few' })).toBeNull();
    expect(fit('q2', [2], { eBikeRental: true })).toBe(1);
    expect(fit('q2', [2], { eBikeRental: false })).toBe(0);
  });
  it('traffic reads the quiet scenic rating, and support reads the touring list', () => {
    expect(fit('q3', [0], { quietScenic: 7 })).toBe(1);
    expect(fit('q3', [1], { quietScenic: 2 })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [2], { quietScenic: 0 })).toBeNull();
    expect(fit('q4', [1], { touringSupport: ['luggage'] })).toBe(1);
    expect(fit('q4', [2], { touringSupport: ['guided'] })).toBe(0);
  });
});

describe('History & Archaeology questions', () => {
  const defs = factDefsFor('historyArchaeology');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`historyArchaeology.${q}`], picked, defs, facts as never);
  it('how much is explained', () => {
    expect(fit('q1', [0], { interpretation: ['audio'] })).toBeNull();
    expect(fit('q1', [1], { interpretation: ['audio', 'local'] })).toBe(1);
    expect(fit('q1', [3], { interpretation: ['audio', 'local'] })).toBe(0);
  });
  it('sites in place read the best of the four site ratings, museums read their own', () => {
    expect(fit('q2', [0], { ancientRuins: 2, warHistory: 9, prehistoricSites: 1, castles: 3 })).toBe(1);
    expect(fit('q2', [0], { ancientRuins: 2, warHistory: 3, prehistoricSites: 1, castles: 3.5 })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [1], { archaeologyMuseums: 10 })).toBe(1);
    expect(fit('q2', [2], { archaeologyMuseums: 1 })).toBeNull();
  });
  it('ground and history in a day', () => {
    expect(fit('q3', [0], { roughestGround: 'climb' })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [1], { roughestGround: 'climb' })).toBe(1);
    expect(fit('q3', [2], { roughestGround: 'rough' })).toBeNull();
    expect(fit('q4', [2], { historyDensity: 8 })).toBe(1);
    expect(fit('q4', [0], { historyDensity: 1 })).toBeNull();
  });
});

describe('Sunbathing questions', () => {
  const defs = factDefsFor('sunbathing');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>, month?: number) => questionFit(QUESTION_FIT_RULES[`sunbathing.${q}`], picked, defs, facts as never, month);
  it('sun certainty reads the place\'s dry and wet months for the month chosen', () => {
    const f = { dryMonths: ['jun', 'jul'], wetMonths: ['dec'] };
    expect(fit('q2', [0], f, 5)).toBe(1);
    expect(fit('q2', [0], f, 0)).toBe(0);
    expect(fit('q2', [1], f, 11)).toBe(0);
    expect(fit('q2', [1], f, 5)).toBe(1);
    expect(fit('q2', [0], f, undefined)).toBeNull();
    expect(fit('q2', [2], f, 11)).toBeNull();
  });
  it('wind and service', () => {
    expect(fit('q3', [0], { calmShores: 7 })).toBe(1);
    expect(fit('q3', [1], { calmShores: 2 })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [2], { calmShores: 0 })).toBeNull();
    expect(fit('q4', [1], { serviceLevel: 'table' })).toBe(1);
    expect(fit('q4', [2], { serviceLevel: 'snack' })).toBe(0);
    expect(fit('q4', [0], { serviceLevel: 'self' })).toBeNull();
  });
});

describe('Architecture questions', () => {
  const defs = factDefsFor('architecture');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`architecture.${q}`], picked, defs, facts as never);
  it('old or new, monuments or streets, and how far inside', () => {
    expect(fit('q1', [0], { historicArchitecture: 9 })).toBe(1);
    expect(fit('q1', [2], { modernArchitecture: 3.5 })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [1], { historicArchitecture: 1 })).toBeNull();
    expect(fit('q2', [1], { everydayStreets: 7 })).toBe(1);
    expect(fit('q3', [1], { buildingsInside: 6 })).toBe(1);
    expect(fit('q3', [2], { buildingsInside: 4 })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [0], { buildingsInside: 0 })).toBeNull();
  });
});

describe('City Exploration questions', () => {
  const defs = factDefsFor('cityExploration');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`cityExploration.${q}`], picked, defs, facts as never);
  it('getting around is an ordered limit', () => {
    expect(fit('q1', [0], { gettingAround: 'walk' })).toBe(1);
    expect(fit('q1', [0], { gettingAround: 'transit' })).toBe(0);
    expect(fit('q1', [1], { gettingAround: 'transit' })).toBe(1);
    expect(fit('q1', [1], { gettingAround: 'car' })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [2], { gettingAround: 'car' })).toBeNull();
  });
  it('city size reads the population with soft edges', () => {
    expect(fit('q3', [0], { cityPopulation: 21800 })).toBe(1);
    expect(fit('q3', [0], { cityPopulation: 3000 })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [0], { cityPopulation: 840 })).toBe(0);
    expect(fit('q3', [1], { cityPopulation: 840 })).toBe(1);
    expect(fit('q3', [1], { cityPopulation: 21800 })).toBe(0);
    expect(fit('q3', [2], { cityPopulation: 2.5 })).toBe(1);
    expect(fit('q3', [2], { cityPopulation: 625 })).toBeCloseTo(0.5, 5);
  });
  it('days and how you explore', () => {
    expect(fit('q4', [2], { daysItCanFill: 'longer' })).toBe(1);
    expect(fit('q4', [2], { daysItCanFill: '4to5' })).toBe(0);
    expect(fit('q4', [0], { daysItCanFill: 'weekend' })).toBeNull();
    expect(fit('q2', [1], { offTheBeatenPath: 3, marketsStreetLife: 9 })).toBe(1);
    expect(fit('q2', [2], { guidedWalks: true })).toBe(1);
  });
});

describe('Museums & Art questions', () => {
  const defs = factDefsFor('museumsArt');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`museumsArt.${q}`], picked, defs, facts as never);
  it('how long reads the biggest museum in hours, several days reads the depth', () => {
    expect(fit('q1', [1], { biggestMuseumHours: 5 })).toBe(1);
    expect(fit('q1', [1], { biggestMuseumHours: 1 })).toBe(0);
    expect(fit('q1', [2], { biggestMuseumHours: 4 })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [3], { daysOfMuseums: 4 })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [0], { biggestMuseumHours: 1 })).toBeNull();
  });
  it('famous or quirky, and timed entry', () => {
    expect(fit('q2', [1], { quirkyMuseums: 8 })).toBe(1);
    expect(fit('q3', [2], { timedEntry: 'some' })).toBe(0);
    expect(fit('q3', [1], { timedEntry: 'some' })).toBe(1);
  });
});

describe('Skiing questions', () => {
  const defs = factDefsFor('skiingSnowboarding');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`skiingSnowboarding.${q}`], picked, defs, facts as never);
  it('level, apres and snowboard', () => {
    expect(fit('q1', [0], { beginnerFriendly: 6 })).toBe(1);
    expect(fit('q1', [2], { advancedTerrain: 3.5 })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [2], { apres: 7 })).toBe(1);
    expect(fit('q3', [1], { snowboardParks: 5 })).toBe(1);
    expect(fit('q3', [0], { snowboardParks: 0 })).toBeNull();
  });
});

describe('Sunbathing question 1, how hot', () => {
  const defs = factDefsFor('sunbathing');
  const highs = '80,80,82,84,86,88,90,90,88,86,84,82';
  const fit = (picked: number[], month?: number) => questionFit(QUESTION_FIT_RULES['sunbathing.q1'], picked, defs, { afternoonHighsF: highs } as never, month);
  it('reads the afternoon high of the month chosen', () => {
    expect(fit([0], 0)).toBe(1);
    expect(fit([0], 6)).toBeCloseTo(0.2, 5);
    expect(fit([1], 6)).toBe(1);
    expect(fit([1], 0)).toBeCloseTo(0.8, 5);
    expect(fit([0], undefined)).toBeNull();
    expect(fit([2], 6)).toBeNull();
  });
});

describe('Religious & Spiritual Sites questions', () => {
  const defs = factDefsFor('religiousSites');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`religiousSites.${q}`], picked, defs, facts as never);
  it('rules, closeness and stays', () => {
    expect(fit('q1', [1], { siteRules: 'modest' })).toBe(1);
    expect(fit('q1', [1], { siteRules: 'strict' })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [2], { siteRules: 'modest' })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [0], { siteRules: 'strict' })).toBeNull();
    expect(fit('q2', [2], { religiousDensity: 8 })).toBe(1);
    expect(fit('q3', [2], { templeStays: false })).toBe(0);
    expect(fit('q3', [1], { templeStays: false })).toBeNull();
  });
});

describe('Spa & Wellness questions', () => {
  const defs = factDefsFor('spaWellness');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`spaWellness.${q}`], picked, defs, facts as never);
  it('indulgence, bathing customs and length', () => {
    expect(fit('q1', [0], { daySpas: 7 })).toBe(1);
    expect(fit('q1', [2], { clinicalWellness: 3 })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [0], { bathingCustoms: ['swimwear', 'private'] })).toBe(1);
    expect(fit('q2', [2], { bathingCustoms: ['swimwear'] })).toBe(0);
    expect(fit('q2', [1], { bathingCustoms: ['nude'] })).toBeNull();
    expect(fit('q3', [1], { daySpas: 2, thermalBaths: 9 })).toBe(1);
    expect(fit('q3', [2], { wellnessResorts: 7 })).toBe(1);
  });
});

describe('Stargazing questions', () => {
  const defs = factDefsFor('stargazing');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`stargazing.${q}`], picked, defs, facts as never);
  it('darkness reads the Bortle class with soft edges', () => {
    expect(fit('q1', [2], { bortle: 1 })).toBe(1);
    expect(fit('q1', [2], { bortle: 3.5 })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [2], { bortle: 5 })).toBe(0);
    expect(fit('q1', [0], { bortle: 6 })).toBe(1);
    expect(fit('q1', [1], { bortle: 7 })).toBe(0);
  });
  it('cold and high', () => {
    expect(fit('q2', [0], { nightConditions: 'cool' })).toBe(0);
    expect(fit('q2', [1], { nightConditions: 'cold' })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [2], { nightConditions: 'cold' })).toBeNull();
  });
});

describe('Adventure Sports questions', () => {
  const defs = factDefsFor('adventureSports');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`adventureSports.${q}`], picked, defs, facts as never);
  it('standards, effort and private trips', () => {
    expect(fit('q1', [0], { operatorStandards: 'regulated' })).toBe(1);
    expect(fit('q1', [1], { operatorStandards: 'basic' })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [1], { operatorStandards: 'mixed' })).toBe(1);
    expect(fit('q1', [2], { operatorStandards: 'basic' })).toBeNull();
    expect(fit('q2', [0], { effortLevels: ['stamina', 'fit'] })).toBe(0);
    expect(fit('q2', [1], { effortLevels: ['stamina'] })).toBe(1);
    expect(fit('q3', [0], { privateTrips: true })).toBe(1);
  });
});

describe('The seven interests finished on 25 Oct 2026', () => {
  type Facts = Record<string, string | string[] | number | boolean>;
  const make = (interest: string) => {
    const defs = factDefsFor(interest);
    return (q: string, picked: number[], facts: Facts) => questionFit(QUESTION_FIT_RULES[`${interest}.${q}`], picked, defs, facts as never);
  };
  it('Fine Dining: booking ahead and price', () => {
    const fit = make('fineDining');
    expect(fit('q2', [0], { bookingAhead: 'months' })).toBe(0);
    expect(fit('q2', [1], { bookingAhead: 'months' })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [2], { bookingAhead: 'months' })).toBeNull();
    expect(fit('q3', [0], { tastingMenuPrice: 90 })).toBe(1);
    expect(fit('q3', [0], { tastingMenuPrice: 330 })).toBe(0);
    expect(fit('q3', [1], { tastingMenuPrice: 200 })).toBe(1);
    expect(fit('q3', [0], {})).toBeNull();
    expect(fit('q1', [2], { tastingMenus: 4 })).toBeCloseTo(0.5, 5);
  });
  it('Coffee & Tea: tasting, café style and ceremony', () => {
    const fit = make('coffeeTea');
    expect(fit('q1', [2], { coffeeFarms: false, teaPlantations: false })).toBe(0);
    expect(fit('q1', [2], { coffeeFarms: true })).toBe(1);
    expect(fit('q2', [0], { cafeStyles: ['quick'] })).toBe(0);
    expect(fit('q2', [1], { cafeStyles: ['quick'] })).toBe(1);
    expect(fit('q3', [0], { teaCeremonies: 9, ceremonyStyles: ['formal'] })).toBe(1);
    expect(fit('q3', [0], { teaCeremonies: 1 })).toBeCloseTo(1 / 3, 5);
  });
  it('Nightlife: how late, dress and noise', () => {
    const fit = make('nightlife');
    expect(fit('q1', [2], { lateNights: 'early' })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [3], { lateNights: 'early' })).toBe(0);
    expect(fit('q1', [3], { lateNights: 'allNight' })).toBe(1);
    expect(fit('q2', [0], { dressCode: 'strict' })).toBe(0);
    expect(fit('q2', [1], { dressCode: 'strict' })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [0], { quietBars: 9 })).toBe(1);
    expect(fit('q3', [2], { clubs: 7 })).toBe(1);
  });
  it('Shopping: haggling, crowds and goods', () => {
    const fit = make('shopping');
    expect(fit('q1', [2], { haggling: 'expected' })).toBe(0);
    expect(fit('q1', [2], { haggling: 'some' })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [0], { haggling: 'expected' })).toBeNull();
    expect(fit('q2', [2], { crowdedBazaars: 10 })).toBe(0);
    expect(fit('q2', [2], { crowdedBazaars: 2 })).toBe(1);
    expect(fit('q2', [0], { crowdedBazaars: 6 })).toBe(1);
    expect(fit('q3', [2], { luxuryShopping: 2, outletsBargains: true })).toBe(1);
  });
  it('Traditional Crafts: courses, settings and serious pieces', () => {
    const fit = make('traditionalCrafts');
    expect(fit('q1', [1], { craftWorkshops: true, courseLengths: ['short'] })).toBe(1);
    expect(fit('q1', [2], { craftWorkshops: true, courseLengths: ['short'] })).toBe(0);
    expect(fit('q1', [1], { craftWorkshops: false })).toBe(0);
    expect(fit('q2', [3], { craftSettings: ['markets'] })).toBe(0);
    expect(fit('q2', [2], { craftSettings: ['markets'] })).toBe(1);
    expect(fit('q3', [2], { seriousPieces: 3 })).toBeCloseTo(0.5, 5);
  });
  it('Festivals: size and booking', () => {
    const fit = make('festivals');
    expect(fit('q1', [2], { festivalScales: ['small', 'mid'] })).toBe(0);
    expect(fit('q1', [0], { festivalScales: ['small'] })).toBe(1);
    expect(fit('q2', [0], { ticketAvailability: 'months' })).toBe(0);
    expect(fit('q2', [2], { ticketAvailability: 'months' })).toBeNull();
  });
  it('Scenic Landscapes: camera gear rules', () => {
    const fit = make('scenicLandscapes');
    expect(fit('q4', [0], { gearRules: 'many' })).toBeNull();
    expect(fit('q4', [2], { gearRules: 'many' })).toBeCloseTo(0.5, 5);
    expect(fit('q4', [3], { gearRules: 'some' })).toBeCloseTo(0.5, 5);
    expect(fit('q4', [3], { gearRules: 'many' })).toBe(0);
  });
});

describe('Theme Parks questions', () => {
  const defs = factDefsFor('themeParks');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`themeParks.${q}`], picked, defs, facts as never);
  it('days, hotels and how thrilling', () => {
    expect(fit('q1', [0], { daysOfParks: 1 })).toBeNull();
    expect(fit('q1', [1], { daysOfParks: 1 })).toBe(0);
    expect(fit('q1', [1], { daysOfParks: 2 })).toBe(1);
    expect(fit('q1', [2], { daysOfParks: 2 })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [2], { daysOfParks: 5 })).toBe(1);
    expect(fit('q2', [0], { parkHotels: 'city' })).toBe(0);
    expect(fit('q2', [1], { parkHotels: 'nearby' })).toBe(1);
    expect(fit('q2', [2], { parkHotels: 'city' })).toBeNull();
    expect(fit('q3', [0], { thrillRides: 1 })).toBeNull();
    expect(fit('q3', [2], { thrillRides: 4 })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [1], { thrillRides: 7 })).toBe(1);
  });
});

describe('Golf questions', () => {
  const defs = factDefsFor('golf');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`golf.${q}`], picked, defs, facts as never);
  it('skill reads the course kinds the place has', () => {
    expect(fit('q1', [0], { courseKinds: ['championship'] })).toBe(0);
    expect(fit('q1', [0], { courseKinds: ['easy'] })).toBe(1);
    expect(fit('q1', [1], { courseKinds: ['easy'] })).toBe(0);
    expect(fit('q1', [1], { courseKinds: ['standard'] })).toBe(1);
    expect(fit('q1', [2], { courseKinds: ['standard'] })).toBe(0);
    expect(fit('q1', [2], { courseKinds: ['easy', 'championship'] })).toBe(1);
  });
  it('how much of the trip is golf', () => {
    expect(fit('q4', [0], { golfCourses: 1 })).toBe(0);
    expect(fit('q4', [0], { golfCourses: 6 })).toBeCloseTo(0.5, 5);
    expect(fit('q4', [0], { golfCourses: 40 })).toBe(1);
    expect(fit('q4', [1], { golfCourses: 1 })).toBeNull();
    expect(fit('q4', [2], { thingsBeyondGolf: 3 })).toBeCloseTo(0.5, 5);
    expect(fit('q4', [2], { thingsBeyondGolf: 9 })).toBe(1);
  });
  it('walk or ride and tee time are left unmapped', () => {
    expect(QUESTION_FIT_RULES['golf.q2']).toBeUndefined();
    expect(QUESTION_FIT_RULES['golf.q3']).toBeUndefined();
  });
});

describe('Mountain Biking questions', () => {
  const defs = factDefsFor('mountainBiking');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`mountainBiking.${q}`], picked, defs, facts as never);
  it('riding level reads the grades that have trail', () => {
    expect(fit('q1', [0], { trailGrades: ['black', 'expert'] })).toBe(0);
    expect(fit('q1', [0], { trailGrades: ['green'] })).toBe(1);
    expect(fit('q1', [1], { trailGrades: ['intermediate'] })).toBe(1);
    expect(fit('q1', [2], { trailGrades: ['green', 'intermediate'] })).toBe(0);
    expect(fit('q1', [3], { trailGrades: ['expert'] })).toBe(1);
  });
  it('rent, bring or e-bike', () => {
    expect(fit('q2', [0], { bikeRental: 2 })).toBeCloseTo(0.5, 5);
    expect(fit('q2', [0], { bikeRental: 6 })).toBe(1);
    expect(fit('q2', [1], { bikeRental: 0 })).toBeNull();
    expect(fit('q2', [2], { eBikeRental: 0 })).toBe(0);
    expect(fit('q2', [2], { eBikeRental: 4 })).toBe(1);
  });
  it('day length needs at least that much riding', () => {
    expect(fit('q3', [0], { dayLengths: ['couple'] })).toBe(1);
    expect(fit('q3', [1], { dayLengths: ['couple'] })).toBe(0);
    expect(fit('q3', [1], { dayLengths: ['couple', 'half', 'full'] })).toBe(1);
    expect(fit('q3', [2], { dayLengths: ['couple', 'half'] })).toBe(0);
    expect(fit('q3', [3], { dayLengths: ['couple', 'half', 'full', 'multi'] })).toBe(1);
  });
});

describe('Camping & Backcountry questions', () => {
  const defs = factDefsFor('campingBackcountry');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`campingBackcountry.${q}`], picked, defs, facts as never);
  it('how remote', () => {
    expect(fit('q1', [0], { campgrounds: 4 })).toBeCloseTo(0.8, 5);
    expect(fit('q1', [0], { campgrounds: 8 })).toBe(1);
    expect(fit('q1', [2], { howRemote: 2.5 })).toBeCloseTo(0.5, 5);
    expect(fit('q1', [2], { howRemote: 7 })).toBe(1);
    expect(fit('q1', [3], { howRemote: 10 })).toBe(1);
    expect(fit('q1', [3], { howRemote: 4 })).toBeCloseTo(0.5, 5);
  });
  it('how cold you will sleep', () => {
    expect(fit('q4', [0], { nightTemps: 'warm' })).toBe(1);
    expect(fit('q4', [0], { nightTemps: 'cool' })).toBeCloseTo(0.5, 5);
    expect(fit('q4', [0], { nightTemps: 'cold' })).toBe(0);
    expect(fit('q4', [1], { nightTemps: 'cool' })).toBe(1);
    expect(fit('q4', [2], { nightTemps: 'freezing' })).toBeCloseTo(0.5, 5);
    expect(fit('q4', [3], { nightTemps: 'freezing' })).toBeNull();
  });
  it('gear and wildlife are left unmapped', () => {
    expect(QUESTION_FIT_RULES['campingBackcountry.q2']).toBeUndefined();
    expect(QUESTION_FIT_RULES['campingBackcountry.q3']).toBeUndefined();
  });
});

describe('Horseback Riding questions', () => {
  const defs = factDefsFor('horsebackRiding');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`horsebackRiding.${q}`], picked, defs, facts as never);
  it('rider level: three answers, the old never-ridden answer was merged into beginner', () => {
    expect(fit('q1', [0], { riderLevels: ['expert'] })).toBe(0);
    expect(fit('q1', [0], { riderLevels: ['beginner', 'confident'] })).toBe(1);
    expect(fit('q1', [1], { riderLevels: ['beginner'] })).toBe(0);
    expect(fit('q1', [1], { riderLevels: ['expert'] })).toBe(1);
    expect(fit('q1', [2], { riderLevels: ['confident'] })).toBe(0);
    expect(fit('q1', [2], { riderLevels: ['beginner', 'expert'] })).toBe(1);
  });
  it('trip length needs at least that much on offer', () => {
    expect(fit('q3', [0], { rideLengths: ['week'] })).toBe(1);
    expect(fit('q3', [1], { rideLengths: ['hours'] })).toBe(0);
    expect(fit('q3', [2], { rideLengths: ['hours', 'day'] })).toBe(0);
    expect(fit('q3', [2], { rideLengths: ['days'] })).toBe(1);
    expect(fit('q3', [3], { rideLengths: ['hours', 'day', 'days'] })).toBe(0);
    expect(fit('q3', [3], { rideLengths: ['week'] })).toBe(1);
  });
  it('local horse culture (question 2) is left unmapped', () => {
    expect(QUESTION_FIT_RULES['horsebackRiding.q2']).toBeUndefined();
  });
});

describe('Sailing questions', () => {
  const defs = factDefsFor('sailing');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`sailing.${q}`], picked, defs, facts as never);
  it('sea conditions: one step rougher than you can take loses half', () => {
    expect(fit('q3', [0], { seaConditions: 'flat' })).toBe(1);
    expect(fit('q3', [0], { seaConditions: 'swell' })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [0], { seaConditions: 'open' })).toBe(0);
    expect(fit('q3', [1], { seaConditions: 'swell' })).toBe(1);
    expect(fit('q3', [1], { seaConditions: 'open' })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [2], { seaConditions: 'open' })).toBeNull();
  });
  it('who sails, trip length and experience are left unmapped (charter data is too thin)', () => {
    for (const q of ['q1', 'q2', 'q4']) expect(QUESTION_FIT_RULES[`sailing.${q}`]).toBeUndefined();
  });
});

describe('Kayaking & Rafting questions', () => {
  const defs = factDefsFor('kayakingRafting');
  const fit = (q: string, picked: number[], facts: Record<string, string | string[] | number | boolean>) => questionFit(QUESTION_FIT_RULES[`kayakingRafting.${q}`], picked, defs, facts as never);
  it('how wild: gentle float needs calm water or class I-II; the harder answers need those classes', () => {
    expect(fit('q1', [0], { calmWaterPaddling: 4 })).toBe(1);
    expect(fit('q1', [0], { calmWaterPaddling: 2, whitewaterClasses: ['none'] })).toBeCloseTo(2 / 3, 5);
    expect(fit('q1', [0], { calmWaterPaddling: 0, whitewaterClasses: ['none'] })).toBe(0);
    expect(fit('q1', [0], { calmWaterPaddling: 0, whitewaterClasses: ['ii'] })).toBe(1);
    expect(fit('q1', [1], { whitewaterClasses: ['iii'] })).toBe(1);
    expect(fit('q1', [1], { whitewaterClasses: ['none'] })).toBe(0);
    expect(fit('q1', [2], { whitewaterClasses: ['iii'] })).toBe(0);
    expect(fit('q1', [2], { whitewaterClasses: ['iv'] })).toBe(1);
    expect(fit('q1', [3], { whitewaterClasses: ['iv'] })).toBe(0);
    expect(fit('q1', [3], { whitewaterClasses: ['iii', 'v'] })).toBe(1);
  });
  it('how cold: one step colder than you accept loses half, two steps lose all', () => {
    expect(fit('q3', [0], { waterTemperature: 'warm' })).toBe(1);
    expect(fit('q3', [0], { waterTemperature: 'cool' })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [0], { waterTemperature: 'glacial' })).toBe(0);
    expect(fit('q3', [1], { waterTemperature: 'cool' })).toBe(1);
    expect(fit('q3', [1], { waterTemperature: 'glacial' })).toBeCloseTo(0.5, 5);
    expect(fit('q3', [2], { waterTemperature: 'glacial' })).toBeNull();
  });
  it('experience: never paddled needs the never level, a little accepts never or little', () => {
    expect(fit('q4', [0], { skillLevels: ['little', 'experienced'] })).toBe(0);
    expect(fit('q4', [0], { skillLevels: ['never'] })).toBe(1);
    expect(fit('q4', [1], { skillLevels: ['little'] })).toBe(1);
    expect(fit('q4', [1], { skillLevels: ['experienced'] })).toBe(0);
    expect(fit('q4', [2], { skillLevels: ['experienced'] })).toBeNull();
  });
  it('guided or self-guided (question 2) is left unmapped', () => {
    expect(QUESTION_FIT_RULES['kayakingRafting.q2']).toBeUndefined();
  });
});
