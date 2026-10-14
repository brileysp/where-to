'use client';

import { useState } from 'react';
import { resetPersona, savePersonaField, savePersonaWeight } from '@/app/admin/personas/actions';

export interface PersonaView {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  primary: string[];
  weights: Record<string, number>;
  builtIn: { name: string; icon: string; blurb: string; primary: string[]; weights: Record<string, number> };
  edited: boolean;
}
export interface InterestView { key: string; label: string; icon: string; group: string }

/** Personas: the starting sets of interest weights. Every field saves straight away; the traveller app reads them on its next load. */
export function PersonasEditor({ personas, interests }: { personas: PersonaView[]; interests: InterestView[] }) {
  const [list, setList] = useState(personas);
  const [id, setId] = useState(personas[0]?.id);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const p = list.find((x) => x.id === id) ?? list[0];
  if (!p) return null;
  const groups = [...new Set(interests.map((i) => i.group))];

  const patch = (change: Partial<PersonaView>) => setList((all) => all.map((x) => (x.id === p.id ? { ...x, ...change, edited: true } : x)));
  async function field(f: 'name' | 'icon' | 'blurb' | 'primary', raw: string, current: string) {
    if (raw.trim() === current.trim()) return;
    setMsg(null);
    const r = await savePersonaField(p.id, f, raw);
    if (!r.ok) return setMsg({ text: r.message, bad: true });
    const text = raw.trim();
    patch(f === 'primary' ? { primary: text ? text.split(',').map((k) => k.trim()).filter(Boolean) : p.builtIn.primary } : ({ [f]: text || p.builtIn[f] } as Partial<PersonaView>));
    setMsg({ text: `${p.name}: saved`, bad: false });
  }
  async function weight(key: string, raw: string) {
    const built = p.builtIn.weights[key] ?? 2;
    if (raw.trim() === String(p.weights[key] ?? built)) return;
    setMsg(null);
    const r = await savePersonaWeight(p.id, key, raw);
    if (!r.ok) return setMsg({ text: r.message, bad: true });
    const n = raw.trim() === '' ? built : Number(raw);
    patch({ weights: { ...p.weights, [key]: n } });
    setMsg({ text: `${p.name}: saved`, bad: false });
  }
  async function reset() {
    if (!window.confirm(`Throw away every edit to ${p.name} and go back to the built-in persona?`)) return;
    const r = await resetPersona(p.id);
    if (!r.ok) return setMsg({ text: r.message, bad: true });
    setList((all) => all.map((x) => (x.id === p.id ? { ...x, ...x.builtIn, edited: false } : x)));
    setMsg({ text: `${p.name}: back to built-in`, bad: false });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {list.map((x) => (
          <button key={x.id} type="button" onClick={() => { setId(x.id); setMsg(null); }} style={{ padding: '6px 14px', border: '1px solid #ccc', borderRadius: 99, cursor: 'pointer', background: x.id === p.id ? '#1f6f6b' : '#fff', color: x.id === p.id ? '#fff' : '#222', fontWeight: 600 }}>
            {x.icon} {x.name}{x.edited ? ' •' : ''}
          </button>
        ))}
      </div>
      {msg && <div style={{ marginBottom: 10, fontSize: 13, color: msg.bad ? '#a63a2a' : '#2f7d46' }}>{msg.text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 18 }}>
        <label style={{ fontSize: 12, color: '#666' }}>Name<input key={p.id + p.name} defaultValue={p.name} style={{ display: 'block', width: '100%', padding: 6, fontSize: 14 }} onBlur={(e) => field('name', e.target.value, p.name)} /></label>
        <label style={{ fontSize: 12, color: '#666' }}>Icon<input key={p.id + p.icon} defaultValue={p.icon} style={{ display: 'block', width: 80, padding: 6, fontSize: 14 }} onBlur={(e) => field('icon', e.target.value, p.icon)} /></label>
        <label style={{ fontSize: 12, color: '#666', gridColumn: '1 / -1' }}>Blurb<textarea key={p.id + p.blurb} defaultValue={p.blurb} rows={2} style={{ display: 'block', width: '100%', padding: 6, fontSize: 14 }} onBlur={(e) => field('blurb', e.target.value, p.blurb)} /></label>
        <label style={{ fontSize: 12, color: '#666', gridColumn: '1 / -1' }}>Interests it highlights (keys, comma-separated, up to 12)<input key={p.id + p.primary.join()} defaultValue={p.primary.join(', ')} style={{ display: 'block', width: '100%', padding: 6, fontSize: 13, fontFamily: 'monospace' }} onBlur={(e) => field('primary', e.target.value, p.primary.join(', '))} /></label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Weights <span style={{ fontWeight: 400, color: '#666', fontSize: 12 }}>(0 to 10; 2 is neutral; blank goes back to the built-in weight)</span></h2>
        <button type="button" onClick={reset} disabled={!p.edited} style={{ padding: '5px 12px', cursor: p.edited ? 'pointer' : 'default' }}>Back to built-in persona</button>
      </div>
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, margin: '8px 0 4px', color: '#444' }}>{g}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '4px 14px' }}>
            {interests.filter((i) => i.group === g).map((i) => {
              const built = p.builtIn.weights[i.key] ?? 2;
              const cur = p.weights[i.key] ?? built;
              return (
                <label key={i.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, padding: '2px 0', background: cur !== built ? '#fbeed9' : undefined }} title={`Built-in: ${built}`}>
                  <span>{i.icon} {i.label}</span>
                  <input key={p.id + i.key + cur} type="number" min={0} max={10} step={0.5} defaultValue={cur} style={{ width: 56, padding: 3 }} onBlur={(e) => weight(i.key, e.target.value)} />
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
