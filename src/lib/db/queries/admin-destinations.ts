import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { places } from '@/lib/db/schema';

/**
 * Place migration, Phase 4 completed: admin now reads/writes `places`
 * directly, same as the public page — `destinations` is retired from every
 * live path (frozen, kept only until Phase 6 drops the table). Function
 * names are unchanged from the `destinations`-table era on purpose: every
 * caller already asks for "the admin view of a destination," which hasn't
 * changed meaning, only which table answers it.
 *
 * Scoped to isPrimaryDestination — the same filter getAllScoredPlaces()
 * uses — so the main admin grids keep showing exactly today's 200 real
 * destinations, not any future Phase 5 related places.
 */
export async function listDestinationsForAdmin() {
  return db.select().from(places).where(eq(places.isPrimaryDestination, true)).orderBy(places.id);
}

export async function getDestinationForAdmin(id: string) {
  const [row] = await db.select().from(places).where(and(eq(places.id, id), eq(places.isPrimaryDestination, true)));
  return row ?? null;
}
