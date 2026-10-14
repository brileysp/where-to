'use server';

import { mergeSub } from '@/lib/admin/audit-diff';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import { places, adminAuditLog } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { insertNewPlace } from '@/lib/admin/create-place';

/**
 * Restore = write an old snapshot back through the exact same write path a
 * normal edit uses (see docs/admin-panel-plan.md, "Undo / restore") —
 * never a special-cased operation. This appends a new 'update' audit row
 * rather than rewriting history, which is what makes "redo" just walking
 * the log forward again.
 *
 * Deliberately skips re-validating the snapshot before writing it back —
 * every snapshot in the log already passed validation once, at the moment
 * it was originally saved. The gap this leaves: if a validation rule
 * changed since a snapshot was taken, restoring it wouldn't re-catch that.
 * Low risk for now; worth hardening if it ever actually bites.
 *
 * Place migration Phase 4 completed: this now writes to `places`, not
 * `destinations`. A snapshot taken before that cutover is `destinations`-
 * shaped (no isPrimaryDestination/countryCode/etc.) — restoring one still
 * works correctly, since `.set(restoreValues)` only touches the columns
 * actually present in the snapshot and leaves every places-only column
 * exactly as it was.
 */
export async function restoreDestinationVersion(id: string, auditId: string, _formData: FormData): Promise<void> {
  const admin = await requireAdminUser();

  const [auditRow] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.id, auditId));
  if (!auditRow || auditRow.entityType !== 'destination' || auditRow.entityId !== id) {
    redirect(`/admin/destinations/${id}/history?error=1`);
  }

  const snapshot = auditRow.afterValue as Record<string, unknown> | null;
  if (!snapshot) redirect(`/admin/destinations/${id}/history?error=1`);

  const [before] = await db.select().from(places).where(eq(places.id, id));
  if (!before) redirect(`/admin/destinations/${id}/history?error=1`);

  const { id: _snapshotId, updatedAt: _snapshotUpdatedAt, ...stored } = snapshot;
  // An entry stores only what that save changed; a column kept as a partial map is merged into the live value so other interests are untouched.
  const restoreValues = Object.fromEntries(Object.entries(stored).map(([col, val]) => [col, mergeSub((before as Record<string, unknown>)[col], val)]));

  await withAdminAudit({
    actor: admin,
    entityType: 'destination',
    entityId: id,
    action: 'update',
    before,
    after: { ...before, ...restoreValues },
    write: (tx) =>
      tx
        .update(places)
        .set({ ...restoreValues, updatedAt: new Date() })
        .where(eq(places.id, id)),
  });

  redirect(`/admin/destinations/${id}/history`);
}


/**
 * Creates a new place with empty content. It starts retired and unpublished (not ranked, not shown to travellers), so a
 * half-written place can never appear in anyone's results; turn Primary and Published on from the Places grid once it is ready.
 */
export async function createPlace(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();
  const name = String(formData.get('name') ?? '');
  const error = await insertNewPlace(admin, {
    id: String(formData.get('id') ?? ''),
    name,
    region: String(formData.get('region') ?? ''),
    emoji: String(formData.get('emoji') ?? ''),
    climate: String(formData.get('climate') ?? ''),
    countryCode: String(formData.get('countryCode') ?? '') || null,
    continent: String(formData.get('continent') ?? '') || null,
  });
  if (error) redirect(`/admin/destinations/new?error=${encodeURIComponent(error)}`);
  redirect(`/admin/destinations/new?created=${encodeURIComponent(name.trim())}`);
}

/**
 * Folds one place into another: the old place's name and search aliases are added to the target's search aliases, the old place is
 * retired (not ranked, not published) and its summary says where it went. No scores or text are moved; copy anything worth keeping first.
 */
export async function mergePlaces(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();
  const sourceId = String(formData.get('sourceId') ?? '');
  const targetId = String(formData.get('targetId') ?? '');
  const fail = (msg: string) => redirect(`/admin/destinations/new?error=${encodeURIComponent(msg)}`);
  if (!sourceId || !targetId || sourceId === targetId) fail('Pick two different places.');
  const [source] = await db.select().from(places).where(eq(places.id, sourceId));
  const [target] = await db.select().from(places).where(eq(places.id, targetId));
  if (!source || !target) fail('One of those places was not found.');
  const aliases = Array.from(new Set([...target.searchAliases, source.name, ...source.searchAliases].filter((a) => a && a.toLowerCase() !== target.name.toLowerCase())));
  await withAdminAudit({
    actor: admin, entityType: 'destination', entityId: targetId, action: 'update', before: target,
    after: { ...target, searchAliases: aliases },
    write: (tx) => tx.update(places).set({ searchAliases: aliases, updatedAt: new Date() }).where(eq(places.id, targetId)),
  });
  const note = `Merged into ${target.name} on ${new Date().toISOString().slice(0, 10)}.`;
  await withAdminAudit({
    actor: admin, entityType: 'destination', entityId: sourceId, action: 'update', before: source,
    after: { ...source, isPrimaryDestination: false, isPublished: false, summary: note },
    write: (tx) => tx.update(places).set({ isPrimaryDestination: false, isPublished: false, summary: note, updatedAt: new Date() }).where(eq(places.id, sourceId)),
  });
  redirect(`/admin/destinations/new?merged=${encodeURIComponent(`${source.name} into ${target.name}`)}`);
}
