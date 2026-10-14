'use client';

import { useEffect, useRef, useState } from 'react';
import { markNa, removeNa, saveNaReason } from '@/app/admin/destinations/interests/[key]/actions';
import { usePendingEdits } from './PendingEditsProvider';

/**
 * The N/A control used on the Interests x Places grid, the place profile and the interest page. Marking N/A always asks why (the
 * reason is required and saved with the flag); the ⓘ beside a flagged place edits the reason; unticking asks first, because removing
 * N/A also deletes the reason. These save straight away through server actions, not through the pending-changes tray, and tell the
 * grids the row's fresh updatedAt so a later tray edit to the same place does not read as a conflict.
 */
export function NaToggle({
  interestKey,
  interestLabel,
  placeId,
  placeName,
  isNa,
  reason,
  onChanged,
  compact,
}: {
  interestKey: string;
  interestLabel: string;
  placeId: string;
  placeName: string;
  isNa: boolean;
  reason?: string | null;
  onChanged: (isNa: boolean, reason: string | null) => void;
  /** Smaller label for dense grids. */
  compact?: boolean;
}) {
  const { announceSaved, toast } = usePendingEdits();
  const [mode, setMode] = useState<null | 'mark' | 'edit' | 'remove'>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchor = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mode) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (pop.current?.contains(t) || anchor.current?.contains(t)) return;
      setMode(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [mode]);

  function open(next: 'mark' | 'edit' | 'remove') {
    const r = anchor.current?.getBoundingClientRect();
    if (r) setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 260), left: Math.max(8, Math.min(r.left, window.innerWidth - 360)) });
    setDraft(next === 'edit' ? reason ?? '' : '');
    setError('');
    setMode(next);
  }

  async function submit() {
    setBusy(true);
    setError('');
    if (mode === 'mark') {
      const res = await markNa(interestKey, placeId, draft);
      setBusy(false);
      if (!res.ok) return setError(res.message);
      if (res.updatedAt) announceSaved([{ entityType: 'destination', entityId: placeId, updatedAt: res.updatedAt }]);
      onChanged(true, res.info.reason);
      toast(`${placeName} marked N/A for ${interestLabel}`);
    } else if (mode === 'edit') {
      const res = await saveNaReason(interestKey, placeId, draft);
      setBusy(false);
      if (!res.ok) return setError(res.message);
      onChanged(true, res.info.reason);
      toast('Reason saved');
    } else if (mode === 'remove') {
      const res = await removeNa(interestKey, placeId);
      setBusy(false);
      if (!res.ok) return setError(res.message);
      if (res.updatedAt) announceSaved([{ entityType: 'destination', entityId: placeId, updatedAt: res.updatedAt }]);
      onChanged(false, null);
      toast(`${placeName} is no longer N/A for ${interestLabel}`);
    }
    setMode(null);
  }

  return (
    <span ref={anchor} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: compact ? 10.5 : 12, color: 'var(--text-faint)', cursor: 'pointer' }}>
        <input type="checkbox" checked={isNa} onChange={(e) => open(e.target.checked ? 'mark' : 'remove')} />
        N/A
      </label>
      {isNa && (
        <button type="button" onClick={() => open('edit')} title={reason ?? 'No reason recorded yet. Click to add one.'} style={{ border: 'none', background: 'none', cursor: 'pointer', color: reason ? 'var(--accent)' : 'var(--warn)', fontSize: 12, padding: 0 }}>
          {reason ? 'ⓘ' : '⚠'}
        </button>
      )}
      {mode && (
        <div ref={pop} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 80, width: 340, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.18)', padding: 12, fontSize: 12.5 }}>
          {mode === 'remove' ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Remove N/A?</div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 10 }}>{placeName} will no longer be N/A for {interestLabel}, and its reason is deleted. It has no text for this interest until one is written.</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{mode === 'mark' ? `Why is ${placeName} not applicable for ${interestLabel}?` : 'Reason it is N/A'}</div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus placeholder="One or two sentences, at least 5 characters." style={{ width: '100%', boxSizing: 'border-box', fontSize: 12.5, padding: 6 }} />
            </>
          )}
          {error && <div style={{ color: 'var(--bad)', marginTop: 6 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            {mode === 'edit' && (
              <button type="button" className="btn" disabled={busy} onClick={() => setMode('remove')}>Remove N/A</button>
            )}
            <button type="button" className="btn" disabled={busy} onClick={() => setMode(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || (mode !== 'remove' && draft.trim().length < 5)} onClick={submit}>
              {mode === 'mark' ? 'Mark N/A' : mode === 'edit' ? 'Save reason' : 'Remove N/A'}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
