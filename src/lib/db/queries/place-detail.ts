import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { places } from '../schema';
import type { PlaceDetailText } from '@/lib/scoring/types';

/**
 * The text of one place, read when a visitor opens it (the ranked list is built from scores only, see list-place-rows.ts).
 * About 10 to 15 KB now and up to about 60 KB once every interest has text. Only published, ranked places are returned.
 */
export async function getPlaceDetailText(id: string): Promise<PlaceDetailText | null> {
  const [r] = await db
    .select({
      about: places.about, overview: places.overview, costOverview: places.costOverview, costItems: places.costItems, monthlyWeather: places.monthlyWeather,
      specialSeasons: places.specialSeasons, sliderOverview: places.sliderOverview, sliderMonthlyWeather: places.sliderMonthlyWeather,
    })
    .from(places)
    .where(and(eq(places.id, id), eq(places.isPrimaryDestination, true), eq(places.isPublished, true)));
  if (!r) return null;
  return {
    about: r.about,
    overview: r.overview,
    costOverview: r.costOverview,
    // Strip the admin-only edit-tracking fields (editor email etc.) so they never reach the public payload.
    // Cheapest first, always (the order the admin saved them in does not matter).
    costItems: r.costItems.map(({ label, price, unit, emoji }) => ({ label, price, unit, ...(emoji ? { emoji } : {}) })).sort((a, b) => a.price - b.price),
    monthlyWeather: r.monthlyWeather,
    specialSeasons: r.specialSeasons,
    sliderOverview: r.sliderOverview,
    sliderMonthlyWeather: r.sliderMonthlyWeather,
  };
}
