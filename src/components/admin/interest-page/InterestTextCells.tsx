'use client';

import { useUnitText } from '@/components/UnitsProvider';
import { useEffect, useRef, useState } from 'react';
import { applyStagedDraft, discardStagedDraft, saveInterestMonthly, saveInterestOverview } from '@/app/admin/destinations/interests/[key]/actions';
import type { InterestPlaceRow } from '@/lib/admin/interest-pages/types';
import { usePendingEdits } from '../PendingEditsProvider';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Patch = Partial<InterestPlaceRow>;

/** The place's overview for this interest: click to read it in full and edit it. Saves straight away. */
export function OverviewCell({ interestKey, place, onPlace }: { interestKey: string; place: InterestPlaceRow; onPlace: (id: string, patch: Patch) => void }) {
  const { announceSaved, toast } = usePendingEdits();
  const [pop, setPop] = useState<{ top: number; left: number; width: number } | null>(null);
  const u = useUnitText();
  const [draft, setDraft] = useState(place.overview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cell = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pop) return;
    const close = (e: Event) => { if (box.current?.contains(e.target as Node)) return; setPop(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pop]);

  function open() {
    const r = cell.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(520, window.innerWidth - 24);
    setDraft(place.overview);
    setError('');
    setPop({ top: Math.min(r.bottom + 4, Math.max(12, window.innerHeight - 360)), left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)), width });
  }
  async function save() {
    setBusy(true);
    setError('');
    const res = await saveInterestOverview(interestKey, place.id, draft);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.updatedAt) announceSaved([{ entityType: 'destination', entityId: place.id, updatedAt: res.updatedAt }]);
    onPlace(place.id, { overview: draft.trim(), status: place.status === 'none' && draft.trim() ? 'live' : place.status });
    toast(`${place.name}: overview saved`);
    setPop(null);
  }

  // The clipped preview is shown in the viewer's units; the editor below always holds the stored text (US units).
  const shown = u(place.overview);
  return (
    <>
      <div ref={cell} className="cell-inner ip-factcell ip-longcell" role="button" tabIndex={0} style={{ width: 260, minWidth: 260, maxWidth: 260 }} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }} title={shown || 'Click to write the overview'}>
        <span className="ip-clip" style={{ display: 'block', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>{shown ? shown : <span className="ip-faint">{place.status === 'na' ? '—' : 'Click to write…'}</span>}</span>
      </div>
      {pop && (
        <div ref={box} className="ip-pop" style={{ top: pop.top, left: pop.left, width: pop.width }} role="dialog" aria-label="Overview">
          <div className="ip-pop-head"><b>{place.name}: overview</b><span className="ip-pop-actions"><button type="button" onClick={() => setPop(null)}>Close</button></span></div>
          <textarea className="cost-input ip-longbox" rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <div className="ip-faint" style={{ fontSize: 11.5, marginTop: 4 }}>{draft.trim().length} characters. Text is stored in US units (°F, feet, miles), whatever your home country shows elsewhere. Saves straight away, not through the pending-changes tray. An empty box removes the overview.</div>
          {error && <div className="ip-err">{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn" disabled={busy} onClick={() => setPop(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || draft.trim() === place.overview} onClick={save}>Save overview</button>
          </div>
        </div>
      )}
    </>
  );
}

/** The twelve monthly blurbs: click to open all twelve, each beside its score for the month. Saves straight away. */
export function MonthlyCell({ interestKey, place, onPlace }: { interestKey: string; place: InterestPlaceRow; onPlace: (id: string, patch: Patch) => void }) {
  const { announceSaved, toast } = usePendingEdits();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const written = place.monthlyText.filter((m) => m && m.trim()).length;

  function show() {
    setDraft(Array.from({ length: 12 }, (_, i) => place.monthlyText[i] ?? ''));
    setError('');
    setOpen(true);
  }
  async function save() {
    setBusy(true);
    setError('');
    const months = draft.map((t) => (t.trim() === '' ? null : t.trim()));
    const res = await saveInterestMonthly(interestKey, place.id, months);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.updatedAt) announceSaved([{ entityType: 'destination', entityId: place.id, updatedAt: res.updatedAt }]);
    onPlace(place.id, { monthlyText: months });
    toast(`${place.name}: monthly text saved`);
    setOpen(false);
  }

  return (
    <>
      <div className="cell-inner ip-factcell" role="button" tabIndex={0} onClick={show} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } }} style={{ cursor: 'pointer' }}>
        {place.status === 'na' ? <span className="ip-faint">—</span> : <span className={`ip-chip ${written === 12 ? 'good' : written === 0 ? 'dim' : 'warn'}`}>{written} of 12</span>}
      </div>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel" style={{ maxWidth: 760 }}>
            <div className="panel-head">
              <div><h2>{place.name}: monthly text</h2><p>Each month&apos;s blurb with its score. Saves straight away.</p></div>
              <button className="panel-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MONTHS.map((m, i) => (
                <div key={m} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 8, alignItems: 'start' }}>
                  <div style={{ fontSize: 12.5 }}><b>{m}</b><div className="ip-faint ip-mono">score {place.monthly[i] !== undefined ? place.monthly[i].toFixed(1) : '-'}</div></div>
                  <textarea className="field-textarea" rows={2} value={draft[i] ?? ''} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))} />
                </div>
              ))}
              {error && <div className="ip-err">{error}</div>}
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save monthly text</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Apply or discard a staged Gemini draft from its row. */
export function StagedButtons({ interestKey, place, onPlace }: { interestKey: string; place: InterestPlaceRow; onPlace: (id: string, patch: Patch) => void }) {
  const { announceSaved, toast } = usePendingEdits();
  const [busy, setBusy] = useState<null | 'apply' | 'discard'>(null);
  const [error, setError] = useState('');
  if (place.status !== 'staged' || !place.stagedGenerationId) return null;
  const id = place.stagedGenerationId;

  async function apply() {
    if (!window.confirm(`Put the staged draft for ${place.name} live? It replaces the current text and scores for this interest.`)) return;
    setBusy('apply');
    setError('');
    const res = await applyStagedDraft(interestKey, id);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    toast(`${place.name}: draft is live. Reload the page to see the new text and scores.`);
    announceSaved([]);
    onPlace(place.id, { status: res.notApplicable ? 'na' : 'live', stagedGenerationId: null });
  }
  async function discard() {
    if (!window.confirm(`Discard the staged draft for ${place.name}? The text stays in the record but will not be offered again.`)) return;
    setBusy('discard');
    setError('');
    const res = await discardStagedDraft(interestKey, id);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    toast(`${place.name}: draft discarded`);
    onPlace(place.id, { status: place.overview ? 'live' : 'none', stagedGenerationId: null });
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button type="button" className="btn btn-primary" style={{ padding: '2px 8px', fontSize: 11 }} disabled={!!busy} onClick={apply}>{busy === 'apply' ? 'Applying…' : 'Apply draft'}</button>
      <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: 11 }} disabled={!!busy} onClick={discard}>Discard</button>
      {error && <span className="ip-err" title={error}>!</span>}
    </span>
  );
}
