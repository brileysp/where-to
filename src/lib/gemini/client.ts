import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { generationOutputSchema, generationOutputSchemaFlatV2, generationOutputSchemaFlatV2Fit, generationOutputSchemaFlatV2Surf, generationOutputSchemaFlatV2Hike, normalizeFlatOutput, type GenerationOutput } from './schema';

/**
 * The Gemini response schema, hand-written to mirror generationOutputSchema
 * (schema.ts) exactly, in the subset of JSON Schema Gemini's structured-
 * output mode accepts (its own `Type` enum, not arbitrary JSON Schema).
 * Kept in sync by hand rather than auto-derived from the Zod schema: there
 * is no well-maintained zod-to-Gemini-schema converter, and a hand-written
 * literal here is exactly as auditable as the Zod schema itself — both are
 * short. If you change one, change the other in the same commit; the Zod
 * schema.parse() call in generate() below is what actually catches drift
 * between the two at runtime (a response Gemini's own schema allowed but
 * Zod rejects means this file and schema.ts disagree).
 */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overview: { type: Type.STRING },
    monthly: {
      type: Type.ARRAY,
      minItems: '12',
      maxItems: '12',
      items: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          text: { type: Type.STRING },
        },
        required: ['score', 'text'],
      },
    },
    sources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING },
          note: { type: Type.STRING },
        },
        required: ['url'],
      },
    },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    flags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['overview', 'monthly', 'confidence'],
};

/**
 * The v2+ flat wire schema (schema.ts's generationOutputSchemaFlatV2),
 * written verbatim from the user's own JSON Output Contract directive
 * (wildlifeViewing/v2.md, 2026-09-29) — score_jan/blurb_jan etc. as literal
 * top-level fields. Same hand-sync discipline as RESPONSE_SCHEMA above.
 */
const RESPONSE_SCHEMA_FLAT_V2 = {
  type: Type.OBJECT,
  properties: {
    score_max: { type: Type.NUMBER },
    score_min: { type: Type.NUMBER },
    score_jan: { type: Type.NUMBER },
    score_feb: { type: Type.NUMBER },
    score_mar: { type: Type.NUMBER },
    score_apr: { type: Type.NUMBER },
    score_may: { type: Type.NUMBER },
    score_jun: { type: Type.NUMBER },
    score_jul: { type: Type.NUMBER },
    score_aug: { type: Type.NUMBER },
    score_sep: { type: Type.NUMBER },
    score_oct: { type: Type.NUMBER },
    score_nov: { type: Type.NUMBER },
    score_dec: { type: Type.NUMBER },
    blurb_overall: { type: Type.STRING },
    blurb_jan: { type: Type.STRING },
    blurb_feb: { type: Type.STRING },
    blurb_mar: { type: Type.STRING },
    blurb_apr: { type: Type.STRING },
    blurb_may: { type: Type.STRING },
    blurb_jun: { type: Type.STRING },
    blurb_jul: { type: Type.STRING },
    blurb_aug: { type: Type.STRING },
    blurb_sep: { type: Type.STRING },
    blurb_oct: { type: Type.STRING },
    blurb_nov: { type: Type.STRING },
    blurb_dec: { type: Type.STRING },
  },
  required: [
    'score_max', 'score_min', 'score_jan', 'score_feb', 'score_mar', 'score_apr', 'score_may', 'score_jun',
    'score_jul', 'score_aug', 'score_sep', 'score_oct', 'score_nov', 'score_dec', 'blurb_overall',
    'blurb_jan', 'blurb_feb', 'blurb_mar', 'blurb_apr', 'blurb_may', 'blurb_jun', 'blurb_jul', 'blurb_aug',
    'blurb_sep', 'blurb_oct', 'blurb_nov', 'blurb_dec',
  ],
};

/** The flat v2 schema plus the three snorkeling & diving fit fields (diving_rating, snorkeling_rating, best_for). */
const RESPONSE_SCHEMA_FLAT_V2_FIT = {
  type: Type.OBJECT,
  properties: {
    ...RESPONSE_SCHEMA_FLAT_V2.properties,
    diving_rating: { type: Type.NUMBER },
    snorkeling_rating: { type: Type.NUMBER },
    best_for: { type: Type.STRING, enum: ['both', 'diving', 'snorkeling'] },
  },
  required: [...RESPONSE_SCHEMA_FLAT_V2.required, 'diving_rating', 'snorkeling_rating', 'best_for'],
};

/** The flat v2 schema plus the two surfing fit fields (beginner_rating, advanced_rating). */
const RESPONSE_SCHEMA_FLAT_V2_SURF = {
  type: Type.OBJECT,
  properties: {
    ...RESPONSE_SCHEMA_FLAT_V2.properties,
    beginner_rating: { type: Type.NUMBER },
    advanced_rating: { type: Type.NUMBER },
  },
  required: [...RESPONSE_SCHEMA_FLAT_V2.required, 'beginner_rating', 'advanced_rating'],
};

/** The flat v2 schema plus the two hiking fit fields (day_hike_rating, trek_rating). */
const RESPONSE_SCHEMA_FLAT_V2_HIKE = {
  type: Type.OBJECT,
  properties: {
    ...RESPONSE_SCHEMA_FLAT_V2.properties,
    day_hike_rating: { type: Type.NUMBER },
    trek_rating: { type: Type.NUMBER },
  },
  required: [...RESPONSE_SCHEMA_FLAT_V2.required, 'day_hike_rating', 'trek_rating'],
};

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
/** Draft "labels" design: the overview, then for each month a blurb followed at once by a condition level (no numbers). */
const RESPONSE_SCHEMA_LABELLED = {
  type: Type.OBJECT,
  properties: {
    blurb_overall: { type: Type.STRING },
    ...Object.fromEntries(MONTH_KEYS.flatMap((m) => [[`blurb_${m}`, { type: Type.STRING }], [`level_${m}`, { type: Type.STRING, enum: ['peak', 'strong', 'reduced', 'poor', 'disrupted', 'closed'] }]])),
  },
  required: ['blurb_overall', ...MONTH_KEYS.flatMap((m) => [`blurb_${m}`, `level_${m}`])],
};

export type SchemaShape = 'nested' | 'flat-v2' | 'flat-v2-fit' | 'flat-v2-surf' | 'flat-v2-hike';

/**
 * Hidden reasoning ("thinking") is billed at the output rate and was ~70-85% of every call's cost, so EVERY Gemini
 * call must cap it. This is the one place the cap lives: generate() below always applies it, and the other Gemini
 * scripts (audit, trim) take their config from thinkingConfigFor() too. A test (tests/gemini/thinking.test.ts)
 * fails if any file calls generateContent without it, so a new script cannot forget. There is deliberately no way
 * to turn the cap off; pass a different level instead. Default LOW works on both Pro and Flash models.
 */
export type ThinkingLevelName = 'minimal' | 'low' | 'medium' | 'high';
export const DEFAULT_THINKING_LEVEL: ThinkingLevelName = 'low';
export function resolveThinkingLevel(level?: string): ThinkingLevelName {
  if (level === undefined || level === '') return DEFAULT_THINKING_LEVEL;
  if (level === 'minimal' || level === 'low' || level === 'medium' || level === 'high') return level;
  throw new Error(`Unknown thinking level "${level}". Use minimal, low, medium or high.`);
}
/**
 * Anything above the default needs an explicit, deliberate opt-in (--allow-higher-thinking in the batch runner), so a
 * stray --thinking=high cannot quietly multiply a run's cost.
 */
export function assertThinkingLevelAllowed(level: ThinkingLevelName, allowHigher: boolean): void {
  const order: ThinkingLevelName[] = ['minimal', 'low', 'medium', 'high'];
  if (order.indexOf(level) > order.indexOf(DEFAULT_THINKING_LEVEL) && !allowHigher) {
    throw new Error(`Thinking level "${level}" is above the default (${DEFAULT_THINKING_LEVEL}) and costs several times more. Add --allow-higher-thinking only if that is intended.`);
  }
}
export function thinkingConfigFor(level?: string) {
  const resolved = resolveThinkingLevel(level);
  const map = { minimal: ThinkingLevel.MINIMAL, low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH } as const;
  return { thinkingLevel: map[resolved] };
}

export interface GeminiCallResult {
  raw: unknown; // the literal API response, for content_generations.raw_response
  parsed: GenerationOutput | null; // null if Zod parsing itself failed, already normalized regardless of wire shape
  parseError: string | null;
  /** From normalizeFlatOutput's score_max/score_min self-consistency check —
   * empty for 'nested' calls (v1 has no self-reported max/min to check). */
  selfCheckIssues: string[];
  tokensIn: number;
  tokensOut: number;
  model: string;
  temperature: number;
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set — see .env.example. Scripts under scripts/gemini-*.ts must load .env.local before calling this.');
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

// gemini-2.5-pro is blocked for newly-created API keys/projects as of
// 2026-09-28 (a live 404 confirmed this, not documentation) — Google's own
// error points at this model instead. It's a preview release postdating
// Claude's training; see prompts/_shared/pricing.json's note on why its
// cost entry is marked unverified.
export const MODEL = 'gemini-3.1-pro-preview';
const TEMPERATURE = 0.2; // per user decision (2026-09-28) — see the plan doc's honest note on "deterministic": not bit-exact at any temperature, this is a deliberate small amount of headroom, not an accident

export async function generate(prompt: string, schemaShape: SchemaShape = 'nested', model: string = MODEL, thinkingLevel?: ThinkingLevelName): Promise<GeminiCallResult> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: TEMPERATURE,
      // Always capped (see thinkingConfigFor). Uncapped, Gemini 3 Flash ran ~63,000 thinking tokens per place and Pro ~4,000.
      thinkingConfig: thinkingConfigFor(thinkingLevel),
      responseMimeType: 'application/json',
      responseSchema: schemaShape === 'flat-v2-fit' ? RESPONSE_SCHEMA_FLAT_V2_FIT : schemaShape === 'flat-v2-surf' ? RESPONSE_SCHEMA_FLAT_V2_SURF : schemaShape === 'flat-v2-hike' ? RESPONSE_SCHEMA_FLAT_V2_HIKE : schemaShape === 'flat-v2' ? RESPONSE_SCHEMA_FLAT_V2 : RESPONSE_SCHEMA,
    },
  });

  const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
  // Gemini's reasoning models bill internal "thinking" tokens at the output
  // rate (see usageMetadata.thoughtsTokenCount), but that field was omitted
  // here originally — cost tracking silently undercounted real spend by
  // ~3x across this pipeline's lifetime (thoughts tokens ran ~3x the size
  // of visible output tokens). Both must be summed to match actual billing.
  const tokensOut = (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0);
  const text = response.text ?? '';

  // Store only the meaningful fields, not the SDK response class as-is —
  // it also carries sdkHttpResponse (the raw HTTP transport handle), which
  // is neither useful to keep nor safely jsonb-serializable (it can hold
  // a real Response/stream object, risking a circular-reference failure on
  // insert). This is still "the literal API response" in every way that
  // matters for the audit trail — the generated content and its metadata.
  const rawForStorage = {
    // Thought signatures are encrypted reasoning blobs (about 70% of the stored size) that nothing can read or replay, so they are not kept.
    candidates: response.candidates?.map((c) => ({ ...c, content: c.content ? { ...c.content, parts: c.content.parts?.map(({ thoughtSignature: _sig, ...part }) => part) } : c.content })),
    usageMetadata: response.usageMetadata,
    modelVersion: response.modelVersion,
    promptFeedback: response.promptFeedback,
  };

  let parsed: GenerationOutput | null = null;
  let parseError: string | null = null;
  let selfCheckIssues: string[] = [];
  try {
    const json = JSON.parse(text);
    if (schemaShape === 'flat-v2' || schemaShape === 'flat-v2-fit' || schemaShape === 'flat-v2-surf' || schemaShape === 'flat-v2-hike') {
      const result = (schemaShape === 'flat-v2-fit' ? generationOutputSchemaFlatV2Fit : schemaShape === 'flat-v2-surf' ? generationOutputSchemaFlatV2Surf : schemaShape === 'flat-v2-hike' ? generationOutputSchemaFlatV2Hike : generationOutputSchemaFlatV2).safeParse(json);
      if (result.success) {
        const normalized = normalizeFlatOutput(result.data);
        parsed = normalized.output;
        selfCheckIssues = normalized.selfCheckIssues;
      } else {
        parseError = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      }
    } else {
      const result = generationOutputSchema.safeParse(json);
      if (result.success) {
        parsed = result.data;
      } else {
        parseError = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      }
    }
  } catch (err) {
    parseError = `JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return { raw: rawForStorage, parsed, parseError, selfCheckIssues, tokensIn, tokensOut, model, temperature: TEMPERATURE };
}

/** Draft labels design (see condition-levels.ts): returns the raw JSON text plus token counts; capped on thinking like every call. */
export async function generateLabelled(prompt: string, model: string = MODEL, thinkingLevel?: ThinkingLevelName): Promise<{ json: Record<string, string>; tokensIn: number; tokensOut: number; model: string }> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { temperature: TEMPERATURE, thinkingConfig: thinkingConfigFor(thinkingLevel), responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA_LABELLED },
  });
  const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0);
  return { json: JSON.parse(response.text ?? '{}'), tokensIn, tokensOut, model };
}
