'use client';

import { useEffect } from 'react';
import { usePendingEdits } from './PendingEditsProvider';
import type { ApplyEditsResult } from '@/lib/admin/apply-edits';

/**
 * Keeps a grid's locally-held `updatedAt` per row in sync with what just
 * got written. Every field edit's optimistic-lock check is a snapshot of
 * `updatedAt` from whenever the row was loaded — without this, a row's
 * SECOND save in the same page session compares against its own
 * first save's now-stale timestamp and false-positives as "changed by
 * someone else." `entityType` scopes this grid to only the saves it cares
 * about (a page rendering both 'destination' and 'interest' rows, say,
 * shouldn't rewrite `updatedAt` for the wrong shape of row).
 */
export function useUpdatedAtSync(entityType: string, onSaved: (entityId: string, updatedAt: string) => void) {
  const { subscribeToSaves } = usePendingEdits();
  useEffect(() => {
    return subscribeToSaves((saved: ApplyEditsResult['saved']) => {
      for (const s of saved) {
        if (s.entityType === entityType) onSaved(s.entityId, s.updatedAt);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);
}
