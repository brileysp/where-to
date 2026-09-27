'use client';

import { usePendingEdits } from './PendingEditsProvider';

export interface FieldEditParams<V> {
  entityType: string;
  entityId: string;
  entityLabel: string;
  field: string;
  fieldLabel: string;
  loadedUpdatedAt: string;
  oldValue: V;
  newValue: V;
  /** Defaults to identity — override when the DB column shape differs from the edited value (e.g. a whole-object jsonb column where only one key changed). */
  toPatchValue?: (v: V) => unknown;
  /** Defaults to String(v) — override for a friendlier tray/modal diff label. */
  toLabel?: (v: V) => string;
  /** Sets the caller's own local row state to the given value (used both to apply immediately and to revert on undo). */
  setLocal: (v: V) => void;
}

/**
 * The one piece of plumbing every inline-editable cell across every admin
 * grid uses: apply the edit to local state immediately (so the grid feels
 * instant), then queue a diff into the shared Pending tray — nothing
 * writes to the database until "Review & save". Mirrors the mockup's own
 * addPending() helper, properly typed and wired to React state instead of
 * mutating a plain JS object.
 */
export function useFieldEdit() {
  const { queueEdit } = usePendingEdits();
  return function commitFieldEdit<V>(p: FieldEditParams<V>) {
    if (JSON.stringify(p.oldValue) === JSON.stringify(p.newValue)) return;
    const toLabel = p.toLabel ?? ((v: V) => (v === null || v === undefined || v === '' ? '(empty)' : String(v)));
    const toPatchValue = p.toPatchValue ?? ((v: V) => v);
    p.setLocal(p.newValue);
    queueEdit({
      entityType: p.entityType,
      entityId: p.entityId,
      entityLabel: p.entityLabel,
      field: p.field,
      fieldLabel: p.fieldLabel,
      oldValueLabel: toLabel(p.oldValue),
      newValueLabel: toLabel(p.newValue),
      loadedUpdatedAt: p.loadedUpdatedAt,
      patchValue: toPatchValue(p.newValue),
      revert: () => p.setLocal(p.oldValue),
    });
  };
}
