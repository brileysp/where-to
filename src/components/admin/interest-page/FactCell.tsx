'use client';

import { useEffect, useRef, useState } from 'react';
import type { InterestFactValue } from '@/lib/db/schema';
import { DRAW_RATINGS, optionLabel, optionsFor, type FactDef } from '@/lib/admin/interest-pages/config';
import { saveFact } from '@/app/admin/destinations/interests/[key]/actions';

export function factToText(def: FactDef, v: InterestFactValue | undefined): string {
  if (v === undefined || v === null) return '';
  if (def.type === 'choice' || def.type === 'likelihood' || def.type === 'multi') return optionLabel(def, v);
  // Lists saved before a column became free text still come back as arrays.
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}


// Inline as well as in the stylesheet, so a stale cached stylesheet can never bring back wrapped, overlapping rows.
const CLIP_STYLE = { display: 'block', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' } as const;
const CELL_STYLE = { width: 220, minWidth: 220, maxWidth: 220 } as const;
const CELL_STYLE_WIDE = { width: 300, minWidth: 300, maxWidth: 300 } as const;

const LEVELS = new Set(['guaranteed', 'likely', 'possible', 'unlikely', 'not present']);

/** Splits "Animal (likely), Animal (possible, habituated), 12 monkey species" at the commas outside brackets. */
function splitEntries(text: string): string[] {
  return text.split(/,\s*(?![^()]*\))/).map((e) => e.trim()).filter(Boolean);
}

/** Read-only view of an animal list: each animal with its likelihood as a colored pill, same colors as the safari grid. */
function AnimalPills({ text, nowrap }: { text: string; nowrap?: boolean }) {
  return (
    <span className="ip-animals" style={nowrap ? { flexWrap: 'nowrap' } : undefined}>
      {splitEntries(text).map((e, i) => {
        const m = /^(.*?)\s*\((not present|[a-z]+)(.*)\)$/i.exec(e);
        if (m && LEVELS.has(m[2].toLowerCase())) {
          const level = m[2].toLowerCase();
          const levelClass = level === 'not present' ? 'notPresent' : level;
          const extra = m[3].replace(/^,\s*/, ', ').trim();
          return (
            <span className="ip-animal" key={i}>
              <span className="ip-animal-name">{m[1]}</span>
              <span className={`ip-lkpill ip-lk-${levelClass}`}>{level}{extra ? ` ${extra.replace(/^,\s*/, '· ')}` : ''}</span>
            </span>
          );
        }
        return <span className="ip-animal ip-animal-note" key={i}>{e}</span>;
      })}
    </span>
  );
}

/** One editable cell. Saves on blur or Enter; Escape puts the old value back. Give it a `key` that includes
 * the saved value so it remounts (and shows the new value) whenever that value changes. */
export function FactCell({ interestKey, placeId, def, value, onSaved }: { interestKey: string; placeId: string; def: FactDef; value: InterestFactValue | undefined; onSaved: (placeId: string, key: string, v: InterestFactValue) => void }) {
  const [text, setText] = useState(factToText(def, value));
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function commit(raw: unknown) {
    setState('saving');
    setMsg('');
    const r = await saveFact(interestKey, placeId, def.key, raw);
    if (!r.ok) {
      setState('error');
      setMsg(r.message);
      return;
    }
    setState('idle');
    onSaved(placeId, def.key, r.value);
    setText(factToText(def, r.value));
  }

  if (def.type === 'bool') {
    return (
      <div className="cell-inner ip-factcell">
        <input type="checkbox" checked={value === true} disabled={state === 'saving'} onChange={(e) => commit(e.target.checked)} aria-label={def.label} />
        {state === 'error' && <span className="ip-err" title={msg}>!</span>}
      </div>
    );
  }
  if (def.type === 'draw') {
    return (
      <div className="cell-inner ip-factcell">
        <select className="cell-select" value={typeof value === 'string' ? value : ''} disabled={state === 'saving'} onChange={(e) => commit(e.target.value)} aria-label={def.label} title={state === 'error' ? msg : undefined}>
          <option value="">—</option>
          {DRAW_RATINGS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
    );
  }
  if (def.type === 'multi') return <MultiCell def={def} value={value} state={state} msg={msg} commit={commit} />;
  if (def.type === 'choice' || def.type === 'likelihood') {
    const cur = typeof value === 'string' ? value : '';
    return (
      <div className="cell-inner ip-factcell">
        <select className={`cell-select ${def.type === 'likelihood' && cur ? `ip-lk ip-lk-${cur}` : ''}`} value={cur} disabled={state === 'saving'} onChange={(e) => commit(e.target.value)} aria-label={def.label} title={state === 'error' ? msg : def.hint}>
          <option value="">—</option>
          {optionsFor(def).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  const longText = def.type === 'text' || def.type === 'list' || def.type === 'birds';
  if (longText) return <LongTextCell def={def} value={value} text={text} setText={setText} state={state} setState={setState} msg={msg} commit={commit} />;
  const numeric = def.type === 'int' || def.type === 'rating';
  return (
    <div className="cell-inner ip-factcell">
      <input
        className={`cost-input ${numeric ? 'num' : ''} ${state === 'error' ? 'invalid' : ''}`}
        type="text"
        inputMode={numeric ? 'decimal' : 'text'}
        value={text}
        placeholder="—"
        disabled={state === 'saving'}
        title={state === 'error' ? msg : def.hint}
        aria-label={def.label}
        onChange={(e) => { setText(e.target.value); if (state === 'error') setState('idle'); }}
        onBlur={() => { if (text !== factToText(def, value)) commit(text); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setText(factToText(def, value)); setState('idle'); (e.target as HTMLInputElement).blur(); }
        }}
      />
    </div>
  );
}

/** Long text shown as one clipped line (grid rows stay one line tall). Click it to open a popup with the full text; "Edit" in the popup switches to a box that grows with the text. */
function LongTextCell({ def, value, text, setText, state, setState, msg, commit }: { def: FactDef; value: InterestFactValue | undefined; text: string; setText: (t: string) => void; state: 'idle' | 'saving' | 'error'; setState: (s: 'idle' | 'saving' | 'error') => void; msg: string; commit: (raw: unknown) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [pop, setPop] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const saved = factToText(def, value);

  useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);
  useEffect(() => {
    const el = ref.current;
    if (editing && el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [editing, text, pop]);
  useEffect(() => {
    if (!pop) return;
    const close = (e: Event) => {
      if (e instanceof MouseEvent && popRef.current?.contains(e.target as Node)) return;
      if (e instanceof Event && e.type === 'scroll' && popRef.current?.contains(e.target as Node)) return;
      setPop(null);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) setPop(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pop, editing]);

  function openPop() {
    const r = cellRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(480, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
    const top = Math.min(r.bottom + 4, Math.max(12, window.innerHeight - 280));
    setPop({ top, left, width });
  }

  const full = saved === '' ? <span className="ip-faint">Nothing entered yet</span> : def.animals ? <AnimalPills text={saved} /> : <span className="ip-wraptext">{saved}</span>;
  return (
    <>
      <div ref={cellRef} className={`cell-inner ip-factcell ip-longcell ${def.wide ? 'ip-longwide' : ''} ${state === 'error' ? 'invalid' : ''}`} role="button" tabIndex={0} style={def.wide ? CELL_STYLE_WIDE : CELL_STYLE} title={state === 'error' ? msg : undefined} onClick={openPop} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPop(); } }}>
        <span className="ip-clip" style={CLIP_STYLE}>{saved === '' ? <span className="ip-faint">—</span> : def.animals ? <AnimalPills text={saved} nowrap /> : saved}</span>
        {state === 'error' && <span className="ip-err" title={msg}>!</span>}
      </div>
      {pop && (
        <div ref={popRef} className="ip-pop" style={{ top: pop.top, left: pop.left, width: pop.width }} role="dialog" aria-label={def.label}>
          <div className="ip-pop-head">
            <b>{def.label}</b>
            <span className="ip-pop-actions">
              {!editing && <button type="button" onClick={() => setEditing(true)}>Edit</button>}
              <button type="button" onClick={() => { setEditing(false); setPop(null); }}>Close</button>
            </span>
          </div>
          {def.hint && <div className="ip-pop-hint">{def.hint}</div>}
          {editing ? (
            <textarea
              ref={ref}
              className={`cost-input ip-longbox ${state === 'error' ? 'invalid' : ''}`}
              rows={3}
              value={text}
              disabled={state === 'saving'}
              aria-label={def.label}
              onChange={(e) => { setText(e.target.value); if (state === 'error') setState('idle'); }}
              onBlur={async () => { if (text !== saved) await commit(text); setEditing(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
                if (e.key === 'Escape') { setText(saved); setState('idle'); setEditing(false); }
              }}
            />
          ) : full}
          {state === 'error' && <div className="ip-err">{msg}</div>}
        </div>
      )}
    </>
  );
}

/** A column where several options can apply: the chosen ones show as chips, and clicking opens a box of checkboxes. Each tick saves at once. */
function MultiCell({ def, value, state, msg, commit }: { def: FactDef; value: InterestFactValue | undefined; state: 'idle' | 'saving' | 'error'; msg: string; commit: (raw: unknown) => Promise<void> }) {
  const [pop, setPop] = useState<{ top: number; left: number } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const chosen = Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [];
  const options = optionsFor(def);

  useEffect(() => {
    if (!pop) return;
    const close = (e: Event) => { if (popRef.current?.contains(e.target as Node)) return; setPop(null); };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pop]);

  function openPop() {
    const r = cellRef.current?.getBoundingClientRect();
    if (!r) return;
    setPop({ top: Math.min(r.bottom + 4, Math.max(12, window.innerHeight - 240)), left: Math.max(12, Math.min(r.left, window.innerWidth - 232)) });
  }
  function toggle(v: string) {
    commit(chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v]);
  }

  return (
    <>
      <div ref={cellRef} className={`cell-inner ip-factcell band-cell${chosen.length ? '' : ' empty-hint'}`} role="button" tabIndex={0} title={state === 'error' ? msg : def.hint} onClick={openPop} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPop(); } }}>
        {chosen.length === 0 ? 'Click to set…' : chosen.map((v) => <span className="band-chip" key={v}>{options.find((o) => o.value === v)?.label ?? v}</span>)}
        {state === 'error' && <span className="ip-err" title={msg}>!</span>}
      </div>
      {pop && (
        <div ref={popRef} className="band-popover" style={{ top: pop.top, left: pop.left }} role="dialog" aria-label={def.label}>
          {options.map((o) => (
            <label className="band-opt" key={o.value}>
              <input type="checkbox" checked={chosen.includes(o.value)} disabled={state === 'saving'} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </>
  );
}
