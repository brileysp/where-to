'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_MATCH_SETTINGS, MATCH_SETTING_FIELDS, matchSettingsProblem, type MatchSettings } from '@/lib/scoring/matchSettings';
import { matchInterest } from '@/lib/scoring/personalMatch';
import { resetMatchSettings, saveMatchSettings } from '@/app/admin/destinations/matching/actions';
import './matching.css';

const show = (f: (typeof MATCH_SETTING_FIELDS)[number], v: number) => (f.percent ? String(Math.round(v * 100)) : String(v));
const parse = (f: (typeof MATCH_SETTING_FIELDS)[number], raw: string) => (f.percent ? Number(raw) / 100 : Number(raw));

export function MatchingSettingsView({ initial }: { initial: MatchSettings }) {
  const [saved, setSaved] = useState<MatchSettings>(initial);
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(MATCH_SETTING_FIELDS.map((f) => [f.key, show(f, initial[f.key])])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [raw, setRaw] = useState(9);
  const [noChip, setNoChip] = useState(true);
  const [limits, setLimits] = useState(0);
  const [leans, setLeans] = useState(1);

  const draft: MatchSettings = useMemo(() => {
    const d = { ...saved };
    for (const f of MATCH_SETTING_FIELDS) {
      const n = parse(f, text[f.key]);
      if (text[f.key].trim() !== '' && Number.isFinite(n)) d[f.key] = n;
    }
    return d;
  }, [saved, text]);
  const problem = matchSettingsProblem(draft);
  const dirty = MATCH_SETTING_FIELDS.some((f) => draft[f.key] !== saved[f.key]);

  const preview = useMemo(() => {
    if (problem) return null;
    return matchInterest(
      {
        ticked: noChip ? [{ label: 'Big mountain climbs', rating: 0 }] : [],
        chipsOffered: 4,
        answers: [
          ...Array.from({ length: limits }, () => ({ kind: 'limit' as const, fit: 0, message: 'Water colder than your limit' })),
          ...Array.from({ length: leans }, (_, i) => ({ kind: 'lean' as const, fit: 0, message: i === 0 ? 'No right-hand waves' : 'Not your style of resort' })),
        ],
      },
      draft,
    );
  }, [draft, problem, noChip, limits, leans]);

  async function save() {
    setBusy(true); setError(null); setNote(null);
    const r = await saveMatchSettings(draft);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setSaved(r.settings);
    setText(Object.fromEntries(MATCH_SETTING_FIELDS.map((f) => [f.key, show(f, r.settings[f.key])])));
    setNote('Saved. It applies the next time a score is worked out.');
  }
  async function reset() {
    if (!window.confirm('Put every number back to its original value?')) return;
    setBusy(true); setError(null); setNote(null);
    const r = await resetMatchSettings();
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setSaved(r.settings);
    setText(Object.fromEntries(MATCH_SETTING_FIELDS.map((f) => [f.key, show(f, r.settings[f.key])])));
    setNote('Back to the original values.');
  }

  return (
    <div className="mt-wrap">
      <div className="mt-card">
        <h2>How a traveler&rsquo;s picks lower a place&rsquo;s score</h2>
        <p className="mt-muted" style={{ margin: '0 0 6px' }}>
          A place keeps its original score. The chips and answers a traveler picks can only keep it or lower it, never raise it. Each number below is how much of
          its score a place <b>keeps</b> when it completely misses something, so a lower number is harsher. A near miss loses a part of that. Nothing is
          counted against a place we have no data for.
        </p>
        <p className="mt-faint" style={{ margin: 0, fontSize: 12.5 }}>Not applied to the traveler app yet. These are the numbers it will use once chips and answers are wired in.</p>
      </div>

      <div className="mt-card">
        <div className="mt-grid">
          {MATCH_SETTING_FIELDS.map((f) => {
            const isChanged = draft[f.key] !== DEFAULT_MATCH_SETTINGS[f.key];
            return (
              <div className="mt-row" key={f.key}>
                <div className="mt-lab"><b>{f.label} {isChanged && <span className="mt-tag">changed</span>}</b><span>{f.help}</span></div>
                <div className="mt-in">
                  <input
                    aria-label={f.label}
                    className={isChanged ? 'changed' : ''}
                    inputMode="decimal"
                    value={text[f.key]}
                    onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value }))}
                  />
                  <span className="mt-muted">{f.percent ? '%' : f.key === 'chipFullMatchRating' ? 'of 10' : ''}</span>
                  {isChanged && <button className="ip-link-btn" style={{ border: 0, background: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }} onClick={() => setText((t) => ({ ...t, [f.key]: show(f, DEFAULT_MATCH_SETTINGS[f.key]) }))}>Original: {show(f, DEFAULT_MATCH_SETTINGS[f.key])}</button>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-toolbar">
          <button className="btn btn-primary" disabled={busy || !dirty || !!problem} onClick={save}>Save</button>
          <button className="btn" disabled={busy || !MATCH_SETTING_FIELDS.some((f) => saved[f.key] !== DEFAULT_MATCH_SETTINGS[f.key])} onClick={reset}>Reset all to original</button>
          {problem && <span className="mt-err">{problem}</span>}
          {error && <span className="mt-err">{error}</span>}
          {note && <span className="mt-faint">{note}</span>}
        </div>
      </div>

      <div className="mt-card">
        <h2>Try it</h2>
        <p className="mt-muted" style={{ margin: '0 0 6px' }}>What these numbers do to one place, using the values typed above (not yet saved).</p>
        <div className="mt-calc">
          <div>
            <label>Original score for the interest <b>{raw.toFixed(1)}</b></label>
            <input type="range" min={0} max={10} step={0.5} value={raw} onChange={(e) => setRaw(Number(e.target.value))} aria-label="Original score" style={{ width: '100%' }} />
            <label><input type="checkbox" checked={noChip} onChange={(e) => setNoChip(e.target.checked)} /> The traveler ticked one chip and the place has none of it</label>
            <label>Limit answers the place misses <b>{limits}</b></label>
            <input type="range" min={0} max={4} step={1} value={limits} onChange={(e) => setLimits(Number(e.target.value))} aria-label="Limit misses" style={{ width: '100%' }} />
            <label>Lean answers the place misses <b>{leans}</b></label>
            <input type="range" min={0} max={5} step={1} value={leans} onChange={(e) => setLeans(Number(e.target.value))} aria-label="Lean misses" style={{ width: '100%' }} />
          </div>
          <div className="mt-out">
            {preview ? (
              <>
                <div className="mt-muted">Original {raw.toFixed(1)}</div>
                <div className="mt-muted">For this traveler</div>
                <div className="mt-score">{(raw * preview.factor).toFixed(1)}</div>
                <div className="mt-muted">Keeps {Math.round(preview.factor * 100)}% of its score</div>
                <div className="mt-chips">{preview.reasons.map((r) => <span key={r.message} className="mt-chip">{r.message}</span>)}</div>
              </>
            ) : <span className="mt-err">Fix the numbers above to see this.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
