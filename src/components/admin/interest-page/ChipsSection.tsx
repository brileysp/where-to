'use client';

import { useMemo, useState } from 'react';
import type { InterestChipDriver } from '@/lib/db/schema';
import type { ChipOverrideRow, ChipRow, InterestPlaceRow, QuestionRow } from '@/lib/admin/interest-pages/types';
import type { FactDef } from '@/lib/admin/interest-pages/config';
import { canDrive, chipFit, driverLabel, driverProblem, fitBasis, MAX_DRIVERS, MAX_LIVE_CHIPS, needsOption, roundFit } from '@/lib/admin/interest-pages/chips';
import { createChip, updateChip, moveChip, deleteChip, setChipApproval, saveChipOverride, clearChipOverride, type ChipPatch } from '@/app/admin/destinations/interests/[key]/chip-actions';

const FIT_WELL = 7;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function ChipsSection({
  interestKey,
  factDefs,
  places,
  chips,
  setChips,
  questions,
  setQuestions,
  overrides,
  setOverrides,
}: {
  interestKey: string;
  factDefs: FactDef[];
  places: InterestPlaceRow[];
  chips: ChipRow[];
  setChips: (f: (c: ChipRow[]) => ChipRow[]) => void;
  questions: QuestionRow[];
  setQuestions: (f: (q: QuestionRow[]) => QuestionRow[]) => void;
  overrides: ChipOverrideRow[];
  setOverrides: (f: (o: ChipOverrideRow[]) => ChipOverrideRow[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // place id whose number is being overridden

  const sorted = useMemo(() => [...chips].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)), [chips]);
  const current = sorted.find((c) => c.key === selected) ?? sorted[0] ?? null;
  const scored = useMemo(() => places.filter((p) => p.status !== 'na'), [places]);
  const liveCount = sorted.filter((c) => c.status === 'live').length;
  const driverCols = useMemo(() => factDefs.filter(canDrive), [factDefs]);
  const overrideOf = (chipKey: string, placeId: string) => overrides.find((o) => o.chipKey === chipKey && o.placeId === placeId);
  const shownFit = (c: ChipRow, p: InterestPlaceRow): number | null => overrideOf(c.key, p.id)?.fit ?? chipFit(c.drivers, factDefs, p.facts);

  async function run<T extends { ok: boolean }>(job: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    const r = await job();
    setBusy(false);
    if (!r.ok) {
      setError((r as unknown as { message: string }).message);
      return null;
    }
    return r;
  }

  async function patch(c: ChipRow, p: ChipPatch) {
    const r = await run(() => updateChip(interestKey, c.key, p));
    if (r && r.ok) setChips((all) => all.map((x) => (x.key === c.key ? r.chip : x)));
    return !!r;
  }
  async function add() {
    const r = await run(() => createChip(interestKey, newName));
    if (!r || !r.ok) return;
    setChips((all) => [...all, r.chip]);
    setSelected(r.chip.key);
    setNewName('');
    setAdding(false);
  }
  async function move(c: ChipRow, dir: 'up' | 'down') {
    const r = await run(() => moveChip(interestKey, c.key, dir));
    if (!r || !r.ok) return;
    const order = new Map(r.order.map((o) => [o.key, o.order]));
    setChips((all) => all.map((x) => ({ ...x, order: order.get(x.key) ?? x.order })));
  }
  async function approve(c: ChipRow, approved: boolean) {
    const r = await run(() => setChipApproval(interestKey, c.key, approved));
    if (r && r.ok) setChips((all) => all.map((x) => (x.key === c.key ? r.chip : x)));
  }
  async function remove(c: ChipRow) {
    const opens = questions.filter((q) => q.whenChips.includes(c.key));
    const warn = opens.length ? ` ${opens.length} onboarding question${opens.length === 1 ? ' is' : 's are'} opened by it (${opens.map((q) => `"${q.text}"`).join(', ')}). They will lose this chip, and any left with no chip will be asked of everyone, and their approval is taken back.` : '';
    if (!window.confirm(`Delete the chip "${c.label}" and any numbers you set by hand for it?${warn}`)) return;
    const r = await run(() => deleteChip(interestKey, c.key, { untie: opens.length > 0 }));
    if (!r) return;
    if (opens.length) setQuestions((all) => all.map((q) => (q.whenChips.includes(c.key) ? { ...q, whenChips: q.whenChips.filter((k) => k !== c.key), approvedBy: '', approvedAt: null } : q)));
    setChips((all) => all.filter((x) => x.key !== c.key));
    setOverrides((all) => all.filter((o) => o.chipKey !== c.key));
    setSelected(null);
  }

  function setDrivers(c: ChipRow, drivers: InterestChipDriver[]) {
    return patch(c, { drivers });
  }
  function addDriver(c: ChipRow, columnKey: string) {
    const def = factDefs.find((d) => d.key === columnKey);
    if (!def) return;
    const d: InterestChipDriver = { column: columnKey };
    if (needsOption(def)) d.option = (def.options ?? []).find((o) => !c.drivers.some((x) => x.column === columnKey && x.option === o.value))?.value ?? def.options?.[0]?.value;
    if (def.type === 'int') d.fullAt = 100;
    return setDrivers(c, [...c.drivers, d]);
  }

  // Columns nothing uses, for the one-line note at the bottom.
  const unused = driverCols.filter((d) => !chips.some((c) => c.drivers.some((x) => x.column === d.key)));

  if (driverCols.length === 0) {
    return (
      <div className="ip-section">
        <div className="ip-card"><p className="ip-muted" style={{ margin: 0 }}>This interest has no data columns yet, so there is nothing for a chip to be driven by. Chips can be added once its columns exist.</p></div>
      </div>
    );
  }

  return (
    <div className="ip-section">
      <div className="ip-toolbar">
        <span className={`ip-chip ${liveCount >= MAX_LIVE_CHIPS ? 'warn' : 'good'}`}>{liveCount} of {MAX_LIVE_CHIPS} chips live</span>
        <span className="ip-chip dim">{sorted.length - liveCount} draft</span>
        <span className={`ip-chip ${sorted.some((c) => c.approvedAt) ? "info" : "dim"}`}>{sorted.filter((c) => c.approvedAt).length} of {sorted.length} approved</span>
        <span className="ip-faint">Live chips are the ones travelers will be offered, in this order.</span>
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
      </div>

      {sorted.length > 0 && (
        <div className="ip-table-wrap">
          <table className="ip-table ip-ch-table">
            <thead><tr><th style={{ width: 64 }}>Order</th><th>Chip</th><th>Status</th><th>Approved</th><th>Driven by</th><th title="The onboarding questions that are only asked when this chip is ticked">Opens questions</th><th title={`Places whose fit is ${FIT_WELL} or more, out of the places scored for this interest.`}>Fits well ({FIT_WELL}+)</th></tr></thead>
            <tbody>
              {sorted.map((c, i) => {
                const fits = scored.map((p) => shownFit(c, p));
                const strong = fits.filter((f) => f !== null && f >= FIT_WELL).length;
                const blank = fits.filter((f) => f === null).length;
                const blocked = c.status !== 'live' && (liveCount >= MAX_LIVE_CHIPS || !!c.needsColumn || c.drivers.length === 0 || !c.approvedAt);
                return (
                  <tr key={c.key} className={c.key === current?.key ? 'sel' : ''} onClick={() => { setSelected(c.key); setEditing(null); }}>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <button className="ip-link-btn" disabled={busy || i === 0} title="Move earlier" onClick={() => move(c, 'up')}>▲</button>
                      <button className="ip-link-btn" disabled={busy || i === sorted.length - 1} title="Move later" onClick={() => move(c, 'down')}>▼</button>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        className="ip-ch-name"
                        defaultValue={c.label}
                        key={c.label}
                        aria-label="Chip name"
                        onFocus={() => setSelected(c.key)}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.label) void patch(c, { label: v }).then((ok) => { if (!ok) e.target.value = c.label; }); else e.target.value = c.label; }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className={`ip-ch-status ${c.status}`}
                        disabled={busy || blocked}
                        title={!c.approvedAt && c.status !== 'live' ? 'Approve the chip first' : c.needsColumn ? 'Waiting on a new column' : c.drivers.length === 0 && c.status !== 'live' ? 'Add a column first' : liveCount >= MAX_LIVE_CHIPS && c.status !== 'live' ? 'Five chips are already live' : 'Switch between live and draft'}
                        onClick={() => patch(c, { status: c.status === 'live' ? 'draft' : 'live' })}
                      >{c.status === 'live' ? 'Live' : 'Draft'}</button>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {c.approvedAt
                        ? <span className="ip-chip good" title={`Approved by ${c.approvedBy} on ${when(c.approvedAt)}`}>✓ {when(c.approvedAt)}</span>
                        : <button className="ip-link-btn" disabled={busy} title="Record that you agree this chip should exist" onClick={() => approve(c, true)}>Approve</button>}
                    </td>
                    <td>
                      <div className="ip-ch-pills">
                        {c.drivers.map((d, k) => <i key={k}>{driverLabel(d, factDefs)}</i>)}
                        {c.needsColumn && <i className="new">needs a new column</i>}
                        {c.drivers.length === 0 && !c.needsColumn && <i>Nothing yet</i>}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{(() => { const n = questions.filter((q) => q.whenChips.includes(c.key)).length; return n ? <span className="ip-chip new" title={questions.filter((q) => q.whenChips.includes(c.key)).map((q) => q.text).join('\n')}>{n} question{n === 1 ? '' : 's'}</span> : <span className="ip-faint">none</span>; })()}</td>
                    <td className="ip-mono" style={{ whiteSpace: 'nowrap' }}>{c.drivers.length === 0 ? <span className="ip-faint">needs data</span> : <>{strong} of {scored.length}{blank > 0 && <span className="ip-faint"> ({blank} blank)</span>}</>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sorted.length === 0 && <div className="ip-card"><p className="ip-muted" style={{ margin: 0 }}>No chips yet for this interest. Add the first one below; it starts as a draft.</p></div>}

      <div className="ip-toolbar">
        {adding ? (
          <>
            <input className="ip-ch-name ip-ch-newname" autoFocus placeholder="Chip name, e.g. Day hikes" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) void add(); if (e.key === 'Escape') setAdding(false); }} />
            <button className="btn btn-primary" disabled={busy || !newName.trim()} onClick={add}>Add draft chip</button>
            <button className="btn" onClick={() => { setAdding(false); setNewName(''); }}>Cancel</button>
          </>
        ) : (
          <button className="btn" onClick={() => setAdding(true)}>+ New chip (draft)</button>
        )}
      </div>

      {current && (
        <div className="ip-card ip-ch-editor">
          <div className="ip-ch-edithead">
            <h3 style={{ margin: 0 }}>{current.label} <span className={`ip-chip ${current.status === 'live' ? 'good' : 'dim'}`}>{current.status === 'live' ? 'live' : 'draft'}</span></h3>
            <button className="ip-link-btn danger" disabled={busy} onClick={() => remove(current)}>Delete chip</button>
          </div>
          <div className="ip-faint">
            {current.approvedAt
              ? <>Approved by {current.approvedBy} on {when(current.approvedAt)}. {current.status !== 'live' && <button className="ip-link-btn" disabled={busy} onClick={() => approve(current, false)}>Take back approval</button>}</>
              : <>Not approved yet. A chip must be approved before it can go live. <button className="ip-link-btn" disabled={busy} onClick={() => approve(current, true)}>Approve this chip</button></>}
          </div>
          <div className="ip-faint">Driven by. A place&apos;s fit is the highest score among these columns.</div>
          {current.drivers.length === 0 && <div className="ip-faint">No columns yet. Add one.</div>}
          {current.drivers.map((d, ix) => (
            <DriverRow
              key={`${current.key}:${ix}:${d.column}:${d.fullAt ?? ''}`}
              d={d}
              def={factDefs.find((x) => x.key === d.column)}
              problem={driverProblem(d, factDefs)}
              busy={busy}
              onChange={(nd) => setDrivers(current, current.drivers.map((x, k) => (k === ix ? nd : x)))}
              onRemove={() => setDrivers(current, current.drivers.filter((_, k) => k !== ix))}
            />
          ))}
          {current.drivers.length < MAX_DRIVERS && (
            <div className="ip-ch-driver add">
              <select className="ip-select" value="" disabled={busy} aria-label="Add a column" onChange={(e) => { if (e.target.value) void addDriver(current, e.target.value); }}>
                <option value="">+ Add a column…</option>
                {driverCols.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
          )}
          <NeedsColumn key={`${current.key}:${current.needsColumn}`} chip={current} busy={busy} onSave={(v) => patch(current, { needsColumn: v, ...(v ? { status: 'draft' as const } : {}) })} />

          <div className="ip-subhead" style={{ marginTop: 6 }}>Places, best fit first <span className="ip-faint" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>Click a number to set your own.</span></div>
          {current.drivers.length === 0 ? (
            <div className="ip-faint">Add a column to see how places fit.</div>
          ) : (
            <div className="ip-table-wrap">
              <table className="ip-table ip-ch-places">
                <tbody>
                  {[...scored]
                    .map((p) => ({ p, f: shownFit(current, p), o: overrideOf(current.key, p.id) }))
                    .sort((a, b) => (b.f ?? -1) - (a.f ?? -1) || a.p.name.localeCompare(b.p.name))
                    .map(({ p, f, o }) => (
                      <tr key={p.id}>
                        <td style={{ width: '32%' }}><b>{p.name}</b><div className="ip-faint" style={{ fontSize: 11 }}>{p.region}</div></td>
                        <td style={{ width: 170 }}>
                          <span className="ip-ch-fit">
                            <button className={`ip-ch-num ${o ? 'ov' : ''}`} onClick={() => setEditing(editing === p.id ? null : p.id)} aria-label={`Set the fit for ${p.name}`}>{f === null ? '–' : roundFit(f)}</button>
                            <span className="ip-ch-bar"><b style={{ width: `${f === null ? 0 : f * 10}%` }} /></span>
                          </span>
                        </td>
                        <td>{o ? <><b style={{ color: 'var(--accent)' }}>Set by you</b>: {o.reason}</> : <span className="ip-muted">{fitBasis(current.drivers, factDefs, p.facts)}</span>}</td>
                      </tr>
                    ))}
                  {scored.length === 0 && <tr><td className="ip-faint">No places are scored for this interest.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {editing && (() => {
            const p = places.find((x) => x.id === editing);
            if (!p) return null;
            return (
              <OverrideBox
                key={`${current.key}:${p.id}`}
                place={p}
                worked={chipFit(current.drivers, factDefs, p.facts)}
                basis={fitBasis(current.drivers, factDefs, p.facts)}
                existing={overrideOf(current.key, p.id)}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={async (fit, reason) => {
                  const r = await run(() => saveChipOverride(interestKey, current.key, p.id, { fit, reason }));
                  if (!r || !r.ok) return;
                  setOverrides((all) => [...all.filter((o) => !(o.chipKey === current.key && o.placeId === p.id)), r.override]);
                  setEditing(null);
                }}
                onClear={async () => {
                  const r = await run(() => clearChipOverride(interestKey, current.key, p.id));
                  if (!r) return;
                  setOverrides((all) => all.filter((o) => !(o.chipKey === current.key && o.placeId === p.id)));
                  setEditing(null);
                }}
              />
            );
          })()}
        </div>
      )}

      {unused.length > 0 && (
        <details className="ip-ch-unused">
          <summary>{unused.length} column{unused.length === 1 ? '' : 's'} no chip uses</summary>
          <div className="ip-faint" style={{ marginTop: 6 }}>{unused.map((d) => d.label).join(' · ')}</div>
        </details>
      )}
    </div>
  );
}

function DriverRow({ d, def, problem, busy, onChange, onRemove }: { d: InterestChipDriver; def: FactDef | undefined; problem: string | null; busy: boolean; onChange: (d: InterestChipDriver) => void; onRemove: () => void }) {
  const [full, setFull] = useState(String(d.fullAt ?? ''));
  if (!def) return <div className="ip-ch-driver"><b>{d.column}</b><span className="ip-err">This column no longer exists.</span><button className="ip-link-btn danger" onClick={onRemove}>Remove</button></div>;
  let how: React.ReactNode = null;
  if (needsOption(def)) {
    how = (
      <>counts as 10 when it is{' '}
        <select className="ip-select" value={d.option ?? ''} disabled={busy} onChange={(e) => onChange({ ...d, option: e.target.value })}>
          {(def.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </>
    );
  } else if (def.type === 'int') {
    how = (
      <>reaches 10 at{' '}
        <input className="ip-ch-full" type="number" min={1} value={full} aria-label="The number that counts as 10" onChange={(e) => setFull(e.target.value)} onBlur={() => { const n = Number(full); if (n > 0 && n !== d.fullAt) onChange({ ...d, fullAt: n }); else setFull(String(d.fullAt ?? '')); }} />
      </>
    );
  } else if (def.type === 'rating') how = 'counts as it is (0 to 10)';
  else if (def.type === 'likelihood') how = 'Guaranteed is 10, Likely 8, Possible 5, Unlikely 2';
  else if (def.type === 'text') how = 'the best odds named in the cell: Guaranteed 10, Likely 8, Possible 5, Unlikely 2';
  else if (def.type === 'bool') how = 'ticked is 10';
  return (
    <div className="ip-ch-driver">
      <b>{def.label}</b>
      <span className="ip-muted">{how}</span>
      {problem && <span className="ip-err">{problem}</span>}
      <button className="ip-link-btn danger" style={{ marginLeft: 'auto' }} disabled={busy} onClick={onRemove} aria-label="Remove column">✕</button>
    </div>
  );
}

function NeedsColumn({ chip, busy, onSave }: { chip: ChipRow; busy: boolean; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(!!chip.needsColumn);
  const [v, setV] = useState(chip.needsColumn);
  if (!open) return <div><button className="ip-link-btn" onClick={() => setOpen(true)}>This chip needs a column that does not exist yet…</button></div>;
  return (
    <div className="ip-note ip-ch-needs">
      <div><b>Waiting on a new column.</b> Describe it below. The chip stays a draft until the column is added and this note is cleared. A new column is only added once you have approved it.</div>
      <div className="ip-toolbar" style={{ marginTop: 6 }}>
        <input className="ip-ch-name" style={{ flex: 1, minWidth: 220 }} value={v} maxLength={200} placeholder="e.g. Bird groups (pick any of seabirds, raptors, waterbirds…)" onChange={(e) => setV(e.target.value)} />
        <button className="btn" disabled={busy || v.trim() === chip.needsColumn} onClick={() => onSave(v.trim())}>Save note</button>
        {chip.needsColumn && <button className="btn" disabled={busy} onClick={() => { setV(''); onSave(''); setOpen(false); }}>Clear note</button>}
      </div>
    </div>
  );
}

function OverrideBox({ place, worked, basis, existing, busy, onSave, onClear, onCancel }: { place: InterestPlaceRow; worked: number | null; basis: string; existing: ChipOverrideRow | undefined; busy: boolean; onSave: (fit: number, reason: string) => void; onClear: () => void; onCancel: () => void }) {
  const [n, setN] = useState(existing ? String(existing.fit) : worked === null ? '' : String(Math.round(worked * 2) / 2));
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [err, setErr] = useState<string | null>(null);
  function save() {
    const fit = Number(n);
    if (n.trim() === '' || Number.isNaN(fit) || fit < 0 || fit > 10) return setErr('Enter a number from 0 to 10.');
    if (!reason.trim()) return setErr('A reason is required.');
    setErr(null);
    onSave(fit, reason.trim());
  }
  return (
    <div className="ip-ch-override">
      <b>{place.name}</b>
      <div className="ip-muted">Worked out as <b>{worked === null ? 'no data' : roundFit(worked)}</b> ({basis}).</div>
      <div className="ip-toolbar">
        <label className="ip-ch-lab">Your number <input type="number" min={0} max={10} step={0.5} value={n} onChange={(e) => setN(e.target.value)} className="ip-ch-full" /></label>
        <input className="ip-ch-name" style={{ flex: 1, minWidth: 220 }} placeholder="Reason (required)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        <button className="btn btn-primary" disabled={busy} onClick={save}>Save</button>
        {existing && <button className="btn" disabled={busy} onClick={onClear}>Use the worked-out number</button>}
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
      {err && <div className="ip-err">{err}</div>}
    </div>
  );
}
