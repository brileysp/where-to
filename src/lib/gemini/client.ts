import { GoogleGenAI, Type } from '@google/genai';
import { generationOutputSchema, generationOutputSchemaFlatV2, normalizeFlatOutput, type GenerationOutput } from './schema';

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

export type SchemaShape = 'nested' | 'flat-v2';

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

export async function generate(prompt: string, schemaShape: SchemaShape = 'nested'): Promise<GeminiCallResult> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: TEMPERATURE,
      responseMimeType: 'application/json',
      responseSchema: schemaShape === 'flat-v2' ? RESPONSE_SCHEMA_FLAT_V2 : RESPONSE_SCHEMA,
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
    candidates: response.candidates,
    usageMetadata: response.usageMetadata,
    modelVersion: response.modelVersion,
    promptFeedback: response.promptFeedback,
  };

  let parsed: GenerationOutput | null = null;
  let parseError: string | null = null;
  let selfCheckIssues: string[] = [];
  try {
    const json = JSON.parse(text);
    if (schemaShape === 'flat-v2') {
      const result = generationOutputSchemaFlatV2.safeParse(json);
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

  return { raw: rawForStorage, parsed, parseError, selfCheckIssues, tokensIn, tokensOut, model: MODEL, temperature: TEMPERATURE };
}
