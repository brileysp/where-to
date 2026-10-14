'use client';

import { useEffect, useRef, useState } from 'react';
import { removeNa, saveNaReason } from '@/app/admin/destinations/interests/[key]/actions';
import type { InterestPlaceRow, NaReasonInfo } from '@/lib/admin/interest-pages/types';

export type NaChange = { kind: 'reason'; info: NaReasonInfo } | { kind: 'removed' };

function sourceLine(info: NaReasonInfo): string {
  const day = info.at.slice(0, 10);
  if (info.source === 'gemini') return `Gemini · ${day}`;
  if (info.source === 'imported') return `Imported note · ${day}`;
  return `Edited by ${info.by} · ${day}`;
}

/**
 * The "N/A" status chip. Its ⓘ opens a small popover with the reason this place is not applicable for the interest,
 * where the reason can be edited and the N/A flag removed.
 */
export function NaReasonChip({ interestKey, place, onChange }: { interestKey: string; place: InterestPlaceRow; onChange: (placeId: string, change: NaChange) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>('view');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const info = place.naReason;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', () => setOpen(false), { capture: true, once: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  function toggle() {
    if (open) return setOpen(false);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 280), left: Math.max(8, Math.min(r.left, window.innerWidth - 380)) });
    setMode('view');
    setError('');
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError('');
    const res = await saveNaReason(interestKey, place.id, draft);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    onChange(place.id, { kind: 'reason', info: res.info });
    setMode('view');
  }

  async function remove() {
    setBusy(true);
    setError('');
    const res = await removeNa(interestKey, place.id);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    onChange(place.id, { kind: 'removed' });
    setOpen(false);
  }

  return (
    <>
      <button ref={btnRef} type="button" className="ip-chip dim ip-nachip" onClick={toggle} title={info ? info.reason : 'No reason recorded yet'} aria-expanded={open}>
        N/A <span aria-hidden>ⓘ</span>
      </button>
      {open && (
        <div ref={popRef} className="ip-napop" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label={`Why ${place.name} is not applicable`}>
          <div className="ip-toollabel">Why not applicable · {place.name}</div>
          {mode === 'edit' ? (
            <>
              <textarea className="ip-reason" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus />
              <div className="ip-toolbar">
                <button className="btn btn-primary" disabled={busy} onClick={save}>Save</button>
                <button className="btn" disabled={busy} onClick={() => setMode('view')}>Cancel</button>
              </div>
              <div className="ip-faint ip-nasmall">Saved with your name and the date. The original wording stays on record.</div>
            </>
          ) : (
            <>
              <p className="ip-reasontext">{info ? info.reason : 'No reason has been recorded for this place yet.'}</p>
              {info && <div className="ip-faint ip-nasmall">{sourceLine(info)}</div>}
              {info?.geminiText && <details className="ip-nasmall ip-faint"><summary>Original Gemini wording</summary>{info.geminiText}</details>}
              {mode === 'confirm' ? (
                <div className="ip-toolbar">
                  <span className="ip-muted ip-nasmall">Take {place.name} off the N/A list for this interest?</span>
                  <button className="btn btn-primary" disabled={busy} onClick={remove}>Yes, remove N/A</button>
                  <button className="btn" disabled={busy} onClick={() => setMode('view')}>Cancel</button>
                </div>
              ) : (
                <div className="ip-toolbar">
                  <button className="btn" onClick={() => { setDraft(info?.reason ?? ''); setMode('edit'); }}>Edit reason</button>
                  <button className="btn" onClick={() => setMode('confirm')}>Remove N/A</button>
                </div>
              )}
            </>
          )}
          {error && <div className="ip-err">{error}</div>}
        </div>
      )}
    </>
  );
}
