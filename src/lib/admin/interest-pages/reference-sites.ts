import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { interestReferenceSites } from '@/lib/db/schema';
import { withAdminAudit } from '@/lib/admin/write';
import { CLAUDE_ACTOR } from '@/lib/admin/auth';

/**
 * For fact-check scripts: note that a site on an interest's reference list was used today.
 * Sets "last used" to the date given (never moves it backwards) and "places checked" to the
 * number of places checked in this pass if that is higher than what is stored. A site that is
 * not on the list is reported, not added: the list is kept short on purpose and is curated by
 * a person (see ReferenceSitesSection).
 */
export async function recordSiteUse(interestKey: string, siteUrl: string, placesChecked: number, usedOn: string = new Date().toISOString().slice(0, 10)): Promise<'updated' | 'not-on-list'> {
  const [before] = await db.select().from(interestReferenceSites).where(and(eq(interestReferenceSites.interestKey, interestKey), eq(interestReferenceSites.siteUrl, siteUrl)));
  if (!before) return 'not-on-list';
  const set = {
    lastUsedOn: !before.lastUsedOn || usedOn > before.lastUsedOn ? usedOn : before.lastUsedOn,
    placesChecked: Math.max(before.placesChecked, Math.max(0, Math.round(placesChecked))),
  };
  await withAdminAudit({
    actor: CLAUDE_ACTOR,
    skipPlaceCache: true,
    entityType: 'interest_reference_site',
    entityId: before.id,
    action: 'update',
    before,
    after: { ...before, ...set },
    write: (tx) => tx.update(interestReferenceSites).set({ ...set, updatedAt: new Date() }).where(eq(interestReferenceSites.id, before.id)).returning(),
  });
  return 'updated';
}
