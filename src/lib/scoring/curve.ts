import { z } from 'zod';

/**
 * Reference implementation for the anchor-based scoring curve proposed in
 * docs/scoring-v2-proposal.html. Not yet wired into deriveDestinationScores —
 * this module exists so the algorithm is real, typed, and fuzz-tested rather
 * than an illustrative snippet embedded in a design doc.
 *
 * Architecture: validate once, at the boundary; trust the type everywhere
 * else. `parseSliderCurve` is the ONLY way to obtain a `SliderCurve` — every
 * place curve data enters the process (the admin save path, the migration
 * script's output, and reading the `sliderCurves` jsonb column back out of
 * the database) must call it before treating a value as typed. `curveValue`
 * and `crowdsScore` do zero runtime repair of anchor data; they trust the
 * schema's guarantee completely.
 *
 * An earlier version of this file took this the other way: `curveValue`
 * accepted a raw `Anchor[]` and defended itself against bad data inline —
 * deduping anchors, clamping out-of-range fields, guarding against NaN. Across
 * three rounds of review, that defense-in-depth kept being *incomplete* in a
 * new way each time (an asymmetric clamp, an unvalidated query-month
 * parameter, a NaN guard that didn't catch `undefined`/`null`/non-number
 * values, an anchor's own `month` field getting no repair at all — which
 * reopened the very duplicate-month bug the dedup logic was built to close).
 * The problem wasn't any single missed case; it was the shape of the
 * approach: "enumerate every malformed JS value and handle it inline" is a
 * search that doesn't terminate. A schema already enumerates a type
 * completely, in one declarative place, with a zod `.min()`/`.max()`/`.int()`
 * on `z.number()` rejecting NaN, `undefined`, `null`, strings, booleans, and
 * out-of-range values in one shot — see the schema tests below. Validating
 * there once, and trusting a branded `SliderCurve` everywhere after, closes
 * the whole class instead of chasing it one instance at a time.
 */

export const anchorSchema = z.object({
  month: z.number().int().min(1).max(12),
  value: z.number().min(0).max(10),
  steepness: z.number().min(1).max(10).optional(),
});

export const sliderCurveSchema = z
  .object({ anchors: z.array(anchorSchema).min(1) })
  .refine((c) => new Set(c.anchors.map((a) => a.month)).size === c.anchors.length, {
    message: 'Anchors must have unique months.',
  });

export type Anchor = z.infer<typeof anchorSchema>;
type ParsedSliderCurve = z.infer<typeof sliderCurveSchema>;

declare const VALIDATED: unique symbol;
/**
 * A SliderCurve that has passed sliderCurveSchema — anchors.length >= 1,
 * unique months, value/steepness in range, all guaranteed. The brand makes
 * it impossible to satisfy this type with a plain object literal (structural
 * typing alone isn't enough), so `curveValue`/`crowdsScore` below can trust
 * it without an explicit cast, which would be the visible red flag that this
 * invariant is being bypassed.
 */
export type SliderCurve = ParsedSliderCurve & { readonly [VALIDATED]: true };

/** The only sanctioned way to obtain a SliderCurve. Throws a structured
 * ZodError naming the exact invalid field on anything malformed. */
export function parseSliderCurve(raw: unknown): SliderCurve {
  return sliderCurveSchema.parse(raw) as SliderCurve;
}

export function ease(t: number, k: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const a = t ** k;
  const b = (1 - t) ** k;
  const sum = a + b;
  // At extreme k, both a and b can underflow to 0 for interior t, which would
  // otherwise divide 0/0 into NaN. There is no "correct" fractional answer at
  // that point (the curve has effectively become a step function) — round to
  // whichever side t is nearer, which is what an infinitely steep step does.
  if (sum === 0) return t < 0.5 ? 0 : 1;
  return a / sum;
}

/**
 * Wraps any finite integer month onto the 1-12 calendar (13 -> 1, 0 -> 12,
 * -1 -> 11, ...). This is real domain logic, not input repair: `month` is a
 * runtime query parameter (e.g. `new Date().getMonth()+1`, or "3 months from
 * November"), not persisted data covered by sliderCurveSchema, so wraparound
 * is a legitimate calendar operation, not a guess about malformed data. A
 * non-finite or non-integer month has no calendar position to wrap to, so it
 * throws rather than guessing.
 */
function normalizeMonth(month: number): number {
  if (!Number.isFinite(month) || !Number.isInteger(month)) {
    throw new Error(`normalizeMonth: month must be a finite integer, got ${month}`);
  }
  return (((month - 1) % 12) + 12) % 12 + 1;
}

/** Evaluates a slider curve for a given month. `curve` must come from
 * `parseSliderCurve` — every field is trusted as already valid. */
export function curveValue(month: number, curve: SliderCurve): number {
  const queryMonth = normalizeMonth(month);
  const anchors = curve.anchors;
  if (anchors.length === 1) return anchors[0].value;

  const sorted = [...anchors].sort((a, b) => a.month - b.month);
  for (let i = 0; i < sorted.length; i++) {
    const A = sorted[i];
    const B = sorted[(i + 1) % sorted.length];
    let spanAB = B.month - A.month;
    if (spanAB <= 0) spanAB += 12;
    let spanAm = queryMonth - A.month;
    if (spanAm < 0) spanAm += 12;
    if (spanAm <= spanAB) {
      const t = spanAm / spanAB;
      const k = B.steepness ?? 2; // B, not avg(A, B) — the destination anchor owns its own transition's steepness
      return A.value + (B.value - A.value) * ease(t, k);
    }
  }
  // Impossible by construction: the spans above partition the full 12-month
  // circle, so some bracket always matches a valid 1-12 queryMonth. This is
  // an assertion about curveValue's own correctness, not input repair — if
  // it ever fires, the bug is in this function, not in the caller's data.
  throw new Error('curveValue: no bracketing anchors found — internal invariant violated');
}

/**
 * "Avoiding Crowds" and "Low-Season Deals" are the two slider LABELS
 * (constants.ts) — both describe the same underlying "how atypically quiet
 * is this month across the destination's other curves" signal from opposite
 * words, not literal inverses of each other. Confirmed against the current
 * formula engine: destinations.ts's `case 'deals': case 'crowds':` is one
 * shared code path computing one identical value for both sliders today
 * (peak month -> 1-5, low-season month -> 9) — high score there means good
 * AT AVOIDING crowds (quiet), not "busy."
 *
 * An earlier draft of this function got the sign backwards — it computed a
 * literal busyness score (peak season -> high) and derived "deals" as its
 * 10-complement, which silently inverted what "Avoiding Crowds" actually
 * means. Phase 3's parallel-diff audit against real production data caught
 * it: scripts/audit-curve-migration-parity.ts's Part B showed dozens of
 * destinations (Raja Ampat, Bhutan, Madagascar, Ethiopia, Zimbabwe among
 * them) where the old formula's authored low-season months scored 9-10 and
 * this function's first draft scored ~2 for the exact same months — not
 * floating-point noise, a real inverted sign caught by comparing against
 * data no synthetic worked example would have surfaced.
 *
 * Each slider's deviation is measured as a fraction of *that slider's own
 * range* (max - min), not its average — dividing by average blows up
 * asymmetrically for a slider with a low average and a high peak. Dividing
 * by range instead bounds every slider's contribution to exactly [-1, 1] by
 * construction: monthly and the average both lie within [min, max], so
 * their difference can never exceed the range.
 */
function seasonalQuietness(curves: Record<string, SliderCurve>, naSliders: string[], month: number): number {
  const queryMonth = normalizeMonth(month);
  const deviations: number[] = [];
  for (const [key, curve] of Object.entries(curves)) {
    if (naSliders.includes(key)) continue;
    const monthly: number[] = [];
    for (let m = 1; m <= 12; m++) monthly.push(curveValue(m, curve));
    const min = Math.min(...monthly);
    const max = Math.max(...monthly);
    const range = max - min;
    if (range === 0) continue; // flat slider carries no signal either way
    const avg = monthly.reduce((s, v) => s + v, 0) / monthly.length;
    deviations.push((monthly[queryMonth - 1] - avg) / range);
  }
  if (deviations.length === 0) return 5; // no signal at all: neutral
  const avgDeviation = deviations.reduce((s, v) => s + v, 0) / deviations.length;
  // A month running ABOVE its sliders' typical level (avgDeviation > 0) is
  // objectively busier -- and busier means WORSE at avoiding crowds and
  // WORSE for a deal, hence the minus sign. avgDeviation is bounded to
  // exactly [-1, 1] given valid inputs (proved above) — this clamp is a
  // floating-point safety net against rounding error at the boundary, not
  // input repair, so it stays even though the per-field defensive clamping
  // elsewhere in this file did not.
  return Math.min(10, Math.max(0, 5 - avgDeviation * 5));
}

export function crowdsScore(curves: Record<string, SliderCurve>, naSliders: string[], month: number): number {
  return seasonalQuietness(curves, naSliders, month);
}

export function dealsScore(curves: Record<string, SliderCurve>, naSliders: string[], month: number): number {
  return seasonalQuietness(curves, naSliders, month);
}

/**
 * Rescale a curve so its lowest anchor sits at `newMin` and its highest at
 * `newMax`, preserving the shape between them.
 *
 * This is what makes Min and Max directly editable in the admin matrix.
 * They are not new fields — they ARE the curve's extreme anchor values, so
 * editing one is a linear remap of every anchor:
 *
 *   v' = newMin + (v - min) * (newMax - newMin) / (max - min)
 *
 * Setting Nova Scotia's wildlife max from 10 to 7 keeps its Jul-Sep whale
 * season exactly where it is and simply lowers the ceiling — which is the
 * edit the old model made impossible, because the peak was `base + a flat
 * +7 bonus` and nobody could author the result directly.
 *
 * A FLAT curve (every anchor equal) has no shape to preserve, so there is
 * no meaningful way to spread it across a new range: it stays flat, moving
 * to newMax when the caller raised the ceiling and to newMin when they
 * lowered the floor. Giving a flat curve a real peak means choosing WHICH
 * months peak, which is the anchor editor's job, not this function's.
 */
export function rescaleCurve(curve: SliderCurve, newMin: number, newMax: number): SliderCurve {
  if (!Number.isFinite(newMin) || !Number.isFinite(newMax)) {
    throw new Error(`rescaleCurve: newMin/newMax must be finite, got ${newMin}/${newMax}`);
  }
  const lo = Math.max(0, Math.min(10, Math.min(newMin, newMax)));
  const hi = Math.max(0, Math.min(10, Math.max(newMin, newMax)));

  const values = curve.anchors.map((a) => a.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Flat curve: no internal shape, so the whole thing moves as one. Prefer
  // whichever bound the caller actually moved away from the old value.
  if (max === min) {
    const flat = min === hi ? lo : hi;
    return parseSliderCurve({ anchors: curve.anchors.map((a) => ({ ...a, value: round1(flat) })) });
  }

  const span = max - min;
  return parseSliderCurve({
    anchors: curve.anchors.map((a) => ({
      ...a,
      value: round1(lo + ((a.value - min) * (hi - lo)) / span),
    })),
  });
}

/** One decimal is the finest the admin UI offers; avoids float dust in jsonb. */
function round1(v: number): number {
  return Math.round(Math.max(0, Math.min(10, v)) * 10) / 10;
}
