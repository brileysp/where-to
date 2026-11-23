import { eq } from 'drizzle-orm';
import { db } from '../client';
import { placeInterestFacts } from '../schema';
import { getPrimaryPlaceRows } from './primary-place-rows';
import { TRAVEL_KEY } from '@/lib/admin/travel-needs/config';
import type { InterestFactValue } from '@/lib/db/schema';

export interface TravelNeedsRow {
  id: string;
  name: string;
  region: string;
  /** What the place is like (src/lib/places/setting-tags.ts); the first is the primary tag. */
  settingTags: string[];
  facts: Record<string, InterestFactValue>;
}

/** Every place with its traveler-needs facts (kids, how you travel, language, diet, mobility). */
export async function getTravelNeedsRows(): Promise<TravelNeedsRow[]> {
  const [rows, facts] = await Promise.all([getPrimaryPlaceRows(), db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, TRAVEL_KEY))]);
  const byPlace = new Map(facts.map((f) => [f.placeId, f.facts]));
  return rows
    .map((r) => ({ id: r.id, name: r.name, region: r.region, settingTags: r.settingTags ?? [], facts: byPlace.get(r.id) ?? {} }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let factsCache: { at: number; value: Record<string, import('@/lib/onboarding/travel-facts').TravelPlaceFacts> } | null = null;

/** Place id to its traveler-needs ratings, for matching. About 200 small rows, kept for a minute. */
export async function getTravelFacts(): Promise<Record<string, import('@/lib/onboarding/travel-facts').TravelPlaceFacts>> {
  if (factsCache && Date.now() - factsCache.at < 60_000) return factsCache.value;
  const { cleanTravelFacts } = await import('@/lib/onboarding/travel-facts');
  const rows = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, TRAVEL_KEY));
  const value = Object.fromEntries(rows.map((r) => [r.placeId, cleanTravelFacts(r.facts as Record<string, unknown>)]));
  factsCache = { at: Date.now(), value };
  return value;
}
