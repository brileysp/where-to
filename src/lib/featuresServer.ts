import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appSettings } from '@/lib/db/schema';
import { FEATURES_KEY, type FeatureValues } from './features';

let cache: { at: number; value: FeatureValues } | null = null;

/** The feature switches. Kept for 10 seconds; a database hiccup keeps the last known values, or everything off. */
export async function loadFeatures(): Promise<FeatureValues> {
  if (cache && Date.now() - cache.at < 10_000) return cache.value;
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, FEATURES_KEY));
    cache = { at: Date.now(), value: row?.value ?? {} };
    return cache.value;
  } catch {
    return cache?.value ?? {};
  }
}
