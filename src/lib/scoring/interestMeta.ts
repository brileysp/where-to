import { db } from '@/lib/db/client';
import { interestMeta } from '@/lib/db/schema';

/**
 * Admin-editable emoji overrides layered on top of the code-defined
 * SLIDERS — see the interest_meta table's doc comment in schema.ts.
 * SLIDERS[key]/label/group/formula stay code-owned; only the emoji can be
 * changed here, from the admin Interests catalog screen.
 *
 * Returned as a plain map for the caller to pass down as props, rather
 * than mutated onto the shared SLIDERS array: SLIDERS is imported by
 * client components (ResultsApp, SliderPanel, ForYouTab, InterestChip),
 * whose browser bundle is compiled from the source file's own literal
 * icons and knows nothing about a server-side runtime mutation. Mutating
 * SLIDERS in the Server Component only patched the very first
 * server-rendered HTML; the instant React hydrates, it reconciles against
 * the client bundle's original values and the override visibly reverts.
 * Threading this map through props instead means the client genuinely
 * has the overridden value, so there's nothing for hydration to revert to.
 */
export async function getInterestEmojiOverrides(): Promise<Record<string, string>> {
  const rows = await db.select().from(interestMeta);
  const overrides: Record<string, string> = {};
  for (const r of rows) if (r.emoji) overrides[r.key] = r.emoji;
  return overrides;
}
