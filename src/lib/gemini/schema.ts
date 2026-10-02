import { z } from 'zod';

/**
 * The structured-output contract every Gemini generation call must return —
 * see docs/gemini-content-pipeline-plan.md §4. Deliberately the same field
 * granularity as the Matrix CSV export (score_jan..dec, blurb_jan..dec,
 * blurb_overall): that export already proved out the right shape for this
 * content, this just moves it from "a human pastes into a spreadsheet cell"
 * to "the API returns it directly."
 *
 * This is passed to the Gemini call as a JSON response schema (native
 * structured-output mode, not just requested in prose) — see client.ts —
 * so a malformed response is rare by construction, not just caught after
 * the fact. The Zod schema here is still the source of truth for parsing
 * the response AND for generating the JSON schema sent to the API, so the
 * two can never drift apart.
 */

export const monthEntrySchema = z.object({
  score: z.number().min(0).max(10),
  text: z.string().min(1),
});

export const generationSourceSchema = z.object({
  url: z.string(),
  note: z.string().optional(),
});

export const generationOutputSchema = z.object({
  overview: z.string().min(1),
  // Exactly 12, Jan..Dec (index 0 = January, matching MONTH_NAMES in
  // constants.ts and the score_jan/blurb_jan CSV column order).
  monthly: z.array(monthEntrySchema).length(12),
  sources: z.array(generationSourceSchema).default([]),
  confidence: z.enum(['high', 'medium', 'low']),
  flags: z.array(z.string()).default([]),
});

export type GenerationOutput = z.infer<typeof generationOutputSchema>;

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

/**
 * The flat wire schema for prompt v2+ (starting with wildlifeViewing/v2.md,
 * 2026-09-29) — score_jan/blurb_jan etc. as literal top-level keys, written
 * verbatim from the user's own "JSON Output Contract" directive rather than
 * my earlier nested {overview, monthly:[{score,text}]} shape. Normalized
 * into that same internal GenerationOutput below immediately after
 * parsing (see normalizeFlatOutput) — validate.ts, apply.ts, and
 * pipeline-diff/apply all keep working on one stable internal shape no
 * matter which wire format a given prompt version actually used, so a v1
 * and a v2 generation for the same place stay directly comparable.
 *
 * Deliberately excludes sources/confidence/flags: the user's own contract
 * doesn't ask Gemini for them, and asking anyway would contradict the
 * prompt's own "output strictly valid JSON matching this schema" — they're
 * defaulted to neutral values in normalizeFlatOutput instead. Real
 * consequence worth knowing: no per-generation self-reported uncertainty
 * signal for v2+ generations, unlike v1's.
 */
const scoreField = () => z.number().min(0).max(10);
const blurbField = () => z.string().min(1);

export const generationOutputSchemaFlatV2 = z.object({
  score_max: scoreField(),
  score_min: scoreField(),
  score_jan: scoreField(),
  score_feb: scoreField(),
  score_mar: scoreField(),
  score_apr: scoreField(),
  score_may: scoreField(),
  score_jun: scoreField(),
  score_jul: scoreField(),
  score_aug: scoreField(),
  score_sep: scoreField(),
  score_oct: scoreField(),
  score_nov: scoreField(),
  score_dec: scoreField(),
  blurb_overall: blurbField(),
  blurb_jan: blurbField(),
  blurb_feb: blurbField(),
  blurb_mar: blurbField(),
  blurb_apr: blurbField(),
  blurb_may: blurbField(),
  blurb_jun: blurbField(),
  blurb_jul: blurbField(),
  blurb_aug: blurbField(),
  blurb_sep: blurbField(),
  blurb_oct: blurbField(),
  blurb_nov: blurbField(),
  blurb_dec: blurbField(),
});

export type GenerationOutputFlatV2 = z.infer<typeof generationOutputSchemaFlatV2>;

const SCORE_KEYS_IN_ORDER = MONTH_KEYS.map((k) => `score_${k}` as const);
const BLURB_KEYS_IN_ORDER = MONTH_KEYS.map((k) => `blurb_${k}` as const);

/** Converts the flat v2 wire shape into the stable internal GenerationOutput,
 * and separately reports a self-consistency check the flat shape makes
 * possible for free: does Gemini's own declared score_max/score_min
 * actually match the max/min of the 12 scores it just gave? A mismatch is a
 * real internal-arithmetic mistake on the model's part, not a judgment
 * call — surfaced as issues for the caller to fold into validation (kept
 * separate from validateContent's own checks since those operate on the
 * normalized shape, which no longer carries the model's own declared
 * max/min once flattened away). */
export function normalizeFlatOutput(flat: GenerationOutputFlatV2): { output: GenerationOutput; selfCheckIssues: string[] } {
  const monthly = MONTH_KEYS.map((_, i) => ({
    score: flat[SCORE_KEYS_IN_ORDER[i]],
    text: flat[BLURB_KEYS_IN_ORDER[i]],
  }));
  const actualMax = Math.max(...monthly.map((m) => m.score));
  const actualMin = Math.min(...monthly.map((m) => m.score));
  const selfCheckIssues: string[] = [];
  if (Math.abs(flat.score_max - actualMax) > 0.05) {
    selfCheckIssues.push(`Declared score_max ${flat.score_max} doesn't match the actual max of the 12 monthly scores (${actualMax})`);
  }
  if (Math.abs(flat.score_min - actualMin) > 0.05) {
    selfCheckIssues.push(`Declared score_min ${flat.score_min} doesn't match the actual min of the 12 monthly scores (${actualMin})`);
  }
  return {
    output: { overview: flat.blurb_overall, monthly, sources: [], confidence: 'high', flags: [] },
    selfCheckIssues,
  };
}

export const GENERATION_KINDS = ['author', 'correct', 'wishlist'] as const;
export type GenerationKind = (typeof GENERATION_KINDS)[number];

/**
 * The context payload sent to Gemini alongside the prompt — everything it
 * needs to know about a specific (place, interest) pair without querying
 * the database itself. Hashed (sha256, see hashing.ts) and stored on the
 * content_generations row as input_context_hash, so a past generation's
 * exact input is provable even though this object itself isn't persisted
 * verbatim (it's large and mostly reconstructable; the hash is what matters
 * for proving what was sent, not archiving the payload a second time).
 */
export interface GenerationContext {
  placeId: string;
  placeName: string;
  region: string;
  about: string | null;
  interestKey: string;
  interestLabel: string;
  /** Existing curve-derived monthly scores, if this interest already has any
   * (a 'correct' pass) — omitted entirely for first-time 'author' calls. */
  existingMonthly?: number[];
  /** Already-authored content for OTHER interests at this place, so Gemini
   * doesn't restate a claim another slider already owns (playbook §2's
   * overlap rule) — kept short (label + first sentence of overview only). */
  relatedInterestSummaries: Array<{ interestKey: string; label: string; firstSentence: string }>;
}
