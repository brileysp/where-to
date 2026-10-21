'use client';

import { useState } from 'react';
import type { ChipRow, QuestionRow } from '@/lib/admin/interest-pages/types';
import { questionsWaitingOnDrafts } from '@/lib/onboarding/question-rules';
import type { FactDef } from '@/lib/admin/interest-pages/config';
import { createQuestion, updateQuestion, moveQuestion, deleteQuestion, setQuestionApproval, setQuestionChips, type QuestionPatch } from '@/app/admin/destinations/interests/[key]/question-actions';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Worked out from the columns the question reads: none = needs a new column; a free-text column = needs options first; otherwise ready. */
function dataState(q: QuestionRow, defs: FactDef[]): { label: string; tone: 'good' | 'warn' | 'dim' } {
  const cols = q.columns.map((k) => defs.find((d) => d.key === k)).filter((d): d is FactDef => !!d);
  if (cols.length === 0) return { label: 'Needs a column', tone: 'warn' };
  if (cols.some((d) => d.type === 'text' && !d.animals)) return { label: 'Column needs options', tone: 'warn' };
  return { label: 'Data ready', tone: 'good' };
}

export function QuestionsSection({
  interestKey,
  factDefs,
  chips,
  questions,
  setQuestions,
}: {
  interestKey: string;
  factDefs: FactDef[];
  chips: ChipRow[];
  questions: QuestionRow[];
  setQuestions: (f: (q: QuestionRow[]) => QuestionRow[]) => void;
}) {
  const sorted = [...questions].sort((a, b) => a.order - b.order);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const chipLabel = (k: string) => chips.find((c) => c.key === k)?.label ?? k;
  const waiting = questionsWaitingOnDrafts(sorted, chips.map((c) => ({ key: c.key, live: c.status === 'live' })));
  const columnsToPick = factDefs.filter((d) => !d.hidden && d.key !== 'drawSourceChecked' && d.key !== 'scopeNote' && d.type !== 'list');

  async function run<T extends { ok: boolean }>(job: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    setInfo(null);
    const r = await job();
    setBusy(false);
    if (!r.ok) {
      setError((r as unknown as { message: string }).message);
      return null;
    }
    return r;
  }
  const replace = (q: QuestionRow) => setQuestions((all) => all.map((x) => (x.key === q.key ? q : x)));

  async function save(q: QuestionRow, patch: QuestionPatch) {
    const r = await run(() => updateQuestion(interestKey, q.key, patch));
    if (!r || !r.ok) return false;
    replace(r.question);
    if (r.approvalCleared) setInfo('You changed the wording, so the approval was taken back. Approve it again when you are happy.');
    return true;
  }
  async function setWhen(q: QuestionRow, whenChips: string[]) {
    const r = await run(() => setQuestionChips(interestKey, q.key, whenChips));
    if (!r || !r.ok) return;
    replace(r.question);
    if (r.approvalCleared) setInfo('You changed who this question is asked of, so the approval was taken back. Approve it again when you are happy.');
  }
  async function approve(q: QuestionRow, approved: boolean) {
    const r = await run(() => setQuestionApproval(interestKey, q.key, approved));
    if (r && r.ok) replace(r.question);
  }
  async function add() {
    const r = await run(() => createQuestion(interestKey));
    if (!r || !r.ok) return;
    setQuestions((all) => [...all, r.question]);
    setOpen(r.question.key);
  }
  async function move(q: QuestionRow, dir: 'up' | 'down') {
    const r = await run(() => moveQuestion(interestKey, q.key, dir));
    if (!r || !r.ok) return;
    const order = new Map(r.order.map((o) => [o.key, o.order]));
    setQuestions((all) => all.map((x) => ({ ...x, order: order.get(x.key) ?? x.order })));
  }
  async function remove(q: QuestionRow) {
    if (!window.confirm(`Delete the question "${q.text}"?`)) return;
    const r = await run(() => deleteQuestion(interestKey, q.key));
    if (r) setQuestions((all) => all.filter((x) => x.key !== q.key));
  }

  return (
    <div className="ip-section" style={{ marginTop: 28 }}>
      <div className="ip-toolbar">
        <h3 style={{ margin: 0 }}>Onboarding questions</h3>
        <span className={`ip-chip ${sorted.some((q) => q.approvedAt) ? 'info' : 'dim'}`}>{sorted.filter((q) => q.approvedAt).length} of {sorted.length} approved</span>
        <span className="ip-faint">What a traveler is asked about this interest. Not asked in the app yet.</span>
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
        {info && <span className="ip-faint">{info}</span>}
      </div>

      {waiting.length > 0 && (
        <div className="ip-card" style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)' }}>
          <b>Waiting on draft chips.</b> {waiting.map((q) => `“${q.text}”`).join(', ')} {waiting.length === 1 ? 'is' : 'are'} opened only by chips that are not live yet, so nobody is asked {waiting.length === 1 ? 'it' : 'them'} until one goes live.
        </div>
      )}
      {sorted.length === 0 && <div className="ip-card"><p className="ip-muted" style={{ margin: 0 }}>No questions yet for this interest. Add the first one below.</p></div>}

      {sorted.map((q, i) => {
        const st = dataState(q, factDefs);
        const isOpen = open === q.key;
        return (
          <div key={q.key} className="ip-card ip-q">
            <div className="ip-q-head">
              <span style={{ whiteSpace: 'nowrap' }}>
                <button className="ip-link-btn" disabled={busy || i === 0} title="Move earlier" onClick={() => move(q, 'up')}>▲</button>
                <button className="ip-link-btn" disabled={busy || i === sorted.length - 1} title="Move later" onClick={() => move(q, 'down')}>▼</button>
              </span>
              <b className="ip-q-text" onClick={() => setOpen(isOpen ? null : q.key)}>{i + 1}. {q.text}{q.maxPicks > 1 ? ` (pick up to ${q.maxPicks})` : ''}</b>
              <span className={`ip-chip ${q.kind === 'limit' ? 'warn' : 'dim'}`} title={q.kind === 'limit' ? 'The answer can rule a place out' : 'The answer nudges places up or down'}>{q.kind === 'limit' ? 'Limit' : 'Lean'}</span>
              <span className={`ip-chip ${st.tone}`}>{st.label}</span>
              <span className={`ip-chip ${q.whenChips.length ? 'new' : 'dim'}`} title={q.whenChips.length ? 'Only asked when one of these chips is ticked' : 'Asked of everyone who picks this interest'}>{q.whenChips.length ? 'Only when a chip is ticked' : 'Always asked'}</span>
              {q.approvedAt
                ? <span className="ip-chip good" title={`Approved by ${q.approvedBy} on ${when(q.approvedAt)}`}>✓ {when(q.approvedAt)}</span>
                : <button className="ip-link-btn" disabled={busy} onClick={() => approve(q, true)}>Approve</button>}
            </div>
            {q.whenChips.length > 0 && <div className="ip-faint ip-q-opts" style={{ color: 'var(--cat-1)' }}>Asked when any of these is ticked: {q.whenChips.map(chipLabel).join(', ')}</div>}
            {!isOpen && <div className="ip-faint ip-q-opts">{q.options.join(' · ')}{q.columns.length > 0 && <> — reads: {q.columns.map((k) => factDefs.find((d) => d.key === k)?.label ?? k).join(', ')}</>}</div>}
            {isOpen && <QuestionEditor q={q} busy={busy} chips={chips} columnsToPick={columnsToPick} onSetWhen={(c) => setWhen(q, c)} onSave={(p) => save(q, p)} onApprove={(a) => approve(q, a)} onDelete={() => remove(q)} />}
          </div>
        );
      })}
      <div className="ip-toolbar"><button className="btn" disabled={busy} onClick={add}>+ New question</button></div>
    </div>
  );
}

function QuestionEditor({ q, busy, chips, columnsToPick, onSetWhen, onSave, onApprove, onDelete }: { q: QuestionRow; busy: boolean; chips: ChipRow[]; columnsToPick: FactDef[]; onSetWhen: (chipKeys: string[]) => void; onSave: (p: QuestionPatch) => Promise<boolean>; onApprove: (a: boolean) => void; onDelete: () => void }) {
  const [text, setText] = useState(q.text);
  const [options, setOptions] = useState(q.options.join('\n'));
  const [note, setNote] = useState(q.note);
  const [miss, setMiss] = useState(q.missMessage);
  const parsed = options.split('\n').map((s) => s.trim()).filter(Boolean);
  const dirty = text.trim() !== q.text || JSON.stringify(parsed) !== JSON.stringify(q.options) || note.trim() !== q.note || miss.trim() !== q.missMessage;
  return (
    <div className="ip-q-edit">
      <label className="ip-faint">Question</label>
      <input className="ip-ch-name" style={{ width: '100%' }} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
      <label className="ip-faint">Answers, one per line</label>
      <textarea className="ip-ch-name" style={{ width: '100%', minHeight: 96 }} value={options} onChange={(e) => setOptions(e.target.value)} />
      <div className="ip-toolbar">
        <label className="ip-ch-lab">Picks allowed <select className="ip-select" value={q.maxPicks} disabled={busy} onChange={(e) => void onSave({ maxPicks: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n === 1 ? 'One' : `Up to ${n}`}</option>)}</select></label>
        <label className="ip-ch-lab">Kind <select className="ip-select" value={q.kind} disabled={busy} onChange={(e) => void onSave({ kind: e.target.value as 'lean' | 'limit' })}><option value="lean">Lean (nudges)</option><option value="limit">Limit (can rule out)</option></select></label>
      </div>
      <div className="ip-faint">Reads these columns (the answer is matched against them)</div>
      <div className="ip-ch-pills">
        {q.columns.map((k) => <i key={k}>{columnsToPick.find((d) => d.key === k)?.label ?? k} <button className="ip-link-btn danger" disabled={busy} aria-label="Remove column" onClick={() => void onSave({ columns: q.columns.filter((c) => c !== k) })}>✕</button></i>)}
        {q.columns.length === 0 && <i className="new">no column yet</i>}
      </div>
      {q.columns.length < 6 && (
        <select className="ip-select" value="" disabled={busy} aria-label="Add a column" onChange={(e) => { if (e.target.value) void onSave({ columns: [...q.columns, e.target.value] }); }}>
          <option value="">+ Add a column…</option>
          {columnsToPick.filter((d) => !q.columns.includes(d.key)).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      )}
      <div className="ip-faint">When should this question be asked?</div>
      <div className="ip-toolbar">
        <label className="ip-ch-lab"><input type="radio" name={`when-${q.key}`} checked={q.whenChips.length === 0} disabled={busy} onChange={() => onSetWhen([])} /> Always</label>
        <label className="ip-ch-lab"><input type="radio" name={`when-${q.key}`} checked={q.whenChips.length > 0} disabled={busy || chips.length === 0} onChange={() => { if (q.whenChips.length === 0 && chips[0]) onSetWhen([chips[0].key]); }} /> Only when the traveler ticks one of these chips</label>
      </div>
      {q.whenChips.length > 0 && (
        <div className="ip-ch-pills">
          {chips.map((c) => {
            const on = q.whenChips.includes(c.key);
            return (
              <label key={c.key} className="ip-ch-lab" style={{ border: '1px solid var(--border-strong)', borderRadius: 999, padding: '3px 10px', ...(on ? { borderColor: 'var(--cat-1)', background: 'var(--cat-1-soft)' } : {}) }}>
                <input type="checkbox" checked={on} disabled={busy || (on && q.whenChips.length === 1)} onChange={() => onSetWhen(on ? q.whenChips.filter((k) => k !== c.key) : [...q.whenChips, c.key])} /> {c.label}{c.status !== 'live' ? ' (draft)' : ''}
              </label>
            );
          })}
        </div>
      )}
      <div className="ip-faint">Changing this takes back the approval, the same as changing the wording. The last chip cannot be unticked here; choose Always instead.</div>
      <label className="ip-faint">How the answer is used (a note)</label>
      <input className="ip-ch-name" style={{ width: '100%' }} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      <label className="ip-faint">Reason chip when this answer knocks a place down, e.g. &ldquo;Water colder than your limit&rdquo; (blank = no chip)</label>
      <input className="ip-ch-name" style={{ width: '100%' }} value={miss} maxLength={60} onChange={(e) => setMiss(e.target.value)} />
      <div className="ip-toolbar">
        <button className="btn btn-primary" disabled={busy || !dirty} onClick={() => void onSave({ text: text.trim(), options: parsed, note: note.trim(), missMessage: miss.trim() })}>Save wording</button>
        {q.approvedAt && <button className="ip-link-btn" disabled={busy} onClick={() => onApprove(false)}>Take back approval</button>}
        <span className="grow" />
        <button className="ip-link-btn danger" disabled={busy} onClick={onDelete}>Delete question</button>
      </div>
    </div>
  );
}
