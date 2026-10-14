'use client';

import { useState } from 'react';
import { saveDnaField } from '@/app/admin/dna/actions';
import { DNA_TABLES, type DnaField, type DnaTableKey } from '@/lib/admin/dna-config';

export type DnaRow = { id: string; idShown: string; values: Record<string, unknown> };

const show = (f: DnaField, v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (f.kind === 'list') return Array.isArray(v) ? v.join(', ') : String(v);
  if (f.kind === 'json') return JSON.stringify(v, null, 1);
  return String(v);
};

/** The Travel DNA content tables: every cell can be edited and saves straight away. The traveller app reads these tables live. */
export function DnaTables({ data }: { data: Record<DnaTableKey, DnaRow[]> }) {
  const [tab, setTab] = useState<DnaTableKey>('domains');
  const [rows, setRows] = useState(data);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const def = DNA_TABLES.find((t) => t.key === tab)!;

  async function save(row: DnaRow, f: DnaField, raw: string | boolean) {
    const before = show(f, row.values[f.key]);
    if (typeof raw === 'string' && raw.trim() === before.trim()) return;
    setMsg(null);
    const res = await saveDnaField(tab, row.id, f.key, raw);
    if (!res.ok) return setMsg({ text: `${row.idShown} · ${f.label}: ${res.message}`, bad: true });
    setRows((all) => ({ ...all, [tab]: all[tab].map((r) => (r.id === row.id ? { ...r, values: { ...r.values, [f.key]: res.value } } : r)) }));
    setMsg({ text: `${row.idShown} · ${f.label}: saved`, bad: false });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {DNA_TABLES.map((t) => (
          <button key={t.key} type="button" onClick={() => { setTab(t.key); setMsg(null); }} style={{ padding: '6px 14px', border: '1px solid #ccc', borderRadius: 99, cursor: 'pointer', background: tab === t.key ? '#1f6f6b' : '#fff', color: tab === t.key ? '#fff' : '#222', fontWeight: 600 }}>
            {t.label} ({rows[t.key].length})
          </button>
        ))}
      </div>
      <p style={{ color: '#555', fontSize: 13, maxWidth: 820 }}>{def.help}</p>
      {msg && <div style={{ margin: '8px 0', fontSize: 13, color: msg.bad ? '#a63a2a' : '#2f7d46' }}>{msg.text}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: '4px 8px' }}>{def.idLabel}</th>
              {def.fields.map((f) => <th key={f.key} style={{ padding: '4px 8px' }}>{f.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows[tab].map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#666', whiteSpace: 'nowrap' }}>{r.idShown}</td>
                {def.fields.map((f) => (
                  <td key={f.key} style={{ padding: '4px 6px' }}>
                    {f.kind === 'bool' ? (
                      <input type="checkbox" checked={r.values[f.key] === true} onChange={(e) => save(r, f, e.target.checked)} />
                    ) : f.kind === 'longtext' || f.kind === 'json' ? (
                      <textarea key={show(f, r.values[f.key])} defaultValue={show(f, r.values[f.key])} rows={f.kind === 'json' ? 5 : 3} style={{ width: f.width ?? 240, fontSize: 12.5, fontFamily: f.kind === 'json' ? 'monospace' : 'inherit' }} onBlur={(e) => save(r, f, e.target.value)} />
                    ) : (
                      <input key={show(f, r.values[f.key])} defaultValue={show(f, r.values[f.key])} type={f.kind === 'int' ? 'number' : 'text'} min={f.kind === 'int' ? 0 : undefined} style={{ width: f.width ?? 160, fontSize: 13 }} onBlur={(e) => save(r, f, e.target.value)} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
