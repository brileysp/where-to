'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { applyAdminEdits, type EditPatch, type ApplyEditsResult } from '@/lib/admin/apply-edits';

type SaveSubscriber = (saved: ApplyEditsResult['saved']) => void;

export interface QueuedEdit {
  entityType: string;
  entityId: string;
  entityLabel: string;
  field: string;
  fieldLabel: string;
  oldValueLabel: string;
  newValueLabel: string;
  loadedUpdatedAt: string;
  patchValue: unknown;
  /** Reverts the caller's own local/in-memory state on undo or discard. */
  revert: () => void;
}

interface PendingEdit extends QueuedEdit {
  id: number;
}

interface ToastMessage {
  id: number;
  text: string;
  kind: 'good' | 'bad';
}

interface PendingEditsContextValue {
  pending: PendingEdit[];
  queueEdit(edit: QueuedEdit): void;
  undoEdit(id: number): void;
  discardAll(): void;
  saveAll(): Promise<void>;
  saving: boolean;
  toast(text: string, kind?: 'good' | 'bad'): void;
  toasts: ToastMessage[];
  /** Registers a callback fired with each successful save's fresh {entityType,entityId,updatedAt} — grids use this to keep their locally-cached updatedAt in sync, or their SECOND save of the same entity in one page session will false-positive as a conflict against their own first save. Returns an unsubscribe function. */
  subscribeToSaves(cb: SaveSubscriber): () => void;
}

const PendingEditsContext = createContext<PendingEditsContextValue | null>(null);

export function usePendingEdits(): PendingEditsContextValue {
  const ctx = useContext(PendingEditsContext);
  if (!ctx) throw new Error('usePendingEdits must be used inside PendingEditsProvider');
  return ctx;
}

export function PendingEditsProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingEdit[]>([]);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idSeq = useRef(1);
  const toastSeq = useRef(1);
  const saveSubscribers = useRef(new Set<SaveSubscriber>());

  const subscribeToSaves = useCallback((cb: SaveSubscriber) => {
    saveSubscribers.current.add(cb);
    return () => {
      saveSubscribers.current.delete(cb);
    };
  }, []);

  const toast = useCallback((text: string, kind: 'good' | 'bad' = 'good') => {
    const id = toastSeq.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((m) => m.id !== id)), 3200);
  }, []);

  const queueEdit = useCallback((edit: QueuedEdit) => {
    setPending((p) => [...p, { ...edit, id: idSeq.current++ }]);
  }, []);

  const undoEdit = useCallback((id: number) => {
    setPending((p) => {
      const entry = p.find((e) => e.id === id);
      entry?.revert();
      return p.filter((e) => e.id !== id);
    });
  }, []);

  const discardAll = useCallback(() => {
    setPending((p) => {
      for (const e of p) e.revert();
      return [];
    });
  }, []);

  const saveAll = useCallback(async () => {
    if (pending.length === 0) return;
    setSaving(true);
    try {
      const patches: EditPatch[] = pending.map((p) => ({
        entityType: p.entityType,
        entityId: p.entityId,
        field: p.field,
        value: p.patchValue,
        loadedUpdatedAt: p.loadedUpdatedAt,
      }));
      const result = await applyAdminEdits(patches);

      const savedKeys = new Set(result.saved.map((s) => `${s.entityType}:${s.entityId}`));
      const conflictKeys = new Set(result.conflicts.map((c) => `${c.entityType}:${c.entityId}`));

      setPending((p) => p.filter((e) => !savedKeys.has(`${e.entityType}:${e.entityId}`)));
      if (result.saved.length) for (const cb of saveSubscribers.current) cb(result.saved);

      if (result.saved.length) toast(`Saved ${result.saved.length} change${result.saved.length === 1 ? '' : 's'} · logged to audit history`, 'good');
      if (result.conflicts.length) {
        toast(`${result.conflicts.length} change${result.conflicts.length === 1 ? '' : 's'} skipped — changed elsewhere since you loaded it. Reload those rows to see the latest before retrying.`, 'bad');
      }
      if (result.errors.length) {
        const first = result.errors[0];
        toast(`${result.errors.length} change${result.errors.length === 1 ? '' : 's'} rejected — ${first.entityId} (${first.field}): ${first.message}`, 'bad');
      }
      void conflictKeys; // reserved for a future inline conflict banner (Phase 6)
    } catch {
      toast('Save failed — please try again', 'bad');
    } finally {
      setSaving(false);
    }
  }, [pending, toast]);

  const value = useMemo(
    () => ({ pending, queueEdit, undoEdit, discardAll, saveAll, saving, toast, toasts, subscribeToSaves }),
    [pending, queueEdit, undoEdit, discardAll, saveAll, saving, toast, toasts, subscribeToSaves],
  );

  return <PendingEditsContext.Provider value={value}>{children}</PendingEditsContext.Provider>;
}
