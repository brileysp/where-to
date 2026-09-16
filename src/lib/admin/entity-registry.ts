import { z } from 'zod';
import { places, interestMeta, climateEnum, peakIntensityEnum, crowdBaselineEnum, severityEnum } from '@/lib/db/schema';
import { BAND_DIMENSIONS } from '@/lib/scoring/constants';
import { sliderCurveSchema } from '@/lib/scoring/curve';
import { monthArray, month, sliderKeyedRecord } from '../../../scripts/content/destination-schema';

/**
 * Per-entity-type write registry for applyAdminEdits (see apply-edits.ts).
 * Adding a new grid screen against an existing entity type (or a whole new
 * entity type) means adding fields/validators here — the batched-save
 * action itself never needs bespoke per-field logic.
 */

const bandKeysByDimension: Record<string, string[]> = Object.fromEntries(
  BAND_DIMENSIONS.map((d) => [d.key, d.bands.map((b) => b.key)]),
);

function bandArray(dimensionKey: 'budget' | 'vibe' | 'physical') {
  const validKeys = bandKeysByDimension[dimensionKey];
  return z.array(z.string().refine((k) => validKeys.includes(k), { message: `not a valid ${dimensionKey} band` }));
}

const costItemSchema = z.object({
  label: z.string().min(1),
  price: z.number().nonnegative(),
  unit: z.string().default(''),
  // Items authored before the emoji field existed (or via the content
  // scripts) have no emoji key in the DB at all; the client reads that as
  // `null` (CostItemsGrid maps `c.emoji ?? null`), not `undefined` — Zod's
  // `.optional()` only allows the key to be missing/undefined, NOT an
  // explicit null, so every edit to one of those items failed validation
  // until `.nullable()` was added here.
  emoji: z.string().min(1).nullable().optional(),
});

const nullableEnum = <T extends [string, ...string[]]>(values: T) => z.enum(values).nullable();

export interface FieldValidator {
  parse(raw: unknown): { ok: true; value: unknown } | { ok: false; message: string };
}

function zodField(schema: z.ZodType): FieldValidator {
  return {
    parse(raw) {
      const result = schema.safeParse(raw);
      if (!result.success) {
        const issue = result.error.issues[0];
        // Prefix the path (e.g. "2.label") so a failure deep inside an
        // array/object field — a blank-labeled cost item, say — says
        // exactly which entry is the problem, not just "invalid value".
        const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
        return { ok: false, message: `${path}${issue?.message ?? 'invalid value'}` };
      }
      return { ok: true, value: result.data };
    },
  };
}

export interface EntityConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  idColumn: string;
  fields: Record<string, FieldValidator>;
}

export const ENTITY_REGISTRY: Record<string, EntityConfig> = {
  destination: {
    // Place migration Phase 4 completed: admin writes now land on `places`
    // directly, same table the public page reads. `destinations` is frozen
    // (kept only until Phase 6 drops it), not a write target anymore.
    table: places,
    idColumn: 'id',
    fields: {
      name: zodField(z.string().trim().min(1)),
      region: zodField(z.string().trim().min(1)),
      emoji: zodField(z.string().trim().min(1)),
      climate: zodField(z.enum(climateEnum.enumValues)),
      // Note the DB naming inversion vs. the admin grid's column labels:
      // `about` is the seasons-pattern summary, `overview` is the short
      // identity/"why go here" blurb (see schema.ts's own doc comments).
      about: zodField(z.string().trim().min(1)),
      overview: zodField(z.string().trim().nullable()),
      costMin: zodField(z.enum(['$', '$$', '$$$', '$$$$', '$$$$$']).nullable()),
      costMax: zodField(z.enum(['$', '$$', '$$$', '$$$$', '$$$$$']).nullable()),
      costOverview: zodField(z.string().trim().nullable()),
      costItems: zodField(z.array(costItemSchema)),
      peakIntensity: zodField(nullableEnum(peakIntensityEnum.enumValues)),
      crowdBaseline: zodField(nullableEnum(crowdBaselineEnum.enumValues)),
      hotSeverity: zodField(nullableEnum(severityEnum.enumValues)),
      coldSeverity: zodField(nullableEnum(severityEnum.enumValues)),
      wetSeverity: zodField(nullableEnum(severityEnum.enumValues)),
      monthlyWeather: zodField(z.array(z.string().nullable()).length(12).nullable()),
      searchAliases: zodField(z.array(z.string())),
      budgetBands: zodField(bandArray('budget')),
      vibeBands: zodField(bandArray('vibe')),
      physicalBands: zodField(bandArray('physical')),
      // Whole-object jsonb columns — the grid keeps the full destination
      // in memory and sends the complete post-edit object back for
      // whichever key changed, the same read-modify-write shape the
      // mockup itself used. Loosely typed here (validated more precisely
      // upstream by the scoring engine's own tolerant handling of sparse
      // data) rather than re-deriving SLIDERS-keyed schemas twice.
      baseScores: zodField(z.record(z.string(), z.number())),
      scoreOverrides: zodField(z.record(z.string(), z.record(z.string(), z.number()))),
      sliderCaps: zodField(z.record(z.string(), z.number())),
      sliderEvents: zodField(z.record(z.string(), z.array(z.object({ label: z.string(), weight: z.number(), months: z.record(z.string(), z.number()) })))),
      signatureTier: zodField(z.record(z.string(), z.enum(['signature', 'strong', 'casual', 'none']))),
      naSliders: zodField(z.array(z.string())),
      // Validated with the scoring engine's OWN schema rather than a
      // hand-rolled copy — sliderCurveSchema already enforces unique
      // months, the 0-10 value range and the steepness bounds, and it is
      // the single definition curveValue() trusts at read time. A second
      // definition here could drift and let an uncomputable curve through.
      sliderCurves: zodField(z.record(z.string(), sliderCurveSchema)),
      // Set automatically by applyAdminEdits whenever a curve changes, not
      // chosen by the caller; editable here so a curve can be handed back
      // to the formula by removing its key.
      authoredCurves: zodField(z.array(z.string())),
      // activityStyleTiers is genuinely keyed by slider (confirmed via
      // destination-scoring-schema.ts's use of the same sliderKeyedRecord
      // helper) — sub-style keys within it are an open DNA-attribute
      // vocabulary, not enumerable here, so those stay loosely typed.
      activityStyleTiers: zodField(sliderKeyedRecord(z.record(z.string(), z.enum(['signature', 'strong', 'casual', 'none'])))),
      // Which external page(s) were consulted to research/verify a
      // slider's content or score for this destination — see the doc
      // comment on schema.ts's sliderSources column. An array per slider
      // on purpose: real research routinely draws on more than one source.
      sliderSources: zodField(
        sliderKeyedRecord(
          z.array(
            z.object({
              url: z.string().trim().url(),
              label: z.string().trim().min(1).optional(),
              note: z.string().trim().min(1).optional(),
              addedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
            }),
          ),
        ),
      ),
      // Reusing the exact building blocks destination-scoring-schema.ts
      // already validates these with, rather than hand-rolled duplicates.
      dryMonths: zodField(monthArray),
      wetMonths: zodField(monthArray),
      hotMonths: zodField(monthArray),
      coldMonths: zodField(monthArray),
      peakMonths: zodField(monthArray),
      lowMonths: zodField(monthArray),
      wildlifePeakMonths: zodField(monthArray),
      wildlifeClosedMonths: zodField(monthArray),
      birdingPeakMonths: zodField(monthArray),
      hikingBestMonths: zodField(monthArray),
      hikingWorstMonths: zodField(monthArray),
      inaccessibleMonths: zodField(monthArray),
      swimHazardMonths: zodField(monthArray),
      noSnowMonths: zodField(monthArray),
      shopClosures: zodField(z.boolean()),
      specialSeasons: zodField(z.array(z.object({ months: z.array(month), text: z.string().min(1) }))),
      // Deliberately not read by any scoring code — see the doc comment on
      // schema.ts's travelAdvisories column.
      travelAdvisories: zodField(
        z.array(
          z.object({
            category: z.enum(['security', 'environmental', 'access', 'health', 'other']),
            severity: z.enum(['moderate', 'serious']),
            text: z.string().trim().min(1),
            lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
          }),
        ),
      ),
      // Not locked to a pg enum yet (see the doc comment on schema.ts's
      // `placeType` column) — the 10-value taxonomy from the place
      // migration's Phase 0 is still unconfirmed, so this stays free text
      // rather than a Zod enum that would need a code change to revise.
      placeType: zodField(z.string().trim().min(1).nullable()),
      // Single value today, stored as a 0-or-1-element array (see the doc
      // comment on schema.ts's `audienceBands` column) so it can slot into
      // BAND_DIMENSIONS/bandPenalty later without a schema change.
      audienceBands: zodField(z.array(z.enum(['iconic', 'popular', 'enthusiast', 'specialist'])).max(1)),
    },
  },
  interest: {
    table: interestMeta,
    idColumn: 'key',
    fields: {
      emoji: zodField(z.string().trim().min(1)),
    },
  },
};
