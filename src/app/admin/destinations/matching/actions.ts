'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appSettings } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { DEFAULT_MATCH_SETTINGS, matchSettingsProblem, mergeMatchSettings, type MatchSettings, type MatchSettingsOverride } from '@/lib/scoring/matchSettings';
import { invalidateMatchSettings, MATCH_SETTINGS_KEY } from '@/lib/scoring/matchSettingsServer';

/**
 * Saves the personalization numbers (Matching tab). Only values that differ from the built-in defaults are stored, so a default changed in a
 * later release still reaches everything the owner never touched. Every change goes through withAdminAudit.
 */

type Result = { ok: true; settings: MatchSettings; changed: MatchSettingsOverride } | { ok: false; message: string };

function split(settings: MatchSettings): MatchSettingsOverride {
  const changed: MatchSettingsOverride = {};
  for (const k of Object.keys(DEFAULT_MATCH_SETTINGS) as Array<keyof MatchSettings>) if (settings[k] !== DEFAULT_MATCH_SETTINGS[k]) changed[k] = settings[k];
  return changed;
}

async function write(admin: { id: string; email: string }, changed: MatchSettingsOverride): Promise<void> {
  const [before] = await db.select().from(appSettings).where(eq(appSettings.key, MATCH_SETTINGS_KEY));
  await withAdminAudit({
    actor: admin as never, skipPlaceCache: true, entityType: 'app_settings', entityId: MATCH_SETTINGS_KEY, action: before ? 'update' : 'create', before: before?.value ?? {}, after: changed,
    write: (tx) => tx.insert(appSettings).values({ key: MATCH_SETTINGS_KEY, value: changed as Record<string, number>, updatedBy: admin.email }).onConflictDoUpdate({ target: appSettings.key, set: { value: changed as Record<string, number>, updatedBy: admin.email, updatedAt: new Date() } }),
  });
  invalidateMatchSettings();
}

/** Saves a full set of numbers. Invalid or out-of-range numbers are refused with a message, never quietly corrected. */
export async function saveMatchSettings(values: MatchSettings): Promise<Result> {
  const admin = await requireAdminUser();
  const clean = mergeMatchSettings(values);
  for (const k of Object.keys(DEFAULT_MATCH_SETTINGS) as Array<keyof MatchSettings>) if (clean[k] !== values[k]) return { ok: false, message: `Check the number for "${k}"` };
  const problem = matchSettingsProblem(clean);
  if (problem) return { ok: false, message: problem };
  const changed = split(clean);
  await write(admin, changed);
  return { ok: true, settings: clean, changed };
}

/** Puts every number back to its built-in default. */
export async function resetMatchSettings(): Promise<Result> {
  const admin = await requireAdminUser();
  await write(admin, {});
  return { ok: true, settings: { ...DEFAULT_MATCH_SETTINGS }, changed: {} };
}
