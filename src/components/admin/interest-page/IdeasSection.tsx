'use client';

import { useState } from 'react';
import type { IdeaRow } from '@/lib/admin/interest-pages/types';
import { INTEREST_IDEA_STAGES, type InterestIdeaStage } from '@/lib/db/schema';
import { SETTING_TAGS, MAX_SETTING_TAGS } from '@/lib/places/setting-tags';
import { GRAIN_VALUES, grainLabel } from '@/lib/admin/interest-pages/grain';
import Link from 'next/link';
import { addIdea, updateIdea, deleteIdea, moveIdea, promoteIdea } from '@/app/admin/destinations/interests/[key]/actions';
import { NEW_PLACE_CLIMATES } from '@/lib/admin/new-place-constants';

const STAGE_LABEL: Record<InterestIdeaStage, string> = { idea: 'Idea', researched: 'Researched', verified: 'Verified', added: 'Added to catalog' };
const EMPTY = { name: '', region: '', why: '', nearestExisting: '', settingTags: [] as string[], stage: 'idea' as InterestIdeaStage, grain: null as number | null, grainNote: '' };

function grainMatches(g: number | null, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'none') return g === null;
  if (g === null) return false;
  return filter === 'spec' ? g < 0 : filter === 'ok' ? g === 0 : g > 0;
}

const tagLabel = (slug: string) => { const t = SETTING_TAGS.find((x) => x.slug === slug); return t ? `${t.emoji} ${t.label}` : slug; };

/** Pick what the place is like: up to four setting tags, the first one picked is the primary. */
function TagPicker({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="ip-tagpick" role="group" aria-label="Setting tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {SETTING_TAGS.map((t) => {
        const on = value.includes(t.slug);
        const full = !on && value.length >= MAX_SETTING_TAGS;
        return (
          <button key={t.slug} type="button" className="ip-link-btn" disabled={disabled || full} aria-pressed={on} title={full ? `At most ${MAX_SETTING_TAGS}` : t.blurb}
            style={{ border: '1px solid var(--line, #ccc)', borderRadius: 999, padding: '1px 8px', fontWeight: on && value[0] === t.slug ? 700 : 400, background: on ? 'var(--accent-soft, #eee)' : 'transparent' }}
            onClick={() => onChange(on ? value.filter((x) => x !== t.slug) : [...value, t.slug])}>{t.emoji} {t.label}</button>
        );
      })}
    </div>
  );
}

const byOrder = (a: IdeaRow, b: IdeaRow) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.name.localeCompare(b.name);
const CONTINENT_OPTIONS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];

export function IdeasSection({ interestKey, ideas, setIdeas }: { interestKey: string; ideas: IdeaRow[]; setIdeas: (f: (i: IdeaRow[]) => IdeaRow[]) => void }) {
  const [stage, setStage] = useState<'all' | InterestIdeaStage>('all');
  const [setting, setSetting] = useState('');
  const [grain, setGrain] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const shown = [...ideas].sort(byOrder).filter((i) => (stage === 'all' || i.stage === stage) && (!setting || (setting === '__none' ? i.settingTags.length === 0 : i.settingTags.includes(setting))) && grainMatches(i.grain, grain));

  async function create() {
    setBusy(true); setError(null);
    const r = await addIdea(interestKey, draft);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setIdeas((i) => [...i, r.idea].sort(byOrder));
    setDraft(EMPTY); setAdding(false);
  }
  async function save(i: IdeaRow, patch: Partial<IdeaRow>) {
    setBusy(true); setError(null);
    const r = await updateIdea(interestKey, i.id, { name: i.name, region: i.region, why: i.why, nearestExisting: i.nearestExisting, settingTags: i.settingTags, stage: i.stage, grain: i.grain, grainNote: i.grainNote, ...patch });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setIdeas((all) => all.map((x) => (x.id === i.id ? r.idea : x)));
    setEditing(null);
  }
  async function move(i: IdeaRow, dir: 'up' | 'down') {
    setBusy(true); setError(null);
    const r = await moveIdea(interestKey, i.id, dir);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    const order = new Map(r.order.map((o) => [o.id, o.sortOrder]));
    setIdeas((all) => all.map((x) => ({ ...x, sortOrder: order.get(x.id) ?? x.sortOrder })).sort(byOrder));
  }
  async function promote(i: IdeaRow, input: { climate: string; countryCode: string; continent: string }) {
    setBusy(true); setError(null);
    const r = await promoteIdea(interestKey, i.id, { climate: input.climate, countryCode: input.countryCode || null, continent: input.continent || null });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setIdeas((all) => all.map((x) => (x.id === i.id ? r.idea : x)));
    setPromoting(null);
  }
  async function remove(i: IdeaRow) {
    if (!window.confirm(`Delete "${i.name}"?`)) return;
    setBusy(true); setError(null);
    const r = await deleteIdea(interestKey, i.id);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setIdeas((all) => all.filter((x) => x.id !== i.id));
  }

  return (
    <div className="ip-section">
      <div className="ip-toolbar">
        <span className="filter-label">Stage</span>
        <select className="ip-select" value={stage} onChange={(e) => setStage(e.target.value as typeof stage)}>
          <option value="all">All</option>
          {INTEREST_IDEA_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <span className="filter-label">Setting</span>
        <select className="ip-select" value={setting} onChange={(e) => setSetting(e.target.value)}>
          <option value="">All settings</option>
          {SETTING_TAGS.map((t) => <option key={t.slug} value={t.slug}>{t.emoji} {t.label}</option>)}
          <option value="__none">Not classified</option>
        </select>
        <span className="filter-label">Grain</span>
        <select className="ip-select" value={grain} onChange={(e) => setGrain(e.target.value)}>
          <option value="">All</option>
          <option value="spec">Too or slightly specific</option>
          <option value="ok">Just right</option>
          <option value="broad">Slightly or too broad</option>
          <option value="none">Not rated</option>
        </select>
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
        <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : '+ Add place idea'}</button>
      </div>
      {adding && <IdeaForm v={draft} setV={setDraft} busy={busy} onSave={create} label="Save idea" />}
      <div className="ip-table-wrap">
        <table className="ip-table">
          <thead><tr><th style={{ width: 52 }}>Order</th><th>Candidate place</th><th>Region</th><th>Place type</th><th title="Is this the right size to choose between? Same scale as the Place Grain Review.">Grain</th><th>Why it matters</th><th>Closest existing place</th><th>Stage</th><th /></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={9} className="ip-faint">No ideas yet.</td></tr>}
            {shown.map((i) =>
              editing === i.id ? (
                <tr key={i.id}><td colSpan={9}><EditIdea idea={i} busy={busy} onCancel={() => setEditing(null)} onSave={(p) => save(i, p)} /></td></tr>
              ) : (
                <tr key={i.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="ip-link-btn" disabled={busy} title="Move up" onClick={() => move(i, 'up')}>▲</button>
                    <button className="ip-link-btn" disabled={busy} title="Move down" onClick={() => move(i, 'down')}>▼</button>
                  </td>
                  <td><b>{i.name}</b>{i.promotedPlaceId && <div><Link href={`/admin/destinations/${i.promotedPlaceId}/profile`} className="ip-faint">→ place {i.promotedPlaceId}</Link></div>}</td>
                  <td>{i.region}</td>
                  <td>
                    <details>
                      <summary style={{ cursor: 'pointer' }}>{i.settingTags.length ? i.settingTags.map((t, k) => (k === 0 ? <b key={t}>{tagLabel(t)}</b> : <span key={t}>, {tagLabel(t)}</span>)) : <span className="ip-faint">Not classified</span>}</summary>
                      <TagPicker value={i.settingTags} disabled={busy} onChange={(v) => save(i, { settingTags: v })} />
                    </details>
                  </td>
                  <td style={{ minWidth: 170, whiteSpace: 'normal' }}>
                    <select className="ip-select" value={i.grain ?? ''} disabled={busy} onChange={(e) => save(i, { grain: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Grain">
                      <option value="">Not rated</option>
                      {GRAIN_VALUES.map((g) => <option key={g} value={g}>{grainLabel(g).label}</option>)}
                    </select>
                    {i.grainNote && <div className="ip-faint" style={{ fontSize: 11.5, marginTop: 3, lineHeight: 1.35 }}>{i.grainNote}</div>}
                  </td>
                  <td className="ip-muted" style={{ maxWidth: 440, whiteSpace: 'normal' }}>{i.why}</td>
                  <td>{i.nearestExisting}</td>
                  <td>
                    <select className="ip-select" value={i.stage} disabled={busy} onChange={(e) => save(i, { stage: e.target.value as InterestIdeaStage })} aria-label="Stage">
                      {INTEREST_IDEA_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td><div className="ip-actions">{!i.promotedPlaceId && <button className="ip-link-btn" onClick={() => setPromoting(promoting === i.id ? null : i.id)}>Promote to place</button>}<button className="ip-link-btn" onClick={() => setEditing(i.id)}>Edit</button><button className="ip-link-btn danger" onClick={() => remove(i)}>Delete</button></div></td>
                </tr>
              ),
            )}
            {promoting && (() => {
              const i = ideas.find((x) => x.id === promoting);
              return i ? <PromoteRow key="promote" idea={i} busy={busy} onCancel={() => setPromoting(null)} onSave={(v) => promote(i, v)} /> : null;
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditIdea({ idea, busy, onCancel, onSave }: { idea: IdeaRow; busy: boolean; onCancel: () => void; onSave: (p: typeof EMPTY) => void }) {
  const [v, setV] = useState({ name: idea.name, region: idea.region, why: idea.why, nearestExisting: idea.nearestExisting, settingTags: idea.settingTags, stage: idea.stage, grain: idea.grain, grainNote: idea.grainNote });
  return <IdeaForm v={v} setV={setV} busy={busy} onSave={() => onSave(v)} label="Save" onCancel={onCancel} />;
}

function IdeaForm({ v, setV, busy, onSave, label, onCancel }: { v: typeof EMPTY; setV: (v: typeof EMPTY) => void; busy: boolean; onSave: () => void; label: string; onCancel?: () => void }) {
  return (
    <div className="ip-form">
      <label>Name<input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={160} /></label>
      <label>Region<input value={v.region} onChange={(e) => setV({ ...v, region: e.target.value })} maxLength={160} /></label>
      <label className="full">Why it matters<textarea value={v.why} onChange={(e) => setV({ ...v, why: e.target.value })} maxLength={1000} /></label>
      <label>Closest existing place<input value={v.nearestExisting} onChange={(e) => setV({ ...v, nearestExisting: e.target.value })} maxLength={200} /></label>
      <div className="full"><div className="ip-faint" style={{ marginBottom: 2 }}>Setting (what the place is like; the first picked is primary)</div><TagPicker value={v.settingTags} onChange={(t) => setV({ ...v, settingTags: t })} /></div>
      <label>Stage<select value={v.stage} onChange={(e) => setV({ ...v, stage: e.target.value as InterestIdeaStage })}>{INTEREST_IDEA_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
      <label>Grain<select value={v.grain ?? ''} onChange={(e) => setV({ ...v, grain: e.target.value === '' ? null : Number(e.target.value) })}><option value="">Not rated</option>{GRAIN_VALUES.map((g) => <option key={g} value={g}>{grainLabel(g).label}</option>)}</select></label>
      <label className="full">Grain note<input value={v.grainNote} onChange={(e) => setV({ ...v, grainNote: e.target.value })} maxLength={400} /></label>
      <div className="btns full"><button className="btn btn-primary" disabled={busy || !v.name.trim()} onClick={onSave}>{label}</button>{onCancel && <button className="btn" onClick={onCancel}>Cancel</button>}</div>
    </div>
  );
}


function PromoteRow({ idea, busy, onCancel, onSave }: { idea: IdeaRow; busy: boolean; onCancel: () => void; onSave: (v: { climate: string; countryCode: string; continent: string }) => void }) {
  const [v, setV] = useState({ climate: 'temperate', countryCode: '', continent: '' });
  return (
    <tr>
      <td colSpan={9}>
        <div className="ip-form">
          <div className="full"><b>Turn &quot;{idea.name}&quot; into a place.</b> It is created empty, retired and unpublished (not ranked, not shown to travellers) until you switch it on from the Places grid. The idea is marked &quot;Added to catalog&quot;.</div>
          <label>Climate<select value={v.climate} onChange={(e) => setV({ ...v, climate: e.target.value })}>{NEW_PLACE_CLIMATES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <label>Country code (three letters, optional)<input value={v.countryCode} onChange={(e) => setV({ ...v, countryCode: e.target.value.toUpperCase() })} maxLength={3} placeholder="FRA" /></label>
          <label>Continent (optional)<select value={v.continent} onChange={(e) => setV({ ...v, continent: e.target.value })}><option value="">—</option>{CONTINENT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <div className="btns full"><button className="btn btn-primary" disabled={busy} onClick={() => onSave(v)}>Create the place</button><button className="btn" onClick={onCancel}>Cancel</button></div>
        </div>
      </td>
    </tr>
  );
}
