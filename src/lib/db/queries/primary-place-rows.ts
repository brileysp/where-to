import { eq, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { db } from '../client';
import { places } from '../schema';

export type PlaceRow = InferSelectModel<typeof places>;

/**
 * The 200 primary-destination rows are ~3.6 MB of jsonb (sliderCurves alone
 * is 1.4 MB) and every admin grid, plus the public page, used to re-download
 * them from Supabase on each load — sometimes twice per request. This holds
 * one copy in memory: concurrent callers share one in-flight fetch, and
 * withAdminAudit drops the copy the moment an admin write commits.
 *
 * Rows are shared by reference — callers must treat them as read-only.
 *
 * Writes that bypass withAdminAudit (one-off scripts in another process,
 * edits from another server instance) can't invalidate this process's copy,
 * so after CHECK_AFTER_MS a read first asks the database which rows have a
 * newer updatedAt (a few KB) and re-downloads only those. A full re-download
 * happens only on a cold start or after MAX_AGE_MS, as a backstop for a
 * write that didn't bump updatedAt.
 */
const CHECK_AFTER_MS = 60_000;
const MAX_AGE_MS = 30 * 60_000;

interface Cache {
  rows: PlaceRow[] | null;
  fetchedAt: number;
  inflight: Promise<PlaceRow[]> | null;
  checking: Promise<void> | null;
  /** Bumped by any write — a full fetch started before it may hold pre-write rows. */
  generation: number;
  /** Bumped only when the whole copy is dropped — a single-row refresh started before it must not repopulate. */
  invalidations: number;
}

// globalThis so dev-mode hot reloads and Next's separate server bundles
// (pages vs. server actions) all see the same copy.
const g = globalThis as typeof globalThis & { __primaryPlaceRowsCache?: Cache };
const cache: Cache = (g.__primaryPlaceRowsCache ??= { rows: null, fetchedAt: 0, inflight: null, checking: null, generation: 0, invalidations: 0 });

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
    const fresh = changedIds.length ? await db.select().from(places).where(inArray(places.id, changedIds)) : [];
    if (invalidations !== cache.invalidations || !cache.rows) return;
    const freshIds = new Set(fresh.map((r) => r.id));
    cache.rows = [...cache.rows.filter((r) => live.has(r.id) && !freshIds.has(r.id)), ...fresh].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    cache.fetchedAt = Date.now();
  } catch {
    // Can't reach the database for the check — keep serving what we have rather than failing the page.
  }
}

export async function getPrimaryPlaceRows(): Promise<PlaceRow[]> {
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
  const inflight = db
    .select()
    .from(places)
    .where(eq(places.isPrimaryDestination, true))
    .orderBy(places.id)
    .then((rows) => {
      // An admin write committed while this was in flight — these rows may
      // predate it, so hand them to the waiting callers but don't keep them.
      if (generation === cache.generation) {
        cache.rows = rows;
        cache.fetchedAt = Date.now();
      }
      return rows;
    })
    .finally(() => {
      if (cache.inflight === inflight) cache.inflight = null;
    });
  cache.inflight = inflight;
  return inflight;
}

/**
 * After an admin write, re-read just that one row (~18 KB) and splice it
 * into the cached copy, instead of dropping all 3.6 MB and paying a
 * full re-download on the next page load. Falls back to a full
 * invalidation if the cache is cold or the single-row read fails.
 */
export async function refreshPrimaryPlaceRow(id: string): Promise<void> {
  if (!cache.rows) {
    invalidatePrimaryPlaceRows();
    return;
  }
  const invalidations = cache.invalidations;
  cache.generation++; // any full fetch now in flight predates this write
  cache.inflight = null;
  try {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    // The whole copy was dropped while we read — the next full fetch owns the cache. (Other rows' refreshes are independent, so a concurrent write elsewhere is fine.)
    if (invalidations !== cache.invalidations || !cache.rows) return;
    const rest = cache.rows.filter((r) => r.id !== id);
    const next = row && row.isPrimaryDestination ? [...rest, row].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) : rest;
    cache.rows = next;
    cache.fetchedAt = Date.now();
  } catch {
    invalidatePrimaryPlaceRows();
  }
}

export function invalidatePrimaryPlaceRows(): void {
  cache.rows = null;
  cache.inflight = null;
  cache.checking = null;
  cache.generation++;
  cache.invalidations++;
}
