'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { MonthMultiSelectCell, CheckboxCell } from './cells';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { useFieldEdit } from './useFieldEdit';

export interface SeasonalFlagsRow {
  id: string;
  name: string;
  emoji: string;
  continent: string;
  // Field names below match the Drizzle column property names exactly
  // (e.g. dryMonths, not dry) — applyAdminEdits uses `field` directly as
  // the .set() key, so this can't use ScoringDestination's shorter names.
  dryMonths: number[];
  wetMonths: number[];
  hotMonths: number[];
  coldMonths: number[];
  peakMonths: number[];
  lowMonths: number[];
  wildlifePeakMonths: number[];
  wildlifeClosedMonths: number[];
  birdingPeakMonths: number[];
  hikingBestMonths: number[];
  hikingWorstMonths: number[];
  inaccessibleMonths: number[];
  swimHazardMonths: number[];
  noSnowMonths: number[];
  shopClosures: boolean;
  updatedAt: string; // ISO
}

const MONTH_ARRAY_FIELDS: Array<{ key: keyof SeasonalFlagsRow & string; label: string; fieldLabel: string; hint?: string }> = [
  { key: 'dryMonths', label: 'Dry', fieldLabel: 'Dry months' },
  { key: 'wetMonths', label: 'Wet', fieldLabel: 'Wet months' },
  { key: 'hotMonths', label: 'Hot', fieldLabel: 'Hot months' },
  { key: 'coldMonths', label: 'Cold', fieldLabel: 'Cold months' },
  { key: 'peakMonths', label: 'Peak', fieldLabel: 'Peak (busy) months' },
  { key: 'lowMonths', label: 'Low', fieldLabel: 'Low (quiet) months' },
  { key: 'wildlifePeakMonths', label: 'Wildlife peak', fieldLabel: 'Wildlife peak months' },
  { key: 'wildlifeClosedMonths', label: 'Wildlife closed', fieldLabel: 'Wildlife closed months', hint: 'Reserve/park closed this month.' },
  { key: 'birdingPeakMonths', label: 'Birding peak', fieldLabel: 'Birding peak months' },
  { key: 'hikingBestMonths', label: 'Hiking best', fieldLabel: 'Hiking best months', hint: 'Overrides the dry/wet+hot+cold fallback for hiking-formula sliders.' },
  { key: 'hikingWorstMonths', label: 'Hiking worst', fieldLabel: 'Hiking worst months' },
  { key: 'inaccessibleMonths', label: 'Inaccessible', fieldLabel: 'Inaccessible months', hint: 'Hard floor — zeroes every slider this month.' },
  { key: 'swimHazardMonths', label: 'Swim hazard', fieldLabel: 'Swim hazard months' },
  { key: 'noSnowMonths', label: 'No snow', fieldLabel: 'No-snow months', hint: 'Hard floor for snowsports, independent of hot/dry flags.' },
];

export function SeasonalFlagsGrid({ initialRows }: { initialRows: SeasonalFlagsRow[] }) {
  const [rows, setRows] = useState(initialRows);

  useUpdatedAtSync('destination', (entityId, updatedAt) => {
    setRows((rs) => rs.map((r) => (r.id === entityId ? { ...r, updatedAt } : r)));
  });

  function patchRow(id: string, patch: Partial<SeasonalFlagsRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const columns: GridColumn<SeasonalFlagsRow>[] = [
    {
      key: 'name',
      label: 'Place',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="cell-inner">
          <span style={{ fontSize: 15 }}>{r.emoji}</span>
          <Link href={`/admin/destinations/${r.id}/profile`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
            {r.name}
          </Link>
        </div>
      ),
    },
    { key: 'continent', label: 'Continent', sortable: true, sortValue: (r) => r.continent, render: (r) => <div className="cell-inner">{r.continent}</div> },
    ...MONTH_ARRAY_FIELDS.map(
      ({ key, label, fieldLabel, hint }): GridColumn<SeasonalFlagsRow> => ({
        key,
        label,
        render: (r) => (
          <MonthMultiSelectCell
            ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: key, fieldLabel: hint ? `${fieldLabel} — ${hint}` : fieldLabel, loadedUpdatedAt: r.updatedAt }}
            value={r[key] as number[]}
            setLocal={(v) => patchRow(r.id, { [key]: v } as Partial<SeasonalFlagsRow>)}
          />
        ),
      }),
    ),
    {
      key: 'shopClosures',
      label: 'Shop closures',
      render: (r) => (
        <CheckboxCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'shopClosures', fieldLabel: 'Shop closures', loadedUpdatedAt: r.updatedAt }}
          value={r.shopClosures}
          setLocal={(v) => patchRow(r.id, { shopClosures: v })}
        />
      ),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      sortValue: (r) => r.updatedAt,
      render: (r) => <div className="cell-inner" style={{ color: 'var(--text-faint)' }}>{new Date(r.updatedAt).toLocaleDateString()}</div>,
    },
  ];

  return (
    <AdminDataGrid
      toolbarExtra={<BulkTools rows={rows} patchRow={patchRow} />}
      rows={rows}
      columns={columns}
      rowId={(r) => r.id}
      searchText={(r) => `${r.name} ${r.continent} ${r.id}`}
      searchPlaceholder="Search place…"
      footerNote={`${initialRows.length} places · month flags editable inline — a hard floor (inaccessible/noSnow) zeroes the relevant sliders that month regardless of any other flag`}
    />
  );
}


const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Copy every month flag from one place to another, or set one flag's months on many places at once. Every change goes to the pending-changes tray, so nothing is saved until Review & save. */
function BulkTools({ rows, patchRow }: { rows: SeasonalFlagsRow[]; patchRow: (id: string, patch: Partial<SeasonalFlagsRow>) => void }) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');
  const [field, setField] = useState<string>(MONTH_ARRAY_FIELDS[0].key);
  const [months, setMonths] = useState<number[]>([]);
  const [mode, setMode] = useState<'set' | 'add' | 'remove'>('set');
  const [continent, setContinent] = useState('');
  const [targets, setTargets] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const continents = Array.from(new Set(rows.map((r) => r.continent))).sort();

  function setMonthsOn(r: SeasonalFlagsRow, key: string, label: string, next: number[]) {
    const old = r[key as keyof SeasonalFlagsRow] as number[];
    if (JSON.stringify(old) === JSON.stringify(next)) return false;
    commit<number[]>({
      entityType: 'destination', entityId: r.id, entityLabel: r.name, field: key, fieldLabel: label, loadedUpdatedAt: r.updatedAt,
      oldValue: old, newValue: next, toLabel: (v) => (v.length ? v.map((m) => MONTH_NAMES_SHORT[m - 1]).join(', ') : '(none)'),
      setLocal: (v) => patchRow(r.id, { [key]: v } as Partial<SeasonalFlagsRow>),
    });
    return true;
  }

  function copy() {
    const from = rows.find((r) => r.id === copyFrom);
    const to = rows.find((r) => r.id === copyTo);
    if (!from || !to || from.id === to.id) return setMsg('Pick two different places.');
    let n = 0;
    for (const f of MONTH_ARRAY_FIELDS) if (setMonthsOn(to, f.key, `${f.fieldLabel} (copied from ${from.name})`, [...(from[f.key as keyof SeasonalFlagsRow] as number[])])) n++;
    setMsg(n ? `${n} flag${n === 1 ? '' : 's'} queued for ${to.name}. Review & save to keep them.` : 'Nothing to copy: they already match.');
  }

  function bulk() {
    const def = MONTH_ARRAY_FIELDS.find((f) => f.key === field)!;
    const ids = new Set([...targets, ...(continent ? rows.filter((r) => r.continent === continent).map((r) => r.id) : [])]);
    if (ids.size === 0) return setMsg('Pick a continent or at least one place.');
    if (months.length === 0 && mode !== 'set') return setMsg('Pick at least one month.');
    let n = 0;
    for (const r of rows) {
      if (!ids.has(r.id)) continue;
      const cur = r[field as keyof SeasonalFlagsRow] as number[];
      const next = mode === 'set' ? [...months] : mode === 'add' ? Array.from(new Set([...cur, ...months])) : cur.filter((m) => !months.includes(m));
      if (setMonthsOn(r, field, `${def.fieldLabel} (bulk ${mode})`, next.sort((a, b) => a - b))) n++;
    }
    setMsg(n ? `${def.label} changed on ${n} place${n === 1 ? '' : 's'}. Review & save to keep them.` : 'Nothing changed: those places already match.');
  }

  return (
    <span style={{ position: 'relative' }}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>Copy and bulk edit</button>
      {open && (
        <div style={{ position: 'absolute', top: '120%', left: 0, zIndex: 60, width: 520, maxWidth: '92vw', background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.18)', padding: 14, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <b>Copy every flag from one place to another</b>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <select className="cell-select" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}><option value="">From…</option>{sorted.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <select className="cell-select" value={copyTo} onChange={(e) => setCopyTo(e.target.value)}><option value="">To…</option>{sorted.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <button type="button" className="btn btn-primary" onClick={copy}>Copy</button>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <b>Set one flag on many places</b>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="cell-select" value={field} onChange={(e) => setField(e.target.value)}>{MONTH_ARRAY_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
              <select className="cell-select" value={mode} onChange={(e) => setMode(e.target.value as 'set' | 'add' | 'remove')}><option value="set">Set to exactly these months</option><option value="add">Add these months</option><option value="remove">Remove these months</option></select>
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 8, flexWrap: 'wrap' }}>
              {MONTH_NAMES_SHORT.map((m, i) => {
                const on = months.includes(i + 1);
                return <button key={m} type="button" onClick={() => setMonths(on ? months.filter((x) => x !== i + 1) : [...months, i + 1])} style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', background: on ? 'var(--accent)' : 'var(--bg-panel)', color: on ? '#fff' : 'var(--text-dim)', cursor: 'pointer', fontSize: 11.5 }}>{m}</button>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <select className="cell-select" value={continent} onChange={(e) => setContinent(e.target.value)}><option value="">All places in a continent…</option>{continents.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select multiple size={5} value={targets} onChange={(e) => setTargets(Array.from(e.target.selectedOptions).map((o) => o.value))} style={{ minWidth: 200, fontSize: 12 }} aria-label="Or pick places (hold Cmd or Ctrl to pick several)">{sorted.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            </div>
            <div style={{ marginTop: 8 }}><button type="button" className="btn btn-primary" onClick={bulk}>Apply to the picked places</button></div>
          </div>
          {msg && <div style={{ color: 'var(--accent)' }}>{msg}</div>}
        </div>
      )}
    </span>
  );
}
