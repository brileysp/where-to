'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { SiteTodoRow } from '@/lib/db/queries/site-todos';
import { INTEREST_TODO_STATUSES, type InterestTodoStatus } from '@/lib/db/schema';
import { SITE_TODO_KEY, compareTodos, dueInfo, isOpen, type TodoRepeat } from '@/lib/admin/todo-dates';
import { addSiteTodo, deleteSiteTodo, updateSiteTodo, type SiteTodoInput } from '@/app/admin/destinations/todo/actions';
import '@/components/admin/interest-page/interest-page.css';

const STATUS: Record<InterestTodoStatus, string> = { needs_you: 'Needs you', ready_for_claude: 'Ready for Claude', waiting: 'Waiting', idea: 'Idea', done: 'Done' };
const PRIORITY: Record<number, string> = { 1: 'High', 2: 'Normal', 3: 'Low' };
const REPEAT_LABEL: Record<TodoRepeat, string> = { weekly: 'Every week', monthly: 'Every month' };

type Chip = 'all' | 'site' | 'due';
type Interest = { key: string; label: string };
type Draft = { interestKey: string; title: string; detail: string; status: InterestTodoStatus; source: string; priority: number; dueOn: string; repeatEvery: '' | TodoRepeat };
const blank = (): Draft => ({ interestKey: SITE_TODO_KEY, title: '', detail: '', status: 'needs_you', source: '', priority: 2, dueOn: '', repeatEvery: '' });
const fromRow = (t: SiteTodoRow): Draft => ({ interestKey: t.interestKey, title: t.title, detail: t.detail, status: t.status, source: t.source, priority: t.priority, dueOn: t.dueOn ?? '', repeatEvery: t.repeatEvery ?? '' });
const toInput = (d: Draft): SiteTodoInput => ({ ...d, dueOn: d.dueOn || null, repeatEvery: d.repeatEvery || null });

export function SiteTodoView({ initialTodos, placeNames, interests, today }: { initialTodos: SiteTodoRow[]; placeNames: Record<string, string>; interests: Interest[]; today: string }) {
  const [todos, setTodos] = useState(initialTodos);
  const [chip, setChip] = useState<Chip>('all');
  const [scope, setScope] = useState('');
  const [status, setStatus] = useState<'open' | InterestTodoStatus | 'all'>('open');
  const [sort, setSort] = useState<'date' | 'priority' | 'newest'>('date');
  const [form, setForm] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = useMemo(() => new Map([[SITE_TODO_KEY, 'Site-wide'], ...interests.map((i) => [i.key, i.label] as [string, string])]), [interests]);

  const open = todos.filter(isOpen);
  const counts = {
    all: open.length,
    site: open.filter((t) => t.interestKey === SITE_TODO_KEY).length,
    due: open.filter((t) => t.dueOn !== null && t.dueOn <= today).length,
  };
  const withOpen = interests.map((i) => ({ ...i, n: open.filter((t) => t.interestKey === i.key).length })).filter((i) => i.n > 0);
  const needsYou = open.filter((t) => t.status === 'needs_you').length;
  const readyForClaude = open.filter((t) => t.status === 'ready_for_claude').length;

  const shown = todos
    .filter((t) => (status === 'all' ? true : status === 'open' ? isOpen(t) : t.status === status))
    .filter((t) => (chip === 'site' ? t.interestKey === SITE_TODO_KEY : chip === 'due' ? t.dueOn !== null && t.dueOn <= today && isOpen(t) : true))
    .filter((t) => !scope || t.interestKey === scope)
    .sort((a, b) => (sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : sort === 'priority' ? a.priority - b.priority || compareTodos(a, b) : compareTodos(a, b)));

  const merge = (changed: SiteTodoRow[]) =>
    setTodos((all) => {
      const next = all.map((x) => changed.find((c) => c.id === x.id) ?? x);
      return [...next, ...changed.filter((c) => !all.some((x) => x.id === c.id))];
    });

  async function run(fn: () => Promise<{ ok: true; todos?: SiteTodoRow[] } | { ok: false; message: string }>, after?: () => void) {
    setBusy(true); setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.message);
    if (r.todos) merge(r.todos);
    after?.();
  }
  const patch = (t: SiteTodoRow, p: Partial<Draft>) => run(() => updateSiteTodo(t.id, toInput({ ...fromRow(t), ...p })));
  const save = () => {
    if (!form) return;
    return run(() => (form.id ? updateSiteTodo(form.id, toInput(form.draft)) : addSiteTodo(toInput(form.draft))), () => setForm(null));
  };
  const remove = (t: SiteTodoRow) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    return run(() => deleteSiteTodo(t.id), () => setTodos((all) => all.filter((x) => x.id !== t.id)));
  };
  const set = (p: Partial<Draft>) => setForm((f) => (f ? { ...f, draft: { ...f.draft, ...p } } : f));

  return (
    <div className="ip-wrap">
      <div className="ip-head">
        <div>
          <h1 className="ip-title">To do</h1>
          <p className="ip-def">Site-wide jobs and every interest&apos;s open items in one list. {needsYou} need you, {readyForClaude} are ready for Claude, {counts.due} are due or overdue.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm(form ? null : { id: null, draft: blank() })}>{form && !form.id ? 'Cancel' : '+ Add item'}</button>
      </div>

      <div className="ip-toolbar" role="group" aria-label="Filter by scope">
        {([['all', 'All open'], ['site', 'Site-wide'], ['due', 'Due or overdue']] as Array<[Chip, string]>).map(([k, text]) => (
          <button key={k} className={`btn${chip === k ? ' btn-primary' : ''}`} onClick={() => setChip(k)}>{text} <span className="ip-mono" style={{ opacity: 0.75 }}>{counts[k]}</span></button>
        ))}
        <select className="ip-select" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Show one interest only">
          <option value="">Any interest</option>
          {withOpen.map((i) => <option key={i.key} value={i.key}>{i.label} ({i.n})</option>)}
        </select>
        <span className="filter-label">Show</span>
        <select className="ip-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status filter">
          <option value="open">All open</option>
          {INTEREST_TODO_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
          <option value="all">Everything</option>
        </select>
        <span className="filter-label">Sort</span>
        <select className="ip-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort order">
          <option value="date">Check-on date, then priority</option>
          <option value="priority">Priority</option>
          <option value="newest">Newest</option>
        </select>
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
      </div>

      {form && (
        <div className="ip-form">
          <label className="full">Title<input value={form.draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} autoFocus /></label>
          <label className="full">Detail<textarea value={form.draft.detail} onChange={(e) => set({ detail: e.target.value })} maxLength={2000} /></label>
          <label>Applies to<select value={form.draft.interestKey} onChange={(e) => set({ interestKey: e.target.value })}><option value={SITE_TODO_KEY}>Whole site</option>{interests.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select></label>
          <label>Status<select value={form.draft.status} onChange={(e) => set({ status: e.target.value as InterestTodoStatus })}>{INTEREST_TODO_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select></label>
          <label>Priority<select value={form.draft.priority} onChange={(e) => set({ priority: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{PRIORITY[n]}</option>)}</select></label>
          <label>Check on<input type="date" value={form.draft.dueOn} onChange={(e) => set({ dueOn: e.target.value })} /></label>
          <label>Repeat<select value={form.draft.repeatEvery} onChange={(e) => set({ repeatEvery: e.target.value as '' | TodoRepeat })}><option value="">Never</option>{(['weekly', 'monthly'] as TodoRepeat[]).map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}</select></label>
          <label className="full">Where it came from<input value={form.draft.source} onChange={(e) => set({ source: e.target.value })} maxLength={200} placeholder="e.g. Usage page, 14 Oct 2026" /></label>
          <div className="btns full"><button className="btn btn-primary" disabled={busy || !form.draft.title.trim()} onClick={save}>{form.id ? 'Save changes' : 'Save item'}</button><button className="btn" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}

      <div className="ip-table-wrap">
        <table className="ip-table">
          <thead><tr><th>Priority</th><th>Status</th><th>Item</th><th>Check on</th><th>Where it came from</th><th /></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={6} className="ip-faint">Nothing here.</td></tr>}
            {shown.map((t) => {
              const info = t.dueOn && isOpen(t) ? dueInfo(t.dueOn, today) : null;
              const site = t.interestKey === SITE_TODO_KEY;
              return (
                <tr key={t.id} style={t.status === 'done' ? { opacity: 0.6 } : undefined}>
                  <td><select className="ip-select" value={t.priority} disabled={busy} onChange={(e) => patch(t, { priority: Number(e.target.value) })} aria-label="Priority">{[1, 2, 3].map((n) => <option key={n} value={n}>{PRIORITY[n]}</option>)}</select></td>
                  <td><select className="ip-select" value={t.status} disabled={busy} onChange={(e) => patch(t, { status: e.target.value as InterestTodoStatus })} aria-label="Status">{INTEREST_TODO_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select></td>
                  <td style={{ maxWidth: 560, whiteSpace: 'normal' }}>
                    <span className={`ip-chip ${site ? 'new' : 'good'}`} style={{ marginRight: 6 }}>{label.get(t.interestKey) ?? t.interestKey}</span>
                    <b>{t.title}</b>
                    {t.placeId && <span className="ip-chip info" style={{ marginLeft: 6 }}>{placeNames[t.placeId] ?? t.placeId}{t.closeOnApply ? ' · auto-close' : ''}</span>}
                    {t.detail && <div className="ip-muted">{t.detail}</div>}
                    {t.repeatEvery && isOpen(t) && <div className="ip-faint">Repeats {t.repeatEvery === 'weekly' ? 'every week' : 'every month'}</div>}
                  </td>
                  <td className="ip-mono" style={{ whiteSpace: 'nowrap' }}>
                    {t.dueOn ? <>{t.dueOn}{info && <div style={{ fontSize: 11.5, fontWeight: 600, color: info.tone === 'over' ? 'var(--bad)' : info.tone === 'soon' ? 'var(--warn)' : 'var(--text-faint)' }}>{info.text}</div>}</> : <span className="ip-faint">none</span>}
                  </td>
                  <td className="ip-muted" style={{ whiteSpace: 'normal', maxWidth: 240 }}>{t.source}</td>
                  <td>
                    <div className="ip-actions">
                      {isOpen(t) && <button className="ip-link-btn" disabled={busy} onClick={() => patch(t, { status: 'done' })}>Done</button>}
                      {!site && <Link className="ip-link-btn" href={`/admin/destinations/interests/${t.interestKey}#todo`}>Open interest</Link>}
                      <button className="ip-link-btn" onClick={() => setForm({ id: t.id, draft: fromRow(t) })}>Edit</button>
                      <button className="ip-link-btn danger" disabled={busy} onClick={() => remove(t)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ip-faint">Items marked Done stay listed under Show: Everything. Ticking a repeating item done creates its next copy with the next date.</p>
    </div>
  );
}
