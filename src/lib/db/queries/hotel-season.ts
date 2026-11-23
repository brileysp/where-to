import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { placeHotelQuoteRuns, placeHotelSeason } from '../schema';
import type { HotelKind, HotelSeasonSummary } from '@/lib/hotel-season/types';

/**
 * Reads for the hotel price seasonality tables (docs/hotel-season.md). Nothing in the traveler-facing app calls these yet; they are for admin tools and scripts.
 * The summary table is small (about 350 bytes a place), so listing all of it is cheap. The evidence rows are larger and are read one place at a time.
 */
export interface HotelSeasonRow { placeId: string; kind: string; runId: string; summary: HotelSeasonSummary; asOf: string; flags: string[]; swing: number | null; overrides: { flags?: string[]; note: string; by: string; at: string } | null }

export async function getHotelSeasonAll(kind: HotelKind = 'luxury'): Promise<HotelSeasonRow[]> {
  return (await db.select().from(placeHotelSeason).where(eq(placeHotelSeason.kind, kind))) as HotelSeasonRow[];
}
export async function getHotelSeasonFor(placeIds: string[], kind: HotelKind = 'luxury'): Promise<HotelSeasonRow[]> {
  if (!placeIds.length) return [];
  return (await db.select().from(placeHotelSeason).where(and(eq(placeHotelSeason.kind, kind), inArray(placeHotelSeason.placeId, placeIds)))) as HotelSeasonRow[];
}
/** Every collection run for a place, newest first, with the hotels and their prices. */
export async function getQuoteRuns(placeId: string, kind: HotelKind = 'luxury') {
  const rows = await db.select().from(placeHotelQuoteRuns).where(and(eq(placeHotelQuoteRuns.placeId, placeId), eq(placeHotelQuoteRuns.kind, kind)));
  return rows.sort((a, b) => (a.quotedOn < b.quotedOn ? 1 : a.quotedOn > b.quotedOn ? -1 : 0));
}
