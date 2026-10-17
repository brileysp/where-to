import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { interestChips } from '../schema';

export interface OnboardingChip {
  key: string;
  label: string;
}

/**
 * The live chips for every interest, in the admin's order: the "What kind?" specifics the onboarding shows under a top interest
 * (docs/onboarding-v2/SPEC.md 8.4). An interest with none has no specifics.
 */
export async function getLiveInterestChips(): Promise<Record<string, OnboardingChip[]>> {
  const rows = await db.select().from(interestChips).where(eq(interestChips.status, 'live')).orderBy(asc(interestChips.interestKey), asc(interestChips.sortOrder));
  const out: Record<string, OnboardingChip[]> = {};
  for (const r of rows) (out[r.interestKey] ??= []).push({ key: r.chipKey, label: r.label });
  return out;
}

export interface PlaceCoordsRow {
  lat: number;
  lon: number;
}

/** Latitude and longitude for every place that has them on file, for estimating flight hours. A place without coordinates is simply absent. */
export async function getPlaceCoords(): Promise<Record<string, PlaceCoordsRow>> {
  const { places } = await import('../schema');
  const rows = await db.select({ id: places.id, lat: places.latitude, lon: places.longitude }).from(places);
  const out: Record<string, PlaceCoordsRow> = {};
  for (const r of rows) if (r.lat != null && r.lon != null) out[r.id] = { lat: r.lat, lon: r.lon };
  return out;
}
