'use client';

import { useState } from 'react';
import Link from 'next/link';
import { quickEditCard, type QuickCardField } from '@/app/admin/cards/actions';

export interface CardListRow {
  id: string;
  short: string;
  title: string;
  category: string;
  stage: 'broad' | 'deep';
  domainKey: string | null;
  niche: boolean;
  tags: string[];
  unlockMinPositive: number | null;
  unlockMinLove: number | null;
  updatedAt: string;
}

const cell = { padding: '4px 6px' } as const;
const input = { width: '100%', padding: '3px 5px', fontSize: 13, boxSizing: 'border-box' } as const;

/** The Cards list. Most fields can be changed right here; each change saves straight away and is audited like a form save. */
export function CardsTable({ initialRows, domainOptions }: { initialRows: CardListRow[]; domainOptions: string[] }) {
  const [rows, setRows] = useState(initialRows);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);

  async function edit(id: string, field: QuickCardField, raw: string | boolean, apply: (r: CardListRow) => CardListRow) {
    setMsg(null);
    const res = await quickEditCard(id, field, raw);
    if (!res.ok) return setMsg({ text: `${id}: ${res.message}`, bad: true });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...apply(r), updatedAt: res.updatedAt } : r)));
    setMsg({ text: `${id}: saved`, bad: false });
  }

  return (
    <>
      {msg && <div style={{ marginBottom: 10, fontSize: 13, color: msg.bad ? '#a63a2a' : '#2f7d46' }}>{msg.text}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              {['id', 'short', 'title', 'category', 'stage', 'domain', 'niche', 'tags', 'unlock (yes)', 'unlock (love)', 'updated'].map((h) => <th key={h} style={cell}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={cell}><Link href={`/admin/cards/${r.id}`}>{r.id}</Link></td>
                <td style={cell}><input style={{ ...input, minWidth: 90 }} defaultValue={r.short} onBlur={(e) => e.target.value.trim() !== r.short && edit(r.id, 'short', e.target.value, (x) => ({ ...x, short: e.target.value.trim() }))} /></td>
                <td style={cell}><input style={{ ...input, minWidth: 170 }} defaultValue={r.title} onBlur={(e) => e.target.value.trim() !== r.title && edit(r.id, 'title', e.target.value, (x) => ({ ...x, title: e.target.value.trim() }))} /></td>
                <td style={cell}><input style={{ ...input, minWidth: 110 }} defaultValue={r.category} onBlur={(e) => e.target.value.trim() !== r.category && edit(r.id, 'category', e.target.value, (x) => ({ ...x, category: e.target.value.trim() }))} /></td>
                <td style={cell}>
                  <select style={input} value={r.stage} onChange={(e) => edit(r.id, 'stage', e.target.value, (x) => ({ ...x, stage: e.target.value as 'broad' | 'deep' }))}>
                    <option value="broad">broad</option><option value="deep">deep</option>
                  </select>
                </td>
                <td style={cell}>
                  <select style={input} value={r.domainKey ?? ''} onChange={(e) => edit(r.id, 'domainKey', e.target.value, (x) => ({ ...x, domainKey: e.target.value || null }))}>
                    <option value="">— none —</option>
                    {domainOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </td>
                <td style={cell}><input type="checkbox" checked={r.niche} onChange={(e) => edit(r.id, 'niche', e.target.checked, (x) => ({ ...x, niche: e.target.checked }))} /></td>
                <td style={cell}><input style={{ ...input, minWidth: 140 }} defaultValue={r.tags.join(', ')} onBlur={(e) => e.target.value.trim() !== r.tags.join(', ') && edit(r.id, 'tags', e.target.value, (x) => ({ ...x, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))} /></td>
                <td style={cell}><input type="number" min={0} style={{ ...input, width: 70 }} defaultValue={r.unlockMinPositive ?? ''} onBlur={(e) => String(r.unlockMinPositive ?? '') !== e.target.value.trim() && edit(r.id, 'unlockMinPositive', e.target.value, (x) => ({ ...x, unlockMinPositive: e.target.value.trim() === '' ? null : Number(e.target.value) }))} /></td>
                <td style={cell}><input type="number" min={0} style={{ ...input, width: 70 }} defaultValue={r.unlockMinLove ?? ''} onBlur={(e) => String(r.unlockMinLove ?? '') !== e.target.value.trim() && edit(r.id, 'unlockMinLove', e.target.value, (x) => ({ ...x, unlockMinLove: e.target.value.trim() === '' ? null : Number(e.target.value) }))} /></td>
                <td style={{ ...cell, color: '#888', whiteSpace: 'nowrap' }}>{new Date(r.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
