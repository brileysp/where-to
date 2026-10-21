import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appSettings } from '@/lib/db/schema';
import { DEFAULT_MATCH_SETTINGS, mergeMatchSettings, type MatchSettings, type MatchSettingsOverride } from './matchSettings';

export const MATCH_SETTINGS_KEY = 'matching';

let cache: { at: number; value: { settings: MatchSettings; changed: MatchSettingsOverride } } | null = null;

/** The personalization numbers: the built-in defaults with whatever the admin changed. Kept for 10 seconds; a database hiccup falls back to the defaults. */
export async function loadMatchSettings(): Promise<{ settings: MatchSettings; changed: MatchSettingsOverride }> {
  if (cache && Date.now() - cache.at < 10_000) return cache.value;
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, MATCH_SETTINGS_KEY));
    const settings = mergeMatchSettings(row?.value ?? {});
    const changed: MatchSettingsOverride = {};
    for (const k of Object.keys(DEFAULT_MATCH_SETTINGS) as Array<keyof MatchSettings>) if (settings[k] !== DEFAULT_MATCH_SETTINGS[k]) changed[k] = settings[k];
    cache = { at: Date.now(), value: { settings, changed } };
    return cache.value;
  } catch {
    return cache?.value ?? { settings: { ...DEFAULT_MATCH_SETTINGS }, changed: {} };
  }
}

export function invalidateMatchSettings(): void {
  cache = null;
}
