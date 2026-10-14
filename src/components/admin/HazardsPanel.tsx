'use client';

import { useState } from 'react';
import { useFieldEdit } from './useFieldEdit';
import type { SeasonalHazard, HazardCategory, Severity } from '@/lib/scoring/types';

const CATEGORIES: Array<{ value: HazardCategory; label: string }> = [
  { value: 'storm', label: 'Storm (hurricane, typhoon, monsoon)' },
  { value: 'airQuality', label: 'Air quality (smoke, haze)' },
  { value: 'insects', label: 'Insects' },
  { value: 'seaweed', label: 'Seaweed' },
  { value: 'other', label: 'Other' },
];
const SEVERITIES: Severity[] = ['mild', 'moderate', 'severe'];
const MONTH_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Seasonal hazards for one place: the months a real hazard (hurricane season, monsoon, smoke) cuts into scores, how severe it is, and which
 * interests it affects. The scoring engine reads these, so every change here moves scores. Edits go to the pending-changes tray as one
 * whole list, like every other cell.
 */
export function HazardsPanel({
  destId,
  destName,
  updatedAt,
  initial,
  sliders,
}: {
  destId: string;
  destName: string;
  updatedAt: string;
  initial: SeasonalHazard[];
  sliders: Array<{ key: string; label: string; icon: string }>;
}) {
  const commit = useFieldEdit();
  const [list, setList] = useState<SeasonalHazard[]>(initial);
  const [open, setOpen] = useState(false);

  function write(next: SeasonalHazard[], what: string) {
    commit<SeasonalHazard[]>({
      entityType: 'destination',
      entityId: destId,
      entityLabel: destName,
      field: 'seasonalHazards',
      fieldLabel: `Seasonal hazards: ${what}`,
      loadedUpdatedAt: updatedAt,
      oldValue: list,
      newValue: next,
      toLabel: (v) => (v.length === 0 ? 'none' : v.map((h) => `${h.label} (${h.months.length} mo, ${h.severity})`).join('; ')),
      setLocal: setList,
    });
  }
  const patch = (i: number, change: Partial<SeasonalHazard>, what: string) => write(list.map((h, j) => (j === i ? { ...h, ...change } : h)), what);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, margin: '10px 12px', background: 'var(--bg-panel)' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>
        {open ? '▾' : '▸'} Seasonal hazards <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>· {list.length === 0 ? 'none set' : `${list.length} set`} · these months lower scores for the interests they affect</span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.length === 0 && <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>No hazards recorded for {destName}.</div>}
          {list.map((h, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, alignItems: 'start', borderTop: i ? '1px solid var(--border)' : 'none', paddingTop: i ? 10 : 0 }}>
              <label style={{ fontSize: 11, color: 'var(--text-faint)' }}>Kind
                <select className="cell-select" value={h.category} onChange={(e) => patch(i, { category: e.target.value as HazardCategory }, `${h.label} kind`)} style={{ display: 'block', width: '100%' }}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-faint)' }}>Label shown to travellers
                <input className="cost-input" defaultValue={h.label} maxLength={80} style={{ display: 'block', width: '100%' }} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.label) patch(i, { label: v }, `${h.label} label`); else e.target.value = h.label; }} />
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-faint)' }}>Severity
                <select className="cell-select" value={h.severity} onChange={(e) => patch(i, { severity: e.target.value as Severity }, `${h.label} severity`)} style={{ display: 'block', width: '100%' }}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Months
                <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                  {MONTH_SHORT.map((m, idx) => {
                    const on = h.months.includes(idx + 1);
                    return (
                      <button key={idx} type="button" title={MONTH_NAMES[idx]} onClick={() => { const months = on ? h.months.filter((x) => x !== idx + 1) : [...h.months, idx + 1].sort((a, b) => a - b); if (months.length) patch(i, { months }, `${h.label} months`); }} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: on ? 'var(--accent)' : 'var(--bg-panel)', color: on ? '#fff' : 'var(--text-dim)', fontSize: 10.5, cursor: 'pointer', padding: 0 }}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
              <details style={{ fontSize: 11, color: 'var(--text-faint)', gridColumn: '1 / -1' }}>
                <summary style={{ cursor: 'pointer' }}>Interests it affects ({h.affectedSliders.length})</summary>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {sliders.map((s) => (
                    <label key={s.key} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11.5, color: 'var(--text)' }}>
                      <input type="checkbox" checked={h.affectedSliders.includes(s.key)} onChange={() => patch(i, { affectedSliders: h.affectedSliders.includes(s.key) ? h.affectedSliders.filter((k) => k !== s.key) : [...h.affectedSliders, s.key] }, `${h.label} interests`)} />
                      {s.icon} {s.label}
                    </label>
                  ))}
                </div>
              </details>
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="button" className="btn" onClick={() => write(list.filter((_, j) => j !== i), `removed ${h.label}`)}>Remove this hazard</button>
              </div>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-primary" onClick={() => write([...list, { category: 'storm', label: 'New hazard', months: [1], severity: 'moderate', affectedSliders: [] }], 'added a hazard')}>+ Add a hazard</button>
          </div>
        </div>
      )}
    </div>
  );
}
