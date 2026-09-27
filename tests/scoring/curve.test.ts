import { describe, expect, it } from 'vitest';
import {
  anchorSchema,
  crowdsScore,
  curveValue,
  dealsScore,
  ease,
  parseSliderCurve,
  sliderCurveSchema,
  type Anchor,
  type SliderCurve,
} from '@/lib/scoring/curve';

function makeCurve(anchors: Anchor[]): SliderCurve {
  return parseSliderCurve({ anchors });
}

function monthly(curve: SliderCurve): number[] {
  const out: number[] = [];
  for (let m = 1; m <= 12; m++) out.push(Math.round(curveValue(m, curve) * 1000) / 1000);
  return out;
}

// A small seeded PRNG so fuzz failures are reproducible without a dependency.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomValidAnchors(rand: () => number): Anchor[] {
  const count = 1 + Math.floor(rand() * 5); // 1..5
  const months = new Set<number>();
  while (months.size < count) months.add(1 + Math.floor(rand() * 12));
  return [...months].map((month) => ({
    month,
    value: Math.round(rand() * 10 * 10) / 10,
    steepness: rand() < 0.3 ? undefined : Math.round((1 + rand() * 9) * 10) / 10,
  }));
}

// Deliberately-wrong values for schema-boundary fuzzing — this is the input
// space a hand-rolled runtime guard (the old clamp()) turned out NOT to
// cover, despite three rounds of review: not just extreme numbers, but every
// non-number JS shape a dropped JSON key or a NULL DB column actually
// produces.
const WRONG_TYPE_VALUES: unknown[] = [NaN, undefined, null, 'five', true, false, [], {}, () => 5, Symbol('x')];

describe('ease', () => {
  it('is exactly linear at k=1', () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(ease(t, 1)).toBeCloseTo(t, 10);
    }
  });

  it('clamps to 0/1 at the boundaries regardless of k', () => {
    expect(ease(0, 9)).toBe(0);
    expect(ease(1, 9)).toBe(1);
    expect(ease(-0.5, 9)).toBe(0);
    expect(ease(1.5, 9)).toBe(1);
  });

  it('never returns NaN even at extreme k where both branches underflow', () => {
    // t=0.5 at very high k underflows both t^k and (1-t)^k to 0 in floating
    // point — this used to divide 0/0. Confirms the sum===0 guard fires.
    for (const k of [50, 200, 1000, 5000]) {
      const v = ease(0.5, k);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('sliderCurveSchema / parseSliderCurve — the validation boundary', () => {
  it('accepts a valid curve and parseSliderCurve returns it usable by curveValue', () => {
    const curve = parseSliderCurve({ anchors: [{ month: 1, value: 8 }] });
    expect(curveValue(1, curve)).toBe(8);
  });

  it('rejects duplicate months', () => {
    expect(() => parseSliderCurve({ anchors: [{ month: 5, value: 2 }, { month: 5, value: 8 }] })).toThrow();
  });

  it('rejects an empty anchor list', () => {
    expect(() => parseSliderCurve({ anchors: [] })).toThrow();
  });

  it('rejects out-of-range month/value/steepness', () => {
    expect(() => anchorSchema.parse({ month: 0, value: 5 })).toThrow();
    expect(() => anchorSchema.parse({ month: 13, value: 5 })).toThrow();
    expect(() => anchorSchema.parse({ month: 1.5, value: 5 })).toThrow(); // non-integer month
    expect(() => anchorSchema.parse({ month: 1, value: -1 })).toThrow();
    expect(() => anchorSchema.parse({ month: 1, value: 11 })).toThrow();
    expect(() => anchorSchema.parse({ month: 1, value: Infinity })).toThrow();
    expect(() => anchorSchema.parse({ month: 1, value: 5, steepness: 0 })).toThrow();
    expect(() => anchorSchema.parse({ month: 1, value: 5, steepness: 11 })).toThrow();
  });

  it('rejects every non-number shape for month/value/steepness — the exact class that bypassed the old runtime clamp()', () => {
    for (const bad of WRONG_TYPE_VALUES) {
      expect(anchorSchema.safeParse({ month: bad, value: 5 }).success).toBe(false);
      expect(anchorSchema.safeParse({ month: 1, value: bad }).success).toBe(false);
      if (bad !== undefined) {
        // steepness is optional, so `undefined` is legitimately valid there.
        expect(anchorSchema.safeParse({ month: 1, value: 5, steepness: bad }).success).toBe(false);
      }
    }
  });

  it('rejects malformed container shapes — missing anchors, non-array anchors, non-object curve', () => {
    for (const bad of [{}, { anchors: null }, { anchors: 'nope' }, { anchors: [null] }, { anchors: [{}] }, null, undefined, 'nope', 5]) {
      expect(sliderCurveSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('parseSliderCurve throws a structured, field-naming error rather than a generic TypeError', () => {
    try {
      parseSliderCurve({ anchors: [{ month: 999, value: 5 }] });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toMatch(/month/i);
    }
  });
});

describe('curveValue — worked examples from the design doc', () => {
  it('flat single anchor holds all year (Museums — NYC)', () => {
    expect(monthly(makeCurve([{ month: 1, value: 8 }]))).toEqual(new Array(12).fill(8));
  });

  it('Aurora Chasing — Denali: Jul:1 -> Jan:9, k=2', () => {
    const m = monthly(makeCurve([
      { month: 7, value: 1, steepness: 2 },
      { month: 1, value: 9, steepness: 2 },
    ]));
    expect(m[0]).toBe(9); // January
    expect(m[6]).toBe(1); // July
    expect(m[3]).toBeGreaterThan(m[6]); // April sits strictly between the two anchors
    expect(m[3]).toBeLessThan(m[0]);
  });

  it('an anchor evaluates to exactly its own authored value', () => {
    const curve = makeCurve([
      { month: 3, value: 4.5, steepness: 6 },
      { month: 9, value: 7.5, steepness: 2 },
    ]);
    expect(curveValue(3, curve)).toBe(4.5);
    expect(curveValue(9, curve)).toBe(7.5);
  });

  it('asymmetric steepness: steep rise, gentle linear fall from the same peak', () => {
    const curve = makeCurve([
      { month: 1, value: 1, steepness: 9 },
      { month: 4, value: 9, steepness: 9 },
      { month: 10, value: 1, steepness: 1 },
    ]);
    const m = monthly(curve);
    // Rise (Jan->Apr, k owned by Apr=9) should already be near-peak by month 3.
    expect(m[2]).toBeGreaterThan(8);
    // Fall (Apr->Oct, k owned by Oct=1) is exactly linear: equal steps.
    // Use raw (unrounded) curveValue here — monthly() rounds to 3dp for
    // readability, which is coarser than the precision this check needs.
    const raw = [4, 5, 6, 7, 8, 9, 10].map((mo) => curveValue(mo, curve));
    const steps = raw.slice(0, -1).map((v, i) => v - raw[i + 1]);
    for (const s of steps) expect(s).toBeCloseTo(steps[0], 9);
  });

  it('steepness belongs to the destination anchor, not an average of both', () => {
    const gentle = monthly(makeCurve([
      { month: 7, value: 1, steepness: 2 },
      { month: 1, value: 9, steepness: 2 },
    ]));
    const steep = monthly(makeCurve([
      { month: 7, value: 1, steepness: 7 },
      { month: 1, value: 9, steepness: 7 },
    ]));
    // Both pass through the same two anchors but differ off the exact midpoint
    // (at t=0.5 the symmetric ease() collapses to 0.5 for every k, so that
    // point alone can't distinguish steepness — March (t=1/3) can).
    expect(gentle[0]).toBe(steep[0]);
    expect(gentle[6]).toBe(steep[6]);
    expect(gentle[2]).not.toBeCloseTo(steep[2], 3);
  });
});

describe('curveValue / crowdsScore — the query month is validated (real domain logic, not input repair)', () => {
  const curve = makeCurve([{ month: 1, value: 0 }, { month: 7, value: 10 }]);

  it('wraps an out-of-range integer month onto the 1-12 calendar instead of throwing or drifting', () => {
    expect(curveValue(14, curve)).toBe(curveValue(2, curve)); // one year forward
    expect(curveValue(0, curve)).toBe(curveValue(12, curve)); // one step back
    expect(curveValue(-12, curve)).toBe(curveValue(12, curve)); // a full year back
    expect(curveValue(25, curve)).toBe(curveValue(1, curve)); // two years forward
  });

  it('throws a clear error for a non-finite or non-integer month, in both curveValue and crowdsScore', () => {
    for (const bad of [NaN, Infinity, -Infinity, 3.5]) {
      expect(() => curveValue(bad, curve)).toThrow(/finite integer/);
    }
    const curves = { a: curve };
    expect(() => crowdsScore(curves, [], NaN)).toThrow(/finite integer/);
  });

  it('crowdsScore wraps an out-of-range month the same way curveValue does', () => {
    const curves = { a: makeCurve([{ month: 1, value: 2, steepness: 2 }, { month: 7, value: 9, steepness: 2 }]) };
    expect(crowdsScore(curves, [], 24)).toBe(crowdsScore(curves, [], 12));
    expect(crowdsScore(curves, [], 0)).toBe(crowdsScore(curves, [], 12));
  });
});

describe('crowdsScore / dealsScore', () => {
  it('returns the neutral midpoint when every slider is N/A', () => {
    const curves = { museums: makeCurve([{ month: 1, value: 8 }]) };
    expect(crowdsScore(curves, ['museums'], 6)).toBe(5);
  });

  it('skips a flat slider instead of dividing by zero range', () => {
    const curves = { museums: makeCurve([{ month: 1, value: 8 }]) };
    expect(crowdsScore(curves, [], 6)).toBe(5);
  });

  it('stays within [0, 10] even for a single, sharply-spiking, sparsely-covered slider', () => {
    const curves = {
      raresport: makeCurve([
        { month: 1, value: 0.2, steepness: 9 },
        { month: 6, value: 10, steepness: 9 },
        { month: 7, value: 0.2, steepness: 9 },
      ]),
    };
    for (let m = 1; m <= 12; m++) {
      const c = crowdsScore(curves, [], m);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(10);
    }
  });

  it('a wide-swinging slider and a near-flat slider contribute on the same relative scale', () => {
    const curves = {
      aurora: makeCurve([
        { month: 7, value: 1, steepness: 2 },
        { month: 1, value: 9, steepness: 2 },
      ]),
      museums: makeCurve([{ month: 1, value: 8 }]),
    };
    // museums is flat (skipped entirely); January is aurora's own peak —
    // busier than typical, so it should read as the WORSE month for
    // avoiding crowds (lower score) than July, aurora's own off-season.
    const jan = crowdsScore(curves, [], 1);
    const jul = crowdsScore(curves, [], 7);
    expect(jan).toBeLessThan(jul);
  });

  it('a below-average month scores above the neutral midpoint (good for avoiding crowds), not below it', () => {
    // "Avoiding Crowds" is a positive-framed slider: a quiet month scores
    // HIGH. Getting this sign backwards was a real bug caught by comparing
    // against the old formula's real output in Phase 3 — see the doc
    // comment on seasonalQuietness in curve.ts.
    const curves = {
      hiking: makeCurve([
        { month: 1, value: 2, steepness: 2 },
        { month: 7, value: 9, steepness: 2 },
      ]),
    };
    expect(crowdsScore(curves, [], 1)).toBeGreaterThan(5); // hiking's own quiet month
    expect(crowdsScore(curves, [], 7)).toBeLessThan(5); // hiking's own peak month
  });

  it('dealsScore and crowdsScore are the same underlying signal, not inverses', () => {
    // The current formula engine computes deals/crowds from one identical
    // code path (destinations.ts's `case 'deals': case 'crowds':`) — an
    // earlier draft here modeled them as 10-complements instead, which
    // doesn't match. See seasonalQuietness's doc comment.
    const curves = {
      aurora: makeCurve([
        { month: 7, value: 1, steepness: 2 },
        { month: 1, value: 9, steepness: 2 },
      ]),
    };
    for (const m of [1, 4, 7, 10]) {
      expect(dealsScore(curves, [], m)).toBe(crowdsScore(curves, [], m));
    }
  });
});

describe('property fuzzing — curveValue over the schema-guaranteed-valid domain', () => {
  const ITERATIONS = 5000;

  it('holds across random valid anchor sets and random query months', () => {
    const rand = mulberry32(42);
    for (let i = 0; i < ITERATIONS; i++) {
      const curve = makeCurve(randomValidAnchors(rand));
      const month = 1 + Math.floor(rand() * 12);
      const v = curveValue(month, curve);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('every anchor evaluates to exactly its own value, across random anchor sets', () => {
    const rand = mulberry32(1337);
    for (let i = 0; i < ITERATIONS; i++) {
      const anchors = randomValidAnchors(rand);
      const curve = makeCurve(anchors);
      for (const a of anchors) {
        expect(curveValue(a.month, curve)).toBeCloseTo(a.value, 9);
      }
    }
  });

  it('interpolated values never overshoot outside [min(anchor values), max(anchor values)]', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < ITERATIONS; i++) {
      const anchors = randomValidAnchors(rand);
      const curve = makeCurve(anchors);
      const values = anchors.map((a) => a.value);
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      for (let m = 1; m <= 12; m++) {
        const v = curveValue(m, curve);
        expect(v).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(v).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
  });

  it('holds when the query month is a random out-of-range (but finite integer) value', () => {
    const rand = mulberry32(555);
    for (let i = 0; i < ITERATIONS; i++) {
      const anchors = randomValidAnchors(rand);
      const curve = makeCurve(anchors);
      const wildMonth = Math.floor((rand() - 0.5) * 4000); // can be very negative or very positive
      const v = curveValue(wildMonth, curve);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
      // Wrapping must be consistent: the same wild month always resolves to
      // the same canonical 1-12 month's value.
      const canonical = (((wildMonth - 1) % 12) + 12) % 12 + 1;
      expect(v).toBe(curveValue(canonical, curve));
    }
  });

  it('throws, never silently corrupts, when the query month is non-finite or non-integer', () => {
    const rand = mulberry32(777);
    const badMonths = [NaN, Infinity, -Infinity, 0.5, 3.3];
    for (let i = 0; i < ITERATIONS / 10; i++) {
      const curve = makeCurve(randomValidAnchors(rand));
      const bad = badMonths[Math.floor(rand() * badMonths.length)];
      expect(() => curveValue(bad, curve)).toThrow();
    }
  });
});

describe('property fuzzing — the schema boundary rejects every malformed shape, not just extreme numbers', () => {
  // This is the fuzz coverage a hand-rolled runtime guard turned out not to
  // have: rounds 3-4 only ever generated extreme-but-legitimate numbers and
  // literal NaN. Malformed non-number values (undefined, null, strings,
  // booleans, objects, arrays) are exactly what a dropped JSON key or a NULL
  // database column actually produce, and none of those were ever fuzzed
  // against the old inline clamp()/dedupe logic. Now that validation lives
  // entirely in the schema, fuzzing belongs here instead.
  it('anchorSchema rejects every combination of a wrong-type field, over many random field/value pairs', () => {
    const rand = mulberry32(2468);
    const fields = ['month', 'value', 'steepness'] as const;
    for (let i = 0; i < 3000; i++) {
      const field = fields[Math.floor(rand() * fields.length)];
      const badValue = WRONG_TYPE_VALUES[Math.floor(rand() * WRONG_TYPE_VALUES.length)];
      const anchor: Record<string, unknown> = { month: 1, value: 5, steepness: 2, [field]: badValue };
      const result = anchorSchema.safeParse(anchor);
      if (field === 'steepness' && badValue === undefined) {
        expect(result.success).toBe(true); // steepness is legitimately optional
      } else {
        expect(result.success).toBe(false);
      }
    }
  });

  it('sliderCurveSchema rejects random malformed container shapes', () => {
    const rand = mulberry32(3141);
    const malformations: Array<(valid: unknown) => unknown> = [
      () => ({}),
      () => ({ anchors: null }),
      () => ({ anchors: 'nope' }),
      (valid) => ({ anchors: [null, ...(valid as { anchors: unknown[] }).anchors] }),
      (valid) => ({ anchors: [...(valid as { anchors: unknown[] }).anchors, (valid as { anchors: unknown[] }).anchors[0]] }), // forces a duplicate month
      () => null,
      () => undefined,
      () => 'nope',
      () => 42,
    ];
    for (let i = 0; i < 1000; i++) {
      const validAnchors = randomValidAnchors(rand);
      const valid = { anchors: validAnchors };
      const malform = malformations[Math.floor(rand() * malformations.length)];
      const bad = malform(valid);
      expect(sliderCurveSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('property fuzzing — crowdsScore / dealsScore always in range', () => {
  it('holds across random multi-slider curve sets', () => {
    const rand = mulberry32(2024);
    for (let i = 0; i < 1000; i++) {
      const sliderCount = 1 + Math.floor(rand() * 8);
      const curves: Record<string, SliderCurve> = {};
      const naSliders: string[] = [];
      for (let s = 0; s < sliderCount; s++) {
        const key = `slider${s}`;
        curves[key] = makeCurve(randomValidAnchors(rand));
        if (rand() < 0.4) naSliders.push(key);
      }
      const month = 1 + Math.floor(rand() * 12);
      const crowds = crowdsScore(curves, naSliders, month);
      const deals = dealsScore(curves, naSliders, month);
      expect(Number.isFinite(crowds)).toBe(true);
      expect(crowds).toBeGreaterThanOrEqual(0);
      expect(crowds).toBeLessThanOrEqual(10);
      expect(deals).toBe(crowds); // same underlying signal, not inverses — see seasonalQuietness
    }
  });
});
