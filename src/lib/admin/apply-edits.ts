'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { ENTITY_REGISTRY } from '@/lib/admin/entity-registry';
import { stampCostItems, type StampedCostItem } from '@/lib/admin/cost-item-stamp';

export interface EditPatch {
  entityType: string;
  entityId: string;
  field: string;
  value: unknown;
  // ISO timestamp of `updatedAt` as it was when the grid loaded this row —
  // the optimistic-lock check compares this against the live value at save
  // time. All patches for the same entity in one batch must carry the same
  // value (the grid loads a row once); this is a client-side invariant,
  // not something re-validated per patch here.
  loadedUpdatedAt: string;
}

export interface ApplyEditsResult {
  // `updatedAt` is the row's new post-write timestamp — callers must feed
  // this back into their local state as the new `loadedUpdatedAt` for that
  // entity, or every subsequent edit to it in the same page session will
  // false-positive as a conflict against its own prior save.
  saved: Array<{ entityType: string; entityId: string; updatedAt: string }>;
  conflicts: Array<{ entityType: string; entityId: string; currentUpdatedAt: string }>;
  errors: Array<{ entityType: string; entityId: string; field: string; message: string }>;
}

/**
 * The single write path every grid screen's "Review & save" goes through
 * (see docs/admin-panel-plan.md's audit/concurrency safety net, and the
 * mockup's Pending tray). Batches multiple field-level patches, grouped by
 * entity, and commits each entity independently — one entity conflicting
 * or failing validation never blocks the others in the same save. Every
 * successful write still goes through withAdminAudit exactly like the
 * existing whole-form actions do, so the audit log and History panels work
 * identically regardless of which write path produced them.
 */
export async function applyAdminEdits(patches: EditPatch[]): Promise<ApplyEditsResult> {
  const admin = await requireAdminUser();

  const result: ApplyEditsResult = { saved: [], conflicts: [], errors: [] };
  if (patches.length === 0) return result;

  const groups = new Map<string, EditPatch[]>();
  for (const patch of patches) {
    const key = `${patch.entityType}:${patch.entityId}`;
    const group = groups.get(key);
    if (group) group.push(patch);
    else groups.set(key, [patch]);
  }

  for (const [, group] of groups) {
    const { entityType, entityId, loadedUpdatedAt } = group[0];
    const config = ENTITY_REGISTRY[entityType];
    if (!config) {
      for (const p of group) result.errors.push({ entityType, entityId, field: p.field, message: `unknown entity type "${entityType}"` });
      continue;
    }

    // Keep only the last patch per field — each patch for a whole-object/
    // array column (like costItems) carries a full snapshot taken at that
    // step, so an in-progress step (e.g. a just-added cost item with a
    // still-empty label, before the next patch fills it in) can be
    // transiently invalid on its own even though the batch's actual final
    // value is fine. Only that final value is ever written (patchedFields
    // already overwrites per field), so only it needs to pass validation —
    // validating every intermediate snapshot was aborting the whole save
    // over a state nothing ever persists.
    const lastPatchByField = new Map<string, EditPatch>();
    for (const p of group) lastPatchByField.set(p.field, p);

    const patchedFields: Record<string, unknown> = {};
    let hadValidationError = false;
    for (const p of lastPatchByField.values()) {
      const validator = config.fields[p.field];
      if (!validator) {
        result.errors.push({ entityType, entityId, field: p.field, message: `field "${p.field}" is not admin-editable` });
        hadValidationError = true;
        continue;
      }
      const parsed = validator.parse(p.value);
      if (!parsed.ok) {
        result.errors.push({ entityType, entityId, field: p.field, message: parsed.message });
        hadValidationError = true;
        continue;
      }
      patchedFields[p.field] = parsed.value;
    }
    if (hadValidationError) continue;

    const idColumn = config.table[config.idColumn];
    const [before] = await db.select().from(config.table).where(eq(idColumn, entityId));
    if (!before && !config.createIfMissing) {
      for (const p of group) result.errors.push({ entityType, entityId, field: p.field, message: `no ${entityType} found with id "${entityId}"` });
      continue;
    }

    // A row that doesn't exist yet can't conflict with anything — the
    // client's loadedUpdatedAt for it is a placeholder (see e.g. the
    // Interests screen falling back to `new Date()` when it has no meta
    // row to read one from), not a real prior save to check against.
    if (before) {
      const currentUpdatedAt: Date = before.updatedAt;
      if (currentUpdatedAt.getTime() !== Date.parse(loadedUpdatedAt)) {
        result.conflicts.push({ entityType, entityId, currentUpdatedAt: currentUpdatedAt.toISOString() });
        continue;
      }
    }

    // Editing a curve IS the act of authoring it, so the two are never
    // separate decisions for a caller to keep in sync. Any slider whose
    // curve actually changed joins authoredCurves here, which is what stops
    // withAdminAudit's refit from regenerating it from the formula on the
    // next save — see the doc comment on places.authoredCurves.
    if (patchedFields.sliderCurves && typeof patchedFields.sliderCurves === 'object') {
      const nextCurves = patchedFields.sliderCurves as Record<string, unknown>;
      const prevCurves = (before?.sliderCurves ?? {}) as Record<string, unknown>;
      const changed = Object.keys(nextCurves).filter(
        (k) => JSON.stringify(nextCurves[k]) !== JSON.stringify(prevCurves[k]),
      );
      if (changed.length > 0) {
        const alreadyAuthored = (patchedFields.authoredCurves as string[] | undefined)
          ?? (before?.authoredCurves as string[] | undefined)
          ?? [];
        patchedFields.authoredCurves = Array.from(new Set([...alreadyAuthored, ...changed]));
      }
    }

    const newUpdatedAt = new Date();
    // Per-item who/when/what — derived here from the stored version, never
    // taken from the client. See cost-item-stamp.ts.
    if (Array.isArray(patchedFields.costItems)) {
      patchedFields.costItems = stampCostItems(
        (before?.costItems ?? []) as StampedCostItem[],
        patchedFields.costItems as StampedCostItem[],
        { name: admin.email, kind: 'human' },
        newUpdatedAt,
      );
    }
    await withAdminAudit({
      actor: admin,
      entityType,
      entityId,
      action: before ? 'update' : 'create',
      before: before ?? null,
      after: before ? { ...before, ...patchedFields } : { [config.idColumn]: entityId, ...patchedFields, updatedAt: newUpdatedAt },
      write: (tx) =>
        before
          ? tx.update(config.table).set({ ...patchedFields, updatedAt: newUpdatedAt }).where(eq(idColumn, entityId))
          : tx.insert(config.table).values({ [config.idColumn]: entityId, ...patchedFields, updatedAt: newUpdatedAt }),
    });
    result.saved.push({ entityType, entityId, updatedAt: newUpdatedAt.toISOString() });
  }

  return result;
}
