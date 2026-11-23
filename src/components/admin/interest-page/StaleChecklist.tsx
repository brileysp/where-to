'use client';

import { useEffect, useMemo, useState } from 'react';
import { STALE_CATEGORIES, STALE_CHECKERS, STALE_SITE_KEY } from '@/lib/db/schema';
import {
  CHECKER_LABEL, EVERY_LABEL, RESULT_LABEL, askedThisRound, factorStatus, roundProgress, summarize,
  type StaleCategory, type StaleChecker, type StaleEvery, type StaleFactorRow, type StaleResult,
} from '@/lib/admin/stale-checks';
import { addFactor, loadChecklist, recordCheck, setFactorActive, setOptOut, updateFactor, type ReviewRound } from '@/app/admin/destinations/interests/[key]/stale-actions';
import { CADENCE_LABEL, reviewCadence } from '@/lib/scoring/planning';

type Draft = { category: StaleCategory; statement: string; howToCheck: string; checker: StaleChecker; checkEvery: '' | StaleEvery };
const blank = (): Draft => ({ category: STALE_CATEGORIES[0], statement: '', howToCheck: '', checker: 'owner', checkEvery: '' });
const fromRow = (f: StaleFactorRow): Draft => ({ category: f.category, statement: f.statement, howToCheck: f.howToCheck, checker: f.checker, checkEvery: f.checkEvery ?? '' });
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const RESULTS: StaleResult[] = ['checked', 'changed', 'na'];

/**
 * Why this interest's data goes stale: one row per reason, each asked at every review (13 Nov 2026). Used on the interest page, inside the To do tab's review items, and (with
 * interestKey '_site') as the editor for the reasons that apply to every interest. With an open review to-do each reason gets a result for that round; the to-do cannot be ticked
 * done until all the reasons asked have one. A site-wide reason is asked once per its own interval for each interest, and an interest can opt out of one.
 */
export function StaleChecklist({ interestKey, evergreen, todoId = null, initial }: { interestKey: string; evergreen: number | null; todoId?: string | null; /** Already-loaded data (used by tests); skips the first load. */ initial?: { factors: StaleFactorRow[]; round: ReviewRound | null } }) {
  const siteMode = interestKey === STALE_SITE_KEY;
  const [factors, setFactors] = useState<StaleFactorRow[] | null>(initial?.factors ?? null);
  const [round, setRound] = useState<ReviewRound | null>(initial?.round ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [optNote, setOptNote] = useState<{ id: string; note: string } | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  useEffect(() => {
    if (initial) return;
    let live = true;
    loadChecklist(interestKey, todoId).then((r) => { if (!live) return; if (r.ok) { setFactors(r.factors); setRound(r.round); } else setError(r.message); });
    return () => { live = false; };
  }, [interestKey, todoId, initial]);

  const roundId = round?.id ?? null;
  async function run(fn: () => Promise<{ ok: true; factors: StaleFactorRow[] } | { ok: false; message: string }>, after?: () => void) {
    setBusy(true); setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setFactors(r.factors); after?.();
  }

  const list = factors ?? [];
  const own = list.filter((f) => !f.inherited);
  const inherited = list.filter((f) => f.inherited);
  const progress = roundProgress(list, evergreen);
  const sum = useMemo(() => summarize(list, evergreen), [list, evergreen]);
  const grouped = useMemo(() => STALE_CATEGORIES.map((c) => ({ c, rows: own.filter((f) => f.category === c && (showRetired || f.active)) })).filter((g) => g.rows.length), [own, showRetired]);
  const retiredCount = own.filter((f) => !f.active).length;
  const cadence = evergreen == null ? null : CADENCE_LABEL[reviewCadence(evergreen)];

  if (factors === null) return <p className="ip-faint">{error ?? 'Loading the reasons…'}</p>;

  const resultButtons = (f: StaleFactorRow) => (
    <div className="ip-stale-actions">
      {RESULTS.map((r) => (
        <button key={r} type="button" disabled={busy} className={`ip-stale-btn${f.thisRound?.result === r ? ' on' : ''}`}
          onClick={() => run(() => recordCheck(f.id, roundId, { result: r, note: notes[f.id] ?? f.thisRound?.note ?? '' }, interestKey))}>{RESULT_LABEL[r]}</button>
      ))}
      <input type="text" placeholder="Note (required if changed)" maxLength={1000} value={notes[f.id] ?? f.thisRound?.note ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))} />
    </div>
  );
  const lastLine = (f: StaleFactorRow) => {
    const status = factorStatus(f, evergreen);
    return (
      <div className="ip-stale-meta">
        {f.last ? <>Last: {RESULT_LABEL[f.last.result].toLowerCase()}, {fmt(f.last.checkedAt)}{f.last.checkedBy ? ` by ${f.last.checkedBy}` : ''}{f.last.note ? ` · ${f.last.note}` : ''} </> : 'Never checked. '}
        <span className={`ip-chip ${status === 'current' ? 'good' : status === 'overdue' ? 'bad' : 'info'}`}>{status === 'never' ? 'never checked' : status}</span>
        {!f.active && <span className="ip-chip warn" style={{ marginLeft: 6 }}>retired</span>}
      </div>
    );
  };
  const metaLine = (f: StaleFactorRow) => (
    <div className="ip-stale-meta">
      {f.howToCheck ? <><b>How to check:</b> {f.howToCheck}</> : <i>How to check: not written yet.</i>}
      {' · '}Checked by {CHECKER_LABEL[f.checker].toLowerCase()}{f.checkEvery ? ` · ${EVERY_LABEL[f.checkEvery].toLowerCase()}` : ''}
    </div>
  );

  return (
    <div>
      <div className="ip-stale-head">
        <b>{siteMode ? 'Reasons that apply to every interest' : 'Staleness checks'}</b>
        <span className="ip-faint">{siteMode ? 'Held once here and asked in each interest\'s review, once per reason\'s own interval. An interest can mark one as not applying to it.' : `Why correct data here can become wrong. Every active reason is asked at each review${cadence ? ` (${cadence.toLowerCase()})` : ''}.`}</span>
      </div>
      {!siteMode && (round ? (
        <>
          <div><b>This review:</b> {progress.done} of {progress.total} reasons have a result{round.dueOn ? <span className="ip-faint"> (check on {round.dueOn})</span> : null}. {progress.missing === 0 ? <span className="ip-chip good">ready to tick done</span> : <span className="ip-chip warn">{progress.missing} to go</span>}</div>
          <div className="ip-stale-bar"><i style={{ width: `${progress.total ? (100 * progress.done) / progress.total : 0}%` }} /></div>
        </>
      ) : <p className="ip-faint">No open review for this interest, so results are recorded outside a review round.</p>)}
      {!siteMode && (
        <div className="ip-faint" style={{ marginBottom: 6 }}>
          {sum.total} reasons: {sum.current} current, {sum.overdue > 0 ? <span className="ip-chip bad">{sum.overdue} overdue</span> : '0 overdue'}, {sum.never} never checked. {sum.noHow > 0 ? `${sum.noHow} have no "how to check" written yet.` : ''}
        </div>
      )}
      {error && <p style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</p>}

      {grouped.map(({ c, rows }) => (
        <div key={c}>
          <div className="ip-stale-cat">{c}</div>
          {rows.map((f) => {
            const editingThis = editing?.id === f.id;
            return (
              <div key={f.id} className={`ip-stale-row${f.active ? '' : ' retired'}`}>
                <div className="st">{f.statement}</div>
                {metaLine(f)}
                {!siteMode && lastLine(f)}
                {!siteMode && f.active && roundId && resultButtons(f)}
                <div className="ip-stale-actions">
                  <button type="button" className="ip-link-btn" disabled={busy} onClick={() => setEditing(editingThis ? null : { id: f.id, draft: fromRow(f) })}>{editingThis ? 'Close' : 'Edit'}</button>
                  <button type="button" className="ip-link-btn danger" disabled={busy} onClick={() => run(() => setFactorActive(f.id, !f.active, roundId))}>{f.active ? 'Retire' : 'Restore'}</button>
                </div>
                {editingThis && editing && <FactorForm draft={editing.draft} busy={busy} onChange={(d) => setEditing({ id: f.id, draft: d })} onSave={() => run(() => updateFactor(f.id, { ...editing.draft, checkEvery: editing.draft.checkEvery || null }, roundId), () => setEditing(null))} saveLabel="Save changes" />}
              </div>
            );
          })}
        </div>
      ))}

      {!siteMode && inherited.filter((f) => f.active).length > 0 && (
        <div>
          <div className="ip-stale-cat">Reasons that apply to every interest</div>
          {inherited.filter((f) => f.active).map((f) => {
            const asked = askedThisRound(f, evergreen);
            return (
              <div key={f.id} className={`ip-stale-row${f.optedOut ? ' retired' : ''}`}>
                <div className="st">{f.statement}</div>
                <div className="ip-stale-meta"><span className="ip-chip info">{f.category}</span> </div>
                {metaLine(f)}
                {f.optedOut ? (
                  <div className="ip-stale-meta">Does not apply to this interest: {f.optOutNote}. <button type="button" className="ip-link-btn" disabled={busy} onClick={() => run(() => setOptOut(interestKey, f.id, false, '', roundId))}>Ask again</button></div>
                ) : (
                  <>
                    {lastLine(f)}
                    {roundId && asked && resultButtons(f)}
                    {roundId && !asked && <div className="ip-stale-meta">Not due this review: checked inside its own interval.</div>}
                    <div className="ip-stale-actions">
                      {optNote?.id === f.id ? (
                        <>
                          <input type="text" autoFocus placeholder="Why it does not apply to this interest" maxLength={300} value={optNote.note} onChange={(e) => setOptNote({ id: f.id, note: e.target.value })} />
                          <button type="button" className="ip-stale-btn on" disabled={busy || optNote.note.trim().length < 3} onClick={() => run(() => setOptOut(interestKey, f.id, true, optNote.note, roundId), () => setOptNote(null))}>Save</button>
                          <button type="button" className="ip-link-btn" onClick={() => setOptNote(null)}>Cancel</button>
                        </>
                      ) : <button type="button" className="ip-link-btn" disabled={busy} onClick={() => setOptNote({ id: f.id, note: '' })}>Does not apply to this interest</button>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="ip-stale-btn" onClick={() => setEditing(editing?.id === null ? null : { id: null, draft: blank() })}>{editing?.id === null ? 'Cancel' : 'Add a reason'}</button>
        {retiredCount > 0 && <button type="button" className="ip-link-btn" onClick={() => setShowRetired((v) => !v)}>{showRetired ? 'Hide' : 'Show'} {retiredCount} retired</button>}
      </div>
      {editing?.id === null && <FactorForm draft={editing.draft} busy={busy} onChange={(d) => setEditing({ id: null, draft: d })} onSave={() => run(() => addFactor(interestKey, { ...editing.draft, checkEvery: editing.draft.checkEvery || null }, roundId), () => setEditing(null))} saveLabel="Add reason" />}
    </div>
  );
}

function FactorForm({ draft, busy, onChange, onSave, saveLabel }: { draft: Draft; busy: boolean; onChange: (d: Draft) => void; onSave: () => void; saveLabel: string }) {
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p });
  return (
    <div className="ip-stale-form">
      <label className="full">Reason it could go stale<textarea rows={2} maxLength={600} value={draft.statement} onChange={(e) => set({ statement: e.target.value })} /></label>
      <label className="full">How to check it (the source or page to look at)<textarea rows={2} maxLength={800} value={draft.howToCheck} onChange={(e) => set({ howToCheck: e.target.value })} /></label>
      <label>Type<select value={draft.category} onChange={(e) => set({ category: e.target.value as StaleCategory })}>{STALE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      <label>Who checks<select value={draft.checker} onChange={(e) => set({ checker: e.target.value as StaleChecker })}>{STALE_CHECKERS.map((c) => <option key={c} value={c}>{CHECKER_LABEL[c]}</option>)}</select></label>
      <label>Own schedule (otherwise the interest&apos;s)<select value={draft.checkEvery} onChange={(e) => set({ checkEvery: e.target.value as '' | StaleEvery })}><option value="">Same as the interest</option>{(Object.keys(EVERY_LABEL) as StaleEvery[]).map((k) => <option key={k} value={k}>{EVERY_LABEL[k]}</option>)}</select></label>
      <div className="full"><button type="button" className="ip-stale-btn on" disabled={busy || draft.statement.trim().length < 3} onClick={onSave}>{saveLabel}</button></div>
    </div>
  );
}
