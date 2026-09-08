import { db } from '@/lib/db/client';
import { interestMeta } from '@/lib/db/schema';
import { SLIDERS } from './constants';

/**
 * Admin-editable emoji overrides layered on top of the code-defined
 * SLIDERS — see the interest_meta table's doc comment in schema.ts.
 * SLIDERS[key]/label/group/formula stay code-owned; only the emoji can be
 * changed here, from the admin Interests catalog screen.
 */
export async function getInterestEmojiMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(interestMeta);
  const overrides = new Map(rows.filter((r) => r.emoji).map((r) => [r.key, r.emoji as string]));
  const map: Record<string, string> = {};
  for (const s of SLIDERS) map[s.key] = overrides.get(s.key) ?? s.icon;
  return map;
}
