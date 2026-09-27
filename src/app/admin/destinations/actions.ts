'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import { places, adminAuditLog } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';

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

  const { id: _snapshotId, updatedAt: _snapshotUpdatedAt, ...restoreValues } = snapshot;

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
