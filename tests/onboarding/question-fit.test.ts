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
