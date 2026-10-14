'use client';

import { useState } from 'react';
import type { ReferenceSiteRow, ReviewRow } from '@/lib/admin/interest-pages/types';
import { REFERENCE_SITE_ACCESS, type ReferenceSiteAccess } from '@/lib/db/schema';
import { addReferenceSite, updateReferenceSite, deleteReferenceSite } from '@/app/admin/destinations/interests/[key]/actions';

const TOP = 10;
const STALE_DAYS = 90; // fact checks are meant to be quarterly
const today = () => new Date().toISOString().slice(0, 10);

const ACCESS_LABEL: Record<ReferenceSiteAccess, string> = { ai: 'AI can read it', partial: 'AI via search only', human: 'Human check needed' };
const ACCESS_HELP: Record<ReferenceSiteAccess, string> = {
  ai: 'Claude can open the pages directly, so it can use this site in a fact check.',
  partial: 'Direct page reads fail or the numbers do not load, but web search results quote it, so Claude can use it only that way. Worth a human look for anything important.',
  human: 'The site blocks automated reads. A person has to look things up on it.',
};
const ACCESS_CLASS: Record<ReferenceSiteAccess, string> = { ai: 'good', partial: 'warn', human: 'bad' };

interface Draft { siteUrl: string; label: string; goodFor: string; usefulness: string; aiAccess: ReferenceSiteAccess; lastUsedOn: string; placesChecked: string }
const blank = (): Draft => ({ siteUrl: '', label: '', goodFor: '', usefulness: '60', aiAccess: 'ai', lastUsedOn: '', placesChecked: '0' });
const fromRow = (s: ReferenceSiteRow): Draft => ({ siteUrl: s.siteUrl, label: s.label, goodFor: s.goodFor, usefulness: String(s.usefulness), aiAccess: s.aiAccess, lastUsedOn: s.lastUsedOn ?? '', placesChecked: String(s.placesChecked) });
const toInput = (d: Draft) => ({ siteUrl: d.siteUrl, label: d.label, goodFor: d.goodFor, usefulness: d.usefulness, aiAccess: d.aiAccess, lastUsedOn: d.lastUsedOn || null, placesChecked: d.placesChecked });
const sortSites = (r: ReferenceSiteRow[]) => [...r].sort((a, b) => b.usefulness - a.usefulness || a.label.localeCompare(b.label));
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
function daysSince(d: string | null): number | null {
  if (!d) return null;
  const ms = Date.parse(today()) - Date.parse(d);
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

export function ReferenceSitesSection({ interestKey, sites, setSites, reviews }: { interestKey: string; sites: ReferenceSiteRow[]; setSites: (f: (s: ReferenceSiteRow[]) => ReferenceSiteRow[]) => void; reviews: ReviewRow[] }) {
  // How many different places have a review that names this site: a check on the typed number.
  const autoCount = (siteUrl: string) => {
    const host = hostOf(siteUrl).toLowerCase();
    return new Set(reviews.filter((r) => r.placeId && r.notes.toLowerCase().includes(host)).map((r) => r.placeId)).size;
  };
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank());
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ordered = sortSites(sites);
  const shown = showAll ? ordered : ordered.slice(0, TOP);

  async function create() {
    setBusy(true); setError(null);
    const r = await addReferenceSite(interestKey, toInput(draft));
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setSites((all) => sortSites([...all, r.site]));
    setDraft(blank()); setAdding(false);
  }
  async function save(id: string, d: Draft) {
    setBusy(true); setError(null);
    const r = await updateReferenceSite(interestKey, id, toInput(d));
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setSites((all) => sortSites(all.map((x) => (x.id === id ? r.site : x))));
    setEditing(null);
  }
  async function remove(s: ReferenceSiteRow) {
    if (!window.confirm(`Remove ${s.label} from the reference sites?`)) return;
    setBusy(true); setError(null);
    const r = await deleteReferenceSite(interestKey, s.id);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setSites((all) => all.filter((x) => x.id !== s.id));
  }

  return (
    <div className="ip-section">
      <div className="ip-toolbar">
        <span className="ip-muted">
          The few sites we come back to again and again to fact-check this interest, best first. Usefulness is 1 to 100 (100 = best). Keep it to about ten; the one-off links stay on each place. Checks are meant to be quarterly. The coloured tag says who can check against a site: Claude can read it, Claude can use it only through web search, or a person has to look it up because the site blocks automated reads.
        </span>
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
        <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : '+ Add site'}</button>
      </div>
      {adding && <SiteForm d={draft} setD={setDraft} busy={busy} onSave={create} label="Save site" />}
      {ordered.length === 0 && !adding && <div className="ip-card ip-faint">No reference sites yet.</div>}
      {ordered.length > 0 && (
        <div className="ip-table-wrap">
          <table className="ip-table">
            <thead>
              <tr><th>Usefulness</th><th>Site</th><th>Who can check it</th><th>Good for</th><th>Last used</th><th>Places checked</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((s) =>
                editing === s.id ? (
                  <tr key={s.id}><td colSpan={7}><EditSite s={s} busy={busy} onCancel={() => setEditing(null)} onSave={(d) => save(s.id, d)} /></td></tr>
                ) : (
                  <tr key={s.id}>
                    <td><span className="ip-score" title={`${s.usefulness} out of 100`}><b>{s.usefulness}</b><i style={{ width: `${s.usefulness}%` }} /></span></td>
                    <td><a href={s.siteUrl} target="_blank" rel="noreferrer noopener"><b>{s.label}</b></a><div className="ip-faint">{hostOf(s.siteUrl)}</div></td>
                    <td><span className={`ip-chip ${ACCESS_CLASS[s.aiAccess]}`} title={ACCESS_HELP[s.aiAccess]}>{ACCESS_LABEL[s.aiAccess]}</span>{s.aiAccess !== 'human' && s.lastUsedOn && <div className="ip-faint">used in a check</div>}</td>
                    <td>{s.goodFor || <span className="ip-faint">-</span>}</td>
                    <td className="nw">{s.lastUsedOn ?? <span className="ip-faint">never</span>} <StaleChip last={s.lastUsedOn} /></td>
                    <td className="nw">
                      {s.placesChecked}
                      {autoCount(s.siteUrl) !== s.placesChecked && (
                        <div className="ip-faint" style={{ fontSize: 11.5 }}>
                          reviews name it for {autoCount(s.siteUrl)}{' '}
                          <button className="ip-link-btn" disabled={busy} onClick={() => save(s.id, { ...fromRow(s), placesChecked: String(autoCount(s.siteUrl)) })}>use {autoCount(s.siteUrl)}</button>
                        </div>
                      )}
                    </td>
                    <td className="nw"><button className="ip-link-btn" onClick={() => setEditing(s.id)}>Edit</button> <button className="ip-link-btn danger" onClick={() => remove(s)}>Remove</button></td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      {ordered.length > TOP && <button className="ip-link-btn" onClick={() => setShowAll((v) => !v)}>{showAll ? `Show only the top ${TOP}` : `Show ${ordered.length - TOP} more`}</button>}
    </div>
  );
}

function StaleChip({ last }: { last: string | null }) {
  const d = daysSince(last);
  if (d === null) return <span className="ip-chip warn">Not yet checked</span>;
  if (d > STALE_DAYS) return <span className="ip-chip warn">Due for a check</span>;
  return null;
}

function EditSite({ s, busy, onCancel, onSave }: { s: ReferenceSiteRow; busy: boolean; onCancel: () => void; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(fromRow(s));
  return <SiteForm d={d} setD={setD} busy={busy} onSave={() => onSave(d)} label="Save" onCancel={onCancel} />;
}

function SiteForm({ d, setD, busy, onSave, label, onCancel }: { d: Draft; setD: (d: Draft) => void; busy: boolean; onSave: () => void; label: string; onCancel?: () => void }) {
  return (
    <div className="ip-form">
      <label>Site address<input value={d.siteUrl} onChange={(e) => setD({ ...d, siteUrl: e.target.value })} maxLength={300} placeholder="e.g. 10000birds.com" autoFocus /></label>
      <label>Name<input value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} maxLength={120} placeholder="e.g. 10,000 Birds" /></label>
      <label>Usefulness (1-100)<input type="number" min={1} max={100} value={d.usefulness} onChange={(e) => setD({ ...d, usefulness: e.target.value })} /></label>
      <label>Who can check it<select value={d.aiAccess} onChange={(e) => setD({ ...d, aiAccess: e.target.value as ReferenceSiteAccess })}>{REFERENCE_SITE_ACCESS.map((a) => <option key={a} value={a}>{ACCESS_LABEL[a]}</option>)}</select></label>
      <label>Last used to check<input type="date" value={d.lastUsedOn} onChange={(e) => setD({ ...d, lastUsedOn: e.target.value })} /></label>
      <label>Places checked<input type="number" min={0} value={d.placesChecked} onChange={(e) => setD({ ...d, placesChecked: e.target.value })} /></label>
      <label className="full">What it is good for, and any catch<textarea value={d.goodFor} onChange={(e) => setD({ ...d, goodFor: e.target.value })} maxLength={600} style={{ minHeight: 70 }} placeholder="e.g. Official species counts; blocks automated reads" /></label>
      <div className="btns full"><button className="btn btn-primary" disabled={busy || !d.siteUrl.trim() || !d.label.trim() || !d.usefulness} onClick={onSave}>{label}</button>{onCancel && <button className="btn" onClick={onCancel}>Cancel</button>}</div>
    </div>
  );
}
