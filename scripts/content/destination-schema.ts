import { z } from 'zod';
import { SLIDERS, BAND_DIMENSIONS } from '../../src/lib/scoring/constants';

// Derived from the app's own constants, never hardcoded — a slider
// rename/add/remove in constants.ts automatically flows through to what
// this schema accepts, instead of a second copy of the key list silently
// drifting out of sync with the one the scoring engine actually reads.
//
// The pieces below are exported so src/lib/admin/destination-scoring-schema.ts
// (the admin slider-score editor's validation) can reuse the exact same
// rules a JSON-authored destination is held to, rather than a second,
// hand-copied set of invariants that could quietly drift out of sync with
// this one.
export const SLIDER_KEYS = SLIDERS.map((s) => s.key);
export const sliderKeyEnum = z.enum(SLIDER_KEYS as [string, ...string[]]);

// 'deals'/'crowds' are computed purely from peak/low flags — the
// base-undefined bail-out in deriveDestinationScores explicitly skips
// them, so no destination ever authors a base value for these two.
// 'luxuryLodging' (formula 'luxury') was mid-rollout during initial
// authoring (excluded here so the importer's collect-all-errors-first
// validation didn't block every file until all 150 were backfilled) — now
// that every destination has a real authored score, it's required like
// every other slider key.
export const REQUIRED_BASE_KEYS = SLIDERS.filter(
  (s) => s.formula !== 'deals' && s.formula !== 'crowds',
).map((s) => s.key);

const bandKeysByDimension: Record<string, string[]> = Object.fromEntries(
  BAND_DIMENSIONS.map((d) => [d.key, d.bands.map((b) => b.key)]),
);

export const month = z.int().min(1).max(12);
export const monthArray = z.array(month).default([]);

// `base`/`sliderCaps` values: authored scores, not the post-formula
// clamped output — 0-10 is still the sane authoring range every existing
// destination uses.
export const score0to10 = z.number().min(0).max(10);

export const severityEnum = z.enum(['mild', 'moderate', 'severe']);

// SliderEvent.weight is a direct point value (not a 0-1 fraction, see the
// type comment in scoring/types.ts), so no natural upper bound — but every
// real weight in the existing dataset is 1-7, so a generous cap of 10
// still catches an obvious order-of-magnitude typo (e.g. 70 for 7) without
// blocking legitimate authoring.
const eventWeight = z.number().positive().max(10);

// SliderEvent.months intensity: 0-1 by design (see the type comment).
const eventIntensity = z.number().min(0).max(1);

// $–$$$$$, the regional-cost-level scale — see
// docs/content/cost-scoring-methodology.md for the full ruleset ($100/
// $200/$400/$800 breakpoints, non-peak anchoring, the boundary-case
// tiebreaker). Deliberately separate from budgetBands (style available)
// and luxuryLodging (depth/quality at the top end) — three different
// questions, three different fields.
const costTier = z.enum(['$', '$$', '$$$', '$$$$', '$$$$$']);

const costItemSchema = z.object({
  label: z.string().min(1),
  price: z.number().positive(),
  // Only ever a short unit qualifier (per person / per vehicle / per
  // boat / per day) — never an explanatory note. See the methodology
  // doc: real one-time prices, sorted low to high, no annotations.
  unit: z.string().default(''),
  // Admin-set icon override; falls back to costItemIcon(label) when absent.
  emoji: z.string().min(1).optional(),
});

export const sliderEventSchema = z.object({
  label: z.string().min(1),
  weight: eventWeight,
  months: z.record(z.string(), eventIntensity).superRefine((months, ctx) => {
    for (const key of Object.keys(months)) {
      const m = Number(key);
      if (!Number.isInteger(m) || m < 1 || m > 12) {
        ctx.addIssue({ code: 'custom', message: `sliderEvents month key must be 1-12, got "${key}"` });
      }
    }
  }),
});

/** A record whose keys must all be real slider keys — used by sliderCaps,
 * sliderEvents, and activityStyleTiers, each sparse by design (an absent
 * slider key is "not authored", not an error). */
export function sliderKeyedRecord<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.record(z.string(), valueSchema).superRefine((rec, ctx) => {
    for (const key of Object.keys(rec)) {
      if (!SLIDER_KEYS.includes(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `"${key}" is not a real slider key. Valid keys: ${SLIDER_KEYS.join(', ')}`,
        });
      }
    }
  });
}

function bandArray(dimensionKey: 'budget' | 'vibe' | 'physical') {
  const validKeys = bandKeysByDimension[dimensionKey];
  return z
    .array(z.string())
    .default([])
    .superRefine((arr, ctx) => {
      for (const key of arr) {
        if (!validKeys.includes(key)) {
          ctx.addIssue({
            code: 'custom',
            message: `"${key}" is not a valid ${dimensionKey} band. Valid keys: ${validKeys.join(', ')}`,
          });
        }
      }
    });
}

export const destinationSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be lowercase letters/digits/hyphens only, e.g. "grand-canyon"'),
    name: z.string().min(1),
    region: z.string().min(1),
    emoji: z.string().min(1),
    climate: z.enum(['tropical', 'desert', 'mediterranean', 'temperate', 'highland', 'polar']),
    // The seasonal-pattern summary — always visible above the month chart,
    // unchanged in meaning from before this field split. Distinct from
    // `overview` below: this is "when/why the seasons matter here", not
    // "why go here at all".
    about: z.string().min(1),
    // One-sentence, evergreen "why go here" pitch for the About tab.
    // Optional/nullable so destinations without it yet fall back to
    // `about` in the UI rather than rendering blank.
    overview: z.string().min(1).nullable().default(null),

    // Regional cost floor–ceiling on the $–$$$$$ scale — absent (null)
    // means no cost data authored yet; the UI hides the cost pill/tab
    // entirely rather than showing a fake range.
    costRange: z
      .object({ min: costTier, max: costTier })
      .nullable()
      .default(null),
    // One-sentence texture on what costs are actually like for a traveler
    // here — shown on the Cost tab, above the itemized price list. This is
    // where region-specific cost color belongs (e.g. "a real budget option
    // exists" or "even modest rooms run high") — it must NOT duplicate
    // `overview`, which stays scoped to why someone would go at all, not
    // what it costs.
    costOverview: z.string().min(1).nullable().default(null),
    // Real one-time (or genuine per-day-rate) prices, sorted low to high
    // by the author — never amortized, never annotated. Empty by default.
    costItems: z.array(costItemSchema).default([]),

    // Every real slider key must be present — a MISSING key silently
    // scores 0 all year (see the base-undefined bail-out in
    // deriveDestinationScores), which is exactly the class of bug this
    // schema exists to catch before it reaches the database.
    base: z
      .record(z.string(), score0to10)
      .superRefine((base, ctx) => {
        const present = new Set(Object.keys(base));
        for (const key of REQUIRED_BASE_KEYS) {
          if (!present.has(key)) {
            ctx.addIssue({ code: 'custom', message: `base is missing required slider key "${key}"` });
          }
        }
        for (const key of present) {
          if (!SLIDER_KEYS.includes(key)) {
            ctx.addIssue({ code: 'custom', message: `base has unknown slider key "${key}"` });
          }
        }
      }),

    budgetBands: bandArray('budget'),
    vibeBands: bandArray('vibe'),
    physicalBands: bandArray('physical'),

    dry: monthArray,
    wet: monthArray,
    hot: monthArray,
    cold: monthArray,
    peak: monthArray,
    low: monthArray,
    peakIntensity: z.enum(['mild', 'moderate', 'extreme']).nullable().default(null),
    crowdBaseline: z.enum(['low', 'high']).nullable().default(null),

    // How severe the hot/cold/wet flags above genuinely are — absent
    // (null) behaves like 'moderate', today's flat pre-existing behavior.
    hotSeverity: severityEnum.nullable().default(null),
    coldSeverity: severityEnum.nullable().default(null),
    wetSeverity: severityEnum.nullable().default(null),

    seasonalHazards: z
      .array(
        z.object({
          category: z.enum(['storm', 'airQuality', 'insects', 'seaweed', 'other']),
          label: z.string().min(1),
          months: z.array(month),
          severity: severityEnum,
          affectedSliders: z.array(sliderKeyEnum).min(1),
        }),
      )
      .default([]),

    wildlifePeak: monthArray,
    wildlifeClosed: monthArray,
    birdingPeak: monthArray,
    hikingBest: monthArray,
    hikingWorst: monthArray,
    inaccessible: monthArray,
    swimHazard: monthArray,
    noSnow: monthArray,

    sliderCaps: sliderKeyedRecord(score0to10).default({}),
    sliderEvents: sliderKeyedRecord(z.array(sliderEventSchema)).default({}),

    // NOTE: a real past bug — this is a boolean flag combined with
    // low_months at read time, not a month array. z.boolean() rejects an
    // array outright, which is the whole point.
    shopClosures: z.boolean().default(false),

    specialSeasons: z
      .array(z.object({ months: z.array(month), text: z.string().min(1) }))
      .default([]),

    // Index 0 = January. Either fully absent, or exactly 12 entries — a
    // partial array silently misaligns every month after the gap.
    monthlyWeather: z
      .array(z.string().nullable())
      .length(12, 'monthlyWeather must have exactly 12 entries (index 0 = January) if present')
      .nullable()
      .default(null),

    naSliders: z
      .array(sliderKeyEnum)
      .default([]),

    searchAliases: z.array(z.string()).default([]),

    // Outer key must be a real slider; inner style-option keys aren't
    // validated against DOMAIN_CORE_AXES here — only 2 of 27 sliders have
    // a defined axis today, and hardcoding that narrow, still-growing
    // mapping into a content schema would block legitimate future axes.
    activityStyleTiers: sliderKeyedRecord(z.record(z.string(), z.enum(['signature', 'strong', 'casual', 'none'])))
      .default({}),

    // Destination-level identity prominence per slider (not per sub-style —
    // see the schema.ts column comment for how this differs from
    // activityStyleTiers). Plumbing only for now: not yet read by the
    // scoring engine.
    signatureTier: sliderKeyedRecord(z.enum(['signature', 'strong', 'casual', 'none'])).default({}),
  })
  .strict();

export type DestinationContent = z.infer<typeof destinationSchema>;

/** Formats a zod error into one message per line, prefixed with the
 * destination id when known — meant for collecting every problem across a
 * whole batch before failing, not stopping at the first file. */
export function formatValidationErrors(id: string | undefined, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    return `[${id ?? '?'}] ${path}: ${issue.message}`;
  });
}
