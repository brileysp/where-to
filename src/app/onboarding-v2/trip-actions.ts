'use server';

import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userPreferences, userTrips, userTravelProfiles } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/supabase/current-user';
import { allBandsSelected } from '@/lib/scoring/constants';
import { parseTravelProfile } from '@/lib/onboarding/profile';
import { MAX_TRIPS, parseTrip, type Trip } from '@/lib/onboarding/trips';

/**
 * Saving and loading a traveler's trips (docs/matching-model.md, "Trip settings"). Nothing here trusts the browser: every trip is cleaned first,
 * and a trip can only be changed or deleted by the traveler who owns it. The most recently saved trip is the active one, and saving it also
 * brings the traveler's saved month and bands (which the full results page ranks with) in line with it.
 */

export type TripResult = { ok: true; trips: Trip[] } | { ok: false; message: string };

type Row = typeof userTrips.$inferSelect;
const toTrip = (r: Row): Trip | null => parseTrip({ ...r, month: r.month, overrides: r.overrides, continents: r.continents });

export async function loadTrips(): Promise<Trip[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const rows = await db.select().from(userTrips).where(eq(userTrips.userId, userId)).orderBy(desc(userTrips.updatedAt));
  return rows.flatMap((r) => { const t = toTrip(r); return t ? [t] : []; });
}

export async function saveTrip(raw: unknown): Promise<TripResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, message: 'Not signed in' };
  const trip = parseTrip(raw);
  if (!trip) return { ok: false, message: 'That trip could not be read' };

  const [existing] = await db.select({ id: userTrips.id, userId: userTrips.userId }).from(userTrips).where(eq(userTrips.id, trip.id));
  if (existing && existing.userId !== userId) return { ok: false, message: 'That trip is not yours' };
  if (!existing) {
    const [{ n }] = await db.select({ n: count() }).from(userTrips).where(eq(userTrips.userId, userId));
    if (n >= MAX_TRIPS) return { ok: false, message: `You can keep up to ${MAX_TRIPS} trips` };
  }
  const values = { name: trip.name, nameAuto: trip.nameAuto, month: trip.month, week: trip.week, year: trip.year, yearAuto: trip.yearAuto, length: trip.length, continents: trip.continents, overrides: trip.overrides, updatedAt: new Date() };
  await db.insert(userTrips).values({ id: trip.id, userId, ...values }).onConflictDoUpdate({ target: userTrips.id, set: values, where: eq(userTrips.userId, userId) });

  // The full results page ranks with the saved month and bands: keep them in line with the active trip.
  const [saved] = await db.select().from(userTravelProfiles).where(eq(userTravelProfiles.userId, userId));
  const profile = saved ? parseTravelProfile(saved.profile) : null;
  const bands = { ...allBandsSelected(), ...(trip.overrides.bands ?? profile?.bands ?? {}) };
  await db
    .update(userPreferences)
    .set({ bands, ...(trip.month != null ? { month: trip.month + 1, monthChosen: true } : {}), updatedAt: new Date() })
    .where(eq(userPreferences.userId, userId));
  return { ok: true, trips: await loadTrips() };
}

export async function deleteTrip(id: unknown): Promise<TripResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, message: 'Not signed in' };
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: 'That trip could not be found' };
  const trips = await loadTrips();
  if (trips.length <= 1) return { ok: false, message: 'Keep at least one trip' };
  await db.delete(userTrips).where(and(eq(userTrips.id, id.toLowerCase()), eq(userTrips.userId, userId)));
  return { ok: true, trips: await loadTrips() };
}
