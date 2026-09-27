'use server';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { profiles, userPreferences, userSavedProfiles, userDnaState } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/supabase/current-user';
import { convertTravelDNAToRecommendationWeights } from '@/lib/dna/weights';
import { resolveEarnedStyles } from '@/lib/dna/domains';
import { getAllDnaCards } from '@/lib/db/queries/dna-content';
import { allBandsSelected } from '@/lib/scoring/constants';
import type { DnaBands, DnaState } from '@/lib/dna/types';

export interface UserPreferencesData {
  personaId: string | null;
  weights: Record<string, number>;
  bands: Record<string, string[]>;
  month: number | null;
  monthChosen: boolean;
  showAllSliders: boolean;
}

// Read-only, in addition to UserPreferencesData — earnedStyles/selectedStyles
// are written by applyTravelDNAWeights/updateSelectedStyles specifically,
// never through the generic saveUserPreferences() below, so they're kept
// out of that narrower read/write contract.
export interface LoadedUserPreferences extends UserPreferencesData {
  earnedStyles: Record<string, string[]>;
  selectedStyles: Record<string, string[]>;
}

/**
 * First word of profiles.displayName, or null when the visitor has no name
 * on file (every anonymous visitor today) — the results header falls back
 * to "you" for null.
 */
export async function loadFirstName(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const [row] = await db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, userId));
  return row?.displayName?.trim().split(/\s+/)[0] || null;
}

export async function loadUserPreferences(): Promise<LoadedUserPreferences | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  if (!row) return null;
  return {
    personaId: row.personaId,
    weights: row.weights,
    bands: row.bands,
    month: row.month,
    monthChosen: row.monthChosen,
    showAllSliders: row.showAllSliders,
    earnedStyles: row.earnedStyles,
    selectedStyles: row.selectedStyles,
  };
}

/**
 * Toggles the selected sub-style pills for one slider (e.g. 'cycling').
 * Refuses to leave a slider with zero selected styles when it has at
 * least one earned pill — an empty selection isn't a meaningful "scope to
 * nothing" state, it should just mean "not narrowed," so the UI should
 * prevent deselecting the last pill before this is ever called with one.
 * This is a defensive no-op, not a UI-level guarantee.
 */
export async function updateSelectedStyles(sliderKey: string, selected: string[]): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  if (!existing) return;
  const earnedForSlider = existing.earnedStyles[sliderKey] || [];
  if (!selected.length && earnedForSlider.length) return;

  const nextSelected = { ...existing.selectedStyles, [sliderKey]: selected };
  await db
    .update(userPreferences)
    .set({ selectedStyles: nextSelected, updatedAt: new Date() })
    .where(eq(userPreferences.userId, userId));
}

export async function saveUserPreferences(prefs: UserPreferencesData): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await db
    .insert(userPreferences)
    .values({ userId, ...prefs, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { ...prefs, updatedAt: new Date() } });
}

/**
 * Server-side equivalent of the legacy app's applyTravelDNAWeights(): reads
 * the user's Travel DNA state, converts it to slider weights, and applies
 * it as the active preference set (persona cleared, sliders expanded) —
 * without touching bands/month, which stay whatever they already were.
 * Returns false (no-op) if no real Travel DNA signal exists yet.
 */
export async function applyTravelDNAWeights(): Promise<{
  applied: boolean;
  weights?: Record<string, number>;
  earnedStyles?: Record<string, string[]>;
  selectedStyles?: Record<string, string[]>;
}> {
  const userId = await getCurrentUserId();
  if (!userId) return { applied: false };

  const [dnaRow] = await db.select().from(userDnaState).where(eq(userDnaState.userId, userId));
  const dnaState = dnaRow?.state as DnaState | undefined;
  if (!dnaState || dnaState.swipeCount === 0) return { applied: false };

  const weights = convertTravelDNAToRecommendationWeights(dnaState.profile);
  const allCards = await getAllDnaCards();
  const earnedStyles = resolveEarnedStyles(dnaState, allCards);
  const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));

  // Newly-earned pills default to selected; previously-earned pills the
  // user deliberately deselected stay deselected rather than resetting on
  // every re-apply (e.g. after more swiping unlocks a new domain).
  const selectedStyles = { ...existing?.selectedStyles };
  Object.entries(earnedStyles).forEach(([sliderKey, styles]) => {
    if (!selectedStyles[sliderKey]) selectedStyles[sliderKey] = styles;
  });

  if (existing) {
    await db
      .update(userPreferences)
      .set({ weights, earnedStyles, selectedStyles, personaId: null, showAllSliders: true, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({
      userId,
      weights,
      earnedStyles,
      selectedStyles,
      personaId: null,
      showAllSliders: true,
      bands: allBandsSelected(),
      month: null,
      monthChosen: false,
    });
  }
  return { applied: true, weights, earnedStyles, selectedStyles };
}

/**
 * Server-side equivalent of the legacy app's applyTravelDNABandsToMainApp():
 * called once, right when the onboarding Basics screen is completed, so the
 * "Open To" bands just picked there become the main app's starting bands
 * instead of silently defaulting back to "no preference." Only touches
 * `bands` — merged band-dimension by band-dimension onto whatever's already
 * selected, same as the legacy `{ ...allBandsSelected(), ...bands }` — so it
 * never clobbers a persona/weights/month the user already set on the
 * results page in this session.
 */
export async function applyBandsFromOnboarding(bands: DnaBands): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const merged = { ...allBandsSelected(), ...bands };
  const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));

  if (existing) {
    await db.update(userPreferences).set({ bands: merged, updatedAt: new Date() }).where(eq(userPreferences.userId, userId));
  } else {
    // No persona/weights default here either — a user who only got as far
    // as the onboarding Basics screen hasn't picked a starting point yet,
    // so the results page should still show the "pick a starting point"
    // prompt rather than a persona nobody chose.
    await db.insert(userPreferences).values({
      userId,
      personaId: null,
      weights: {},
      bands: merged,
      month: null,
      monthChosen: false,
      showAllSliders: false,
    });
  }
}

export interface SavedProfileData {
  id: string;
  name: string;
  weights: Record<string, number>;
  bands: Record<string, string[]>;
}

export async function listSavedProfiles(): Promise<SavedProfileData[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const rows = await db.select().from(userSavedProfiles).where(eq(userSavedProfiles.userId, userId));
  return rows.map((r) => ({ id: r.id, name: r.name, weights: r.weights, bands: r.bands }));
}

/** Upserts by name (per-user) — re-saving under an existing name overwrites it, matching the legacy behavior of a name-keyed profile object. */
export async function saveNamedProfile(
  name: string,
  weights: Record<string, number>,
  bands: Record<string, string[]>,
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const [existing] = await db
    .select()
    .from(userSavedProfiles)
    .where(and(eq(userSavedProfiles.userId, userId), eq(userSavedProfiles.name, name)));

  if (existing) {
    await db.update(userSavedProfiles).set({ weights, bands }).where(eq(userSavedProfiles.id, existing.id));
  } else {
    await db.insert(userSavedProfiles).values({ userId, name, weights, bands });
  }
}

export async function deleteNamedProfile(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await db.delete(userSavedProfiles).where(and(eq(userSavedProfiles.id, id), eq(userSavedProfiles.userId, userId)));
}
