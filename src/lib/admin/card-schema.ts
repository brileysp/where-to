import { z } from 'zod';

/**
 * Validates a swipe card as submitted from the admin form (raw FormData
 * strings in, a value shaped for the `cards` table out). Mirrors the role
 * scripts/content/destination-schema.ts plays for destinations, just fed
 * from form fields instead of a JSON file.
 */

const signalMapField = z.string().transform((raw, ctx) => {
  const trimmed = raw.trim();
  if (!trimmed) return {} as Record<string, number>;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'must be valid JSON, e.g. {"birding": 3}' });
    return z.NEVER;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    ctx.addIssue({ code: 'custom', message: 'must be a JSON object of string keys to numbers' });
    return z.NEVER;
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'number' || value < -10 || value > 10) {
      ctx.addIssue({ code: 'custom', message: `"${key}" must be a number between -10 and 10` });
      return z.NEVER;
    }
    result[key] = value;
  }
  return result;
});

const listField = z.string().transform((raw) =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

const nullableListField = z.string().transform((raw) => {
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : null;
});

const nullableTextField = z.string().transform((raw) => (raw.trim() ? raw.trim() : null));

const nullableIntField = z.string().transform((raw, ctx) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    ctx.addIssue({ code: 'custom', message: 'must be a non-negative whole number' });
    return z.NEVER;
  }
  return n;
});

export const cardFormSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, 'lowercase letters/digits/underscores only, e.g. "birding_dawn_chorus"'),
  short: z.string().trim().min(1, 'required'),
  title: z.string().trim().min(1, 'required'),
  description: z.string().trim().min(1, 'required'),
  category: z.string().trim().min(1, 'required'),
  tags: listField,
  imagePrompt: nullableTextField,
  preferenceSignals: signalMapField,
  dimensionSignals: signalMapField,
  stage: z.enum(['broad', 'deep']),
  domainKey: nullableTextField,
  niche: z.union([z.literal('on'), z.null()]).transform((v) => v === 'on'),
  cardSubdimensions: nullableListField,
  sampleDestinations: nullableListField,
  unlockMinPositive: nullableIntField,
  unlockMinLove: nullableIntField,
  diagnosticPurpose: nullableTextField,
});

export type CardFormValues = z.infer<typeof cardFormSchema>;

/** Raw FormData -> the plain-string shape cardFormSchema expects as input. */
export function cardFormRawInput(formData: FormData) {
  const str = (key: string) => String(formData.get(key) ?? '');
  return {
    id: str('id'),
    short: str('short'),
    title: str('title'),
    description: str('description'),
    category: str('category'),
    tags: str('tags'),
    imagePrompt: str('imagePrompt'),
    preferenceSignals: str('preferenceSignals'),
    dimensionSignals: str('dimensionSignals'),
    stage: str('stage') || 'broad',
    domainKey: str('domainKey'),
    niche: formData.get('niche') === 'on' ? ('on' as const) : null,
    cardSubdimensions: str('cardSubdimensions'),
    sampleDestinations: str('sampleDestinations'),
    unlockMinPositive: str('unlockMinPositive'),
    unlockMinLove: str('unlockMinLove'),
    diagnosticPurpose: str('diagnosticPurpose'),
  };
}

/** Formats a zod error into one line per issue, for display in the form. */
export function formatCardFormErrors(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}
