import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { adminAuditLog, places } from '@/lib/db/schema';
import { toScoringPlace } from '@/lib/db/queries/places';
import { fitDestinationCurves } from '@/lib/scoring/fitCurve';
import type { AdminUser } from './auth';

export type AdminAuditAction = 'create' | 'update' | 'delete';

/**
 * The single write path every admin mutation goes through (see
 * docs/admin-panel-plan.md, "One transaction per write"). The actual row
 * change and its audit-log row succeed or fail together — a write that
 * landed without a matching audit row would be a broken safety net, not a
 * degraded one, so this is never optional per entity type.
 */
export async function withAdminAudit<T>(params: {
  actor: AdminUser;
  entityType: string;
  entityId: string;
  action: AdminAuditAction;
  before: unknown;
  after: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  write: (tx: any) => Promise<T>;
}): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).transaction(async (tx: any) => {
    const result = await params.write(tx);
    await tx.insert(adminAuditLog).values({
      actorId: params.actor.id,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      beforeValue: params.before ?? null,
      afterValue: params.after ?? null,
    });

    // Live curve refit. Place migration Phase 4 completed: admin writes now
    // land on `places` directly (entity-registry.ts / actions.ts) — this is
    // no longer a mirror, it's the only table involved. sliderCurves is a
    // static snapshot from the last fit, not something that re-derives
    // itself, so every edit to baseScores/sliderCaps/sliderEvents/etc.
    // needs this refit or curve-based scoring would silently stop tracking
    // admin content the moment this ran once. Computed from `after`
    // directly — no extra read needed, it's already the complete post-write
    // row. Deliberately does NOT touch `updatedAt`: the primary write above
    // already stamped the fresh timestamp the caller hands back to the
    // client as its new optimistic-lock baseline (see apply-edits.ts) — a
    // second bump here would silently invalidate that baseline and turn the
    // client's very next save into a false "someone else edited this"
    // conflict. `destinations` is untouched entirely: frozen as of this
    // migration, kept only until Phase 6 drops the table.
    if (params.entityType === 'destination' && (params.action === 'update' || params.action === 'create') && params.after && typeof params.after === 'object') {
      const source = params.after as Record<string, unknown>;
      const scoring = toScoringPlace(source as Parameters<typeof toScoringPlace>[0]);
      const refitted = fitDestinationCurves(scoring);

      // Hand-authored curves survive the refit. Without this the formula
      // stays the permanent source of truth — every save would regenerate
      // sliderCurves from deriveDestinationScores and silently discard
      // whatever a human had shaped, which is why the curve migration's
      // authoring half was never actually reachable. See the doc comment
      // on places.authoredCurves.
      const authored = new Set((source.authoredCurves as string[] | undefined) ?? []);
      const existing = (source.sliderCurves ?? {}) as Record<string, unknown>;
      const curves: Record<string, unknown> = { ...refitted };
      for (const key of authored) {
        if (existing[key] !== undefined) curves[key] = existing[key];
        else delete curves[key];
      }

      await tx
        .update(places)
        .set({ sliderCurves: curves as typeof places.$inferInsert.sliderCurves })
        .where(eq(places.id, params.entityId));
    }

    return result;
  });
}
