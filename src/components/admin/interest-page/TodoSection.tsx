'use client';

import { useMemo, useState } from 'react';
import type { TodoRow } from '@/lib/admin/interest-pages/types';
import { Linked } from './Linked';
import { INTEREST_TODO_STATUSES, type InterestTodoStatus } from '@/lib/db/schema';
import { addTodo, updateTodo, deleteTodo, bulkUpdateTodos } from '@/app/admin/destinations/interests/[key]/actions';

const STATUS: Record<InterestTodoStatus, { label: string; tone: string }> = {
  needs_you: { label: 'Needs you', tone: 'warn' },
  ready_for_claude: { label: 'Ready for Claude', tone: 'info' },
  waiting: { label: 'Waiting', tone: 'dim' },
  idea: { label: 'Idea', tone: 'new' },
  done: { label: 'Done', tone: 'good' },
};
const PRIORITY: Record<number, string> = { 1: 'High', 2: 'Normal', 3: 'Low' };

const fmt = (iso: string) => iso.slice(0, 10);

type Patch = Partial<Pick<TodoRow, 'title' | 'detail' | 'status' | 'source' | 'placeId' | 'closeOnApply' | 'priority'>>;
type PlaceOption = { id: string; name: string };

export function TodoSection({ interestKey, todos, setTodos, placeOptions }: { interestKey: string; todos: TodoRow[]; setTodos: (f: (t: TodoRow[]) => TodoRow[]) => void; placeOptions: PlaceOption[] }) {
  const [filter, setFilter] = useState<'open' | InterestTodoStatus | 'all'>('open');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState({ title: '', detail: '', status: 'needs_you' as InterestTodoStatus, source: '', placeId: null as string | null, closeOnApply: false, priority: 2 });
  const placeName = useMemo(() => new Map(placeOptions.map((p) => [p.id, p.name])), [placeOptions]);

  const shown = todos
    .filter((t) => (filter === 'all' ? true : filter === 'open' ? t.status !== 'done' : t.status === filter))
    .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));

  async function create() {
    setBusy(true); setError(null);
    const r = await addTodo(interestKey, draft);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTodos((t) => [...t, r.todo]);
    setDraft({ title: '', detail: '', status: 'needs_you', source: '', placeId: null, closeOnApply: false, priority: 2 });
    setAdding(false);
  }
  async function save(t: TodoRow, patch: Patch) {
    setBusy(true); setError(null);
    const r = await updateTodo(interestKey, t.id, { title: t.title, detail: t.detail, status: t.status, source: t.source, placeId: t.placeId, closeOnApply: t.closeOnApply, priority: t.priority, ...patch });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTodos((all) => all.map((x) => (x.id === t.id ? r.todo : x)));
    setEditing(null);
  }
  async function remove(t: TodoRow) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    setBusy(true); setError(null);
    const r = await deleteTodo(interestKey, t.id);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTodos((all) => all.filter((x) => x.id !== t.id));
    setPicked((p) => p.filter((id) => id !== t.id));
  }
  async function bulk(patch: { status?: InterestTodoStatus; priority?: number }) {
    if (picked.length === 0) return;
    setBusy(true); setError(null);
    const r = await bulkUpdateTodos(interestKey, picked, patch);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setTodos((all) => all.map((x) => r.todos.find((u) => u.id === x.id) ?? x));
    setPicked([]);
  }
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allShownPicked = shown.length > 0 && shown.every((t) => picked.includes(t.id));

  return (
    <div className="ip-section">
      <div className="ip-toolbar">
        <span className="filter-label">Show</span>
        <select className="ip-select" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="open">All open</option>
          {INTEREST_TODO_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          <option value="all">Everything</option>
        </select>
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
        <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : '+ Add item'}</button>
      </div>

      {picked.length > 0 && (
        <div className="ip-toolbar" style={{ background: 'var(--accent-soft, var(--bg-sunken))', borderRadius: 8, padding: '6px 10px' }}>
          <b>{picked.length} picked</b>
          <button className="btn btn-primary" disabled={busy} onClick={() => bulk({ status: 'done' })}>Mark done</button>
          <select className="ip-select" disabled={busy} defaultValue="" onChange={(e) => { if (e.target.value) { bulk({ status: e.target.value as InterestTodoStatus }); e.target.value = ''; } }} aria-label="Set status for the picked items">
            <option value="">Set status…</option>
            {INTEREST_TODO_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
          <select className="ip-select" disabled={busy} defaultValue="" onChange={(e) => { if (e.target.value) { bulk({ priority: Number(e.target.value) }); e.target.value = ''; } }} aria-label="Set priority for the picked items">
            <option value="">Set priority…</option>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{PRIORITY[n]}</option>)}
          </select>
          <button className="ip-link-btn" onClick={() => setPicked([])}>Clear</button>
        </div>
      )}

      {adding && (
        <div className="ip-form">
          <label className="full">Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} autoFocus /></label>
          <label className="full">Detail<textarea value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} maxLength={2000} /></label>
          <label>Status<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as InterestTodoStatus })}>{INTEREST_TODO_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</select></label>
          <label>Priority<select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{PRIORITY[n]}</option>)}</select></label>
          <label>About one place?<select value={draft.placeId ?? ''} onChange={(e) => setDraft({ ...draft, placeId: e.target.value || null, closeOnApply: e.target.value ? draft.closeOnApply : false })}><option value="">No, the whole interest</option>{placeOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={draft.closeOnApply} disabled={!draft.placeId} onChange={(e) => setDraft({ ...draft, closeOnApply: e.target.checked })} /> Close it when a Gemini draft for that place goes live</label>
          <label className="full">Where it came from<input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} maxLength={200} placeholder="e.g. specialist review, 5 Oct 2026" /></label>
          <div className="btns full"><button className="btn btn-primary" disabled={busy || !draft.title.trim()} onClick={create}>Save item</button></div>
        </div>
      )}

      <div className="ip-table-wrap">
        <table className="ip-table">
          <thead><tr><th style={{ width: 28 }}><input type="checkbox" aria-label="Pick all shown" checked={allShownPicked} onChange={() => setPicked(allShownPicked ? [] : shown.map((t) => t.id))} /></th><th>Priority</th><th>Status</th><th>Item</th><th>Where it came from</th><th>Added</th><th /></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} className="ip-faint">Nothing here.</td></tr>}
            {shown.map((t) =>
              editing === t.id ? (
                <EditRow key={t.id} todo={t} busy={busy} placeOptions={placeOptions} onCancel={() => setEditing(null)} onSave={(patch) => save(t, patch)} />
              ) : (
                <tr key={t.id} style={t.status === 'done' ? { opacity: 0.6 } : undefined}>
                  <td><input type="checkbox" aria-label={`Pick ${t.title}`} checked={picked.includes(t.id)} onChange={() => toggle(t.id)} /></td>
                  <td>
                    <select className="ip-select" value={t.priority} disabled={busy} onChange={(e) => save(t, { priority: Number(e.target.value) })} aria-label="Priority">
                      {[1, 2, 3].map((n) => <option key={n} value={n}>{PRIORITY[n]}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="ip-select" value={t.status} disabled={busy} onChange={(e) => save(t, { status: e.target.value as InterestTodoStatus })} aria-label="Status">
                      {INTEREST_TODO_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                    </select>
                  </td>
                  <td style={{ maxWidth: 520, whiteSpace: 'normal' }}>
                    <b>{t.title}</b>
                    {t.placeId && <span className="ip-chip info" style={{ marginLeft: 6 }} title={t.closeOnApply ? 'Closes by itself when a draft for this place goes live' : 'Linked to this place'}>{placeName.get(t.placeId) ?? t.placeId}{t.closeOnApply ? ' · auto-close' : ''}</span>}
                    {t.detail && <div className="ip-muted">{t.detail}</div>}
                  </td>
                  <td className="ip-muted" style={{ whiteSpace: 'normal', maxWidth: 260 }}><Linked text={t.source} /></td>
                  <td className="ip-mono ip-faint">{fmt(t.createdAt)}{t.doneAt ? <><br />done {fmt(t.doneAt)}</> : null}</td>
                  <td><div className="ip-actions"><button className="ip-link-btn" onClick={() => setEditing(t.id)}>Edit</button><button className="ip-link-btn danger" onClick={() => remove(t)}>Delete</button></div></td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRow({ todo, busy, placeOptions, onCancel, onSave }: { todo: TodoRow; busy: boolean; placeOptions: PlaceOption[]; onCancel: () => void; onSave: (p: Patch) => void }) {
  const [v, setV] = useState({ title: todo.title, detail: todo.detail, source: todo.source, placeId: todo.placeId, closeOnApply: todo.closeOnApply, priority: todo.priority });
  return (
    <tr>
      <td colSpan={7}>
        <div className="ip-form">
          <label className="full">Title<input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={200} /></label>
          <label className="full">Detail<textarea value={v.detail} onChange={(e) => setV({ ...v, detail: e.target.value })} maxLength={2000} /></label>
          <label>Priority<select value={v.priority} onChange={(e) => setV({ ...v, priority: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{PRIORITY[n]}</option>)}</select></label>
          <label>About one place?<select value={v.placeId ?? ''} onChange={(e) => setV({ ...v, placeId: e.target.value || null, closeOnApply: e.target.value ? v.closeOnApply : false })}><option value="">No, the whole interest</option>{placeOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={v.closeOnApply} disabled={!v.placeId} onChange={(e) => setV({ ...v, closeOnApply: e.target.checked })} /> Close it when a Gemini draft for that place goes live</label>
          <label className="full">Where it came from<input value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} maxLength={200} /></label>
          <div className="btns full"><button className="btn btn-primary" disabled={busy || !v.title.trim()} onClick={() => onSave(v)}>Save</button><button className="btn" onClick={onCancel}>Cancel</button></div>
        </div>
      </td>
    </tr>
  );
}
