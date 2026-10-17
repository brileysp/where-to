'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userPreferences, userTravelProfiles } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/supabase/current-user';
import { getAllDimensionDefs, getAllDnaCards } from '@/lib/db/queries/dna-content';
import { saveDnaState } from '@/app/dna/actions';
import { allBandsSelected } from '@/lib/scoring/constants';
import { dnaStateFor, weightsFor } from '@/lib/onboarding/bridge';
import { fromTravelProfile, parseTravelProfile, type TravelProfile } from '@/lib/onboarding/profile';

/**
 * Saving and loading what a traveler keeps from the new onboarding flow (docs/onboarding-v2/SPEC.md 6). Saving writes three places, so the
 * rest of the app agrees with it: the new profile document, the Travel DNA state the old flow and the review screen read, and the
 * preferences the results page ranks with (weights and Open-to bands, plus the month only when the traveler kept dates).
 * Nothing here trusts the browser: the profile is cleaned first and the weights are worked out again on the server.
 */

export type SaveResult = { ok: true } | { ok: false; message: string };

export async function loadTravelProfile(): Promise<TravelProfile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const [row] = await db.select().from(userTravelProfiles).where(eq(userTravelProfiles.userId, userId));
  return row ? parseTravelProfile(row.profile) : null;
}

export async function saveTravelProfile(raw: unknown): Promise<SaveResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, message: 'Not signed in' };
  const profile = parseTravelProfile(raw);
  if (!profile) return { ok: false, message: 'That profile could not be read' };

  const [cards, dimensions] = await Promise.all([getAllDnaCards(), getAllDimensionDefs()]);
  const choices = fromTravelProfile(profile, cards);
  const input = { levels: choices.levels, who: choices.who, bands: choices.bands, vibes: choices.vibes, answers: choices.answers };

  await db
    .insert(userTravelProfiles)
    .values({ userId, profile, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userTravelProfiles.userId, set: { profile, updatedAt: new Date() } });

  await saveDnaState({ ...dnaStateFor(input, dimensions), completedOnboarding: true });

  const weights = weightsFor(input);
  const keepMonth = profile.month != null;
  const set = { personaId: null, weights, bands: profile.bands, showAllSliders: true, ...(keepMonth ? { month: profile.month! + 1, monthChosen: true } : {}), updatedAt: new Date() };
  await db
    .insert(userPreferences)
    .values({ userId, personaId: null, weights, bands: { ...allBandsSelected(), ...profile.bands }, month: keepMonth ? profile.month! + 1 : null, monthChosen: keepMonth, showAllSliders: true })
    .onConflictDoUpdate({ target: userPreferences.userId, set });
  return { ok: true };
}
