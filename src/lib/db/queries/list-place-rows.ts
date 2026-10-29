import { eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { places } from '../schema';
import type { PlaceRow } from './primary-place-rows';

/**
 * The public page's copy of the catalog: only the columns the ranked list and the scoring read (about 2 MB for 200 places), not the whole row
 * (6.6 MB today, about 27 MB once every interest has text). Left out on purpose:
 *  - the text (overviews, monthly blurbs, cost notes, special seasons): fetched one place at a time when a place is opened (place-detail.ts);
 *  - the admin-only columns (authorship stamps, sources, N/A reasons, score status), which the public page never shows.
 * toScoringPlace in places.ts is typed to read only these, so a column added there without being added here fails to compile.
 * Same caching rules as primary-place-rows.ts: one copy in memory, a cheap updatedAt check after a minute, a full re-read only on a cold start
 * or after 12 hours. Every full read is logged with its size, so egress can be traced.
 */
export const DETAIL_TEXT_KEYS = ['about', 'overview', 'costOverview', 'costItems', 'monthlyWeather', 'specialSeasons', 'sliderOverview', 'sliderMonthlyWeather'] as const;
export type DetailTextKey = (typeof DETAIL_TEXT_KEYS)[number];

export const LIST_COLUMN_KEYS = [
  'id', 'isPublished', 'isPrimaryDestination', 'updatedAt',
  'name', 'region', 'emoji', 'climate', 'costMin', 'costMax', 'baseScores', 'budgetBands', 'vibeBands', 'physicalBands',
  'dryMonths', 'wetMonths', 'hotMonths', 'coldMonths', 'peakMonths', 'lowMonths', 'peakIntensity', 'priceSwing', 'crowdBaseline',
  'hotSeverity', 'coldSeverity', 'wetSeverity', 'seasonalHazards', 'wildlifePeakMonths', 'wildlifeClosedMonths', 'birdingPeakMonths',
  'hikingBestMonths', 'hikingWorstMonths', 'inaccessibleMonths', 'swimHazardMonths', 'noSnowMonths', 'sliderCaps', 'sliderEvents',
  'shopClosures', 'naSliders', 'gated', 'gatedInterests', 'searchAliases', 'activityStyleTiers', 'signatureTier', 'scoreOverrides', 'sliderCurves',
] as const;

export type ListPlaceRow = Pick<PlaceRow, (typeof LIST_COLUMN_KEYS)[number]>;
export type DetailPlaceRow = Pick<PlaceRow, DetailTextKey>;

const listColumns = Object.fromEntries(LIST_COLUMN_KEYS.map((k) => [k, places[k]])) as { [K in (typeof LIST_COLUMN_KEYS)[number]]: (typeof places)[K] };

const CHECK_AFTER_MS = 60_000;
const MAX_AGE_MS = 12 * 60 * 60_000;

interface Cache {
  rows: ListPlaceRow[] | null;
  fetchedAt: number;
  inflight: Promise<ListPlaceRow[]> | null;
  checking: Promise<void> | null;
  generation: number;
  invalidations: number;
}
const g = globalThis as typeof globalThis & { __listPlaceRowsCache?: Cache };
const cache: Cache = (g.__listPlaceRowsCache ??= { rows: null, fetchedAt: 0, inflight: null, checking: null, generation: 0, invalidations: 0 });

const sortById = (rows: ListPlaceRow[]) => rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

function logFullRead(rows: ListPlaceRow[], why: string): void {
  try {
    console.log(`[place-rows] full read of the public list: ${rows.length} places, ${(JSON.stringify(rows).length / 1048576).toFixed(2)} MB, ${why}`);
  } catch {
    // Logging only.
  }
}

async function syncChangedRows(): Promise<void> {
  const invalidations = cache.invalidations;
  try {
    const stamps = await db.select({ id: places.id, updatedAt: places.updatedAt }).from(places).where(eq(places.isPrimaryDestination, true));
    if (invalidations !== cache.invalidations || !cache.rows) return;
    const cached = new Map(cache.rows.map((r) => [r.id, r.updatedAt.getTime()]));
    const live = new Set(stamps.map((s) => s.id));
    const changedIds = stamps.filter((s) => cached.get(s.id) !== s.updatedAt.getTime()).map((s) => s.id);
    const removed = cache.rows.some((r) => !live.has(r.id));
    if (changedIds.length === 0 && !removed) {
      cache.fetchedAt = Date.now();
      return;
    }
    const fresh = changedIds.length ? await db.select(listColumns).from(places).where(inArray(places.id, changedIds)) : [];
    if (invalidations !== cache.invalidations || !cache.rows) return;
    const freshIds = new Set(fresh.map((r) => r.id));
    cache.rows = sortById([...cache.rows.filter((r) => live.has(r.id) && !freshIds.has(r.id)), ...(fresh as ListPlaceRow[])]);
    cache.fetchedAt = Date.now();
  } catch {
    // Can't reach the database for the check: keep serving what we have.
  }
}

export async function getListPlaceRows(): Promise<ListPlaceRow[]> {
  if (cache.rows) {
    const age = Date.now() - cache.fetchedAt;
    if (age < CHECK_AFTER_MS) return cache.rows;
    if (age < MAX_AGE_MS) {
      cache.checking ??= syncChangedRows().finally(() => {
        cache.checking = null;
      });
      await cache.checking;
      if (cache.rows) return cache.rows;
    }
  }
  if (cache.inflight) return cache.inflight;
  const generation = cache.generation;
  const why = cache.rows ? 'cache older than 12 hours' : 'cold start or cache cleared';
  const inflight = db
    .select(listColumns)
    .from(places)
    .where(eq(places.isPrimaryDestination, true))
    .orderBy(places.id)
    .then((rows) => {
      logFullRead(rows as ListPlaceRow[], why);
      // A write committed while this was in flight: hand the rows to the waiting callers but do not keep them.
      if (generation === cache.generation) {
        cache.rows = rows as ListPlaceRow[];
        cache.fetchedAt = Date.now();
      }
      return rows as ListPlaceRow[];
    })
    .finally(() => {
      if (cache.inflight === inflight) cache.inflight = null;
    });
  cache.inflight = inflight;
  return inflight;
}

/** After an admin write: re-read just that one place (about 10 KB) and splice it in. */
export async function refreshListPlaceRow(id: string): Promise<void> {
  if (!cache.rows) {
    invalidateListPlaceRows();
    return;
  }
  const invalidations = cache.invalidations;
  cache.generation++;
  cache.inflight = null;
  try {
    const [row] = await db.select(listColumns).from(places).where(eq(places.id, id));
    if (invalidations !== cache.invalidations || !cache.rows) return;
    const rest = cache.rows.filter((r) => r.id !== id);
    cache.rows = row && row.isPrimaryDestination ? sortById([...rest, row as ListPlaceRow]) : rest;
    cache.fetchedAt = Date.now();
  } catch {
    invalidateListPlaceRows();
  }
}

export function invalidateListPlaceRows(): void {
  cache.rows = null;
  cache.inflight = null;
  cache.checking = null;
  cache.generation++;
  cache.invalidations++;
}
