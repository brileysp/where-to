'use client';

import { useState } from 'react';
import { useFieldEdit } from './useFieldEdit';

interface FieldContext {
  entityType: string;
  entityId: string;
  entityLabel: string;
  field: string;
  fieldLabel: string;
  loadedUpdatedAt: string;
}

/** A plain text input, edited in place, committed on blur. */
export function InlineTextCell({
  ctx,
  value,
  setLocal,
  width,
  align,
  maxLength,
  placeholder,
}: { ctx: FieldContext; value: string; setLocal: (v: string) => void; width?: number; align?: 'left' | 'center'; maxLength?: number; placeholder?: string }) {
  const commit = useFieldEdit();
  const [draft, setDraft] = useState(value);
  return (
    <div className="cell-inner">
      <input
        className="cost-input"
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        style={{ width, textAlign: align }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (!trimmed) {
            setDraft(value);
            return;
          }
          commit({
            ...ctx,
            oldValue: value,
            newValue: trimmed,
            setLocal: (v) => {
              setDraft(v);
              setLocal(v);
            },
          });
        }}
      />
    </div>
  );
}

/** A <select> bound to a fixed option list, nullable via a leading "—" option. */
export function InlineSelectCell({
  ctx,
  value,
  options,
  setLocal,
  nullable = true,
  toPatchValue,
}: {
  ctx: FieldContext;
  value: string | null;
  options: string[];
  setLocal: (v: string | null) => void;
  nullable?: boolean;
  /** Override when the DB column shape differs from the edited string (e.g. a single-value tier stored as a 0-or-1-element array). Defaults to identity. */
  toPatchValue?: (v: string | null) => unknown;
}) {
  const commit = useFieldEdit();
  return (
    <div className="cell-inner">
      <select
        className="cell-select"
        value={value ?? ''}
        onChange={(e) => {
          const newValue = e.target.value === '' ? null : e.target.value;
          commit({ ...ctx, oldValue: value, newValue, setLocal, toLabel: (v) => v ?? '—', toPatchValue });
        }}
      >
        {nullable && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

const SEVERITY_BADGE_CLASS: Record<string, string> = { mild: 'badge-mild', moderate: 'badge-moderate', severe: 'badge-severe' };

/** Same as InlineSelectCell, but displays the current value as a colored badge instead of the raw <select>, matching the mockup's Hot/Cold/Wet columns. */
export function SeverityCell(props: { ctx: FieldContext; value: string | null; setLocal: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div onBlur={() => setEditing(false)}>
        <InlineSelectCell {...props} options={['mild', 'moderate', 'severe']} />
      </div>
    );
  }
  return (
    <div className="cell-inner" style={{ cursor: 'pointer' }} onClick={() => setEditing(true)}>
      {props.value ? <span className={`badge ${SEVERITY_BADGE_CLASS[props.value]}`}>{props.value}</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
    </div>
  );
}

export interface BandOption {
  key: string;
  label: string;
  short: string;
}

/** Multi-select chip cell with a checkbox popover, matching the mockup's Social Vibe / Physical Demands columns. */
export function BandCell({ ctx, value, options, setLocal }: { ctx: FieldContext; value: string[]; options: BandOption[]; setLocal: (v: string[]) => void }) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);

  function toggle(key: string) {
    const next = value.includes(key) ? value.filter((k) => k !== key) : [...value, key];
    const optionLabel = options.find((o) => o.key === key)?.label ?? key;
    commit({
      ...ctx,
      fieldLabel: `${ctx.fieldLabel} — ${optionLabel}`,
      oldValue: value.includes(key) ? 'included' : 'not included',
      newValue: value.includes(key) ? 'not included' : 'included',
      setLocal: () => setLocal(next),
      toPatchValue: () => next,
    });
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        className={`cell-inner band-cell${value.length ? '' : ' empty-hint'}`}
        onClick={() => setOpen((o) => !o)}
      >
        {value.length === 0
          ? 'Click to set…'
          : value.map((k) => {
              const opt = options.find((o) => o.key === k);
              return (
                <span className="band-chip" key={k} title={opt?.label}>
                  {opt?.short ?? k}
                </span>
              );
            })}
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 69 }} onClick={() => setOpen(false)} />
          <div className="band-popover" style={{ top: '100%', left: 0 }}>
            {options.map((o) => (
              <label className="band-opt" key={o.key}>
                <input type="checkbox" checked={value.includes(o.key)} onChange={() => toggle(o.key)} />
                {o.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** A plain boolean toggle, committed immediately on change. */
export function CheckboxCell({
  ctx,
  value,
  setLocal,
  label,
}: { ctx: FieldContext; value: boolean; setLocal: (v: boolean) => void; label?: string }) {
  const commit = useFieldEdit();
  return (
    <div className="cell-inner">
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => {
            const newValue = e.target.checked;
            commit({ ...ctx, oldValue: value, newValue, setLocal, toLabel: (v) => (v ? 'yes' : 'no') });
          }}
        />
        {label}
      </label>
    </div>
  );
}

/**
 * Click-to-expand JSON cell — same panel chrome as TextFieldPanelCell, but
 * the edited value is a parsed object/array rather than a string. A parse
 * failure on Apply shows an inline error and keeps the panel open, instead
 * of silently discarding the edit or (worse) queuing invalid JSON — the
 * same guarantee DestinationScoringForm's buildPayloadOrThrow used to give
 * before this cell replaced it.
 */
export function JsonPanelCell<T>({
  ctx,
  value,
  setLocal,
  hint,
  emptyValue,
  summarize,
  toPatchValue,
}: {
  ctx: FieldContext;
  value: T;
  setLocal: (v: T) => void;
  hint: string;
  /** What an empty/blank textarea parses to on Apply. */
  emptyValue: T;
  /** Short cell-display summary, e.g. "3 keys" or "2 events" — empty string reads as "Click to add…". */
  summarize: (v: T) => string;
  /** Override when the DB column shape differs from the edited value (e.g. this cell edits one slider's slice of a whole-object column keyed by every slider). Defaults to identity. */
  toPatchValue?: (v: T) => unknown;
}) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const display = summarize(value);

  return (
    <>
      <div
        className={`cell-inner text-cell${display ? '' : ' empty'}`}
        onClick={() => {
          setDraft(JSON.stringify(value, null, 2));
          setError(null);
          setOpen(true);
        }}
      >
        {display || 'Click to add…'}
      </div>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>{ctx.fieldLabel}</h2>
                <p>{ctx.entityLabel}</p>
              </div>
              <button className="panel-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="panel-body">
              <div className="field-group">
                <label>{ctx.fieldLabel} (JSON)</label>
                <textarea
                  className="field-textarea"
                  rows={12}
                  style={{ fontFamily: 'var(--font-plex-mono, monospace)' }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="field-hint">{hint}</div>
                {error && (
                  <div className="field-hint" style={{ color: 'var(--bad)' }}>
                    {error}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button className="btn" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const trimmed = draft.trim();
                  let parsed: T;
                  try {
                    parsed = trimmed ? JSON.parse(trimmed) : emptyValue;
                  } catch {
                    setError('Not valid JSON.');
                    return;
                  }
                  commit({ ...ctx, oldValue: value, newValue: parsed, setLocal, toLabel: (v) => summarize(v) || '(empty)', toPatchValue });
                  setOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Click-to-expand text cell that opens a side panel with a single textarea, matching the mockup's About / Seasons overview / Cost overview columns. */
export function TextFieldPanelCell({
  ctx,
  value,
  setLocal,
  hint,
  truncateAt = 40,
  toPatchValue,
}: {
  ctx: FieldContext;
  value: string | null;
  setLocal: (v: string | null) => void;
  hint: string;
  truncateAt?: number;
  /** Override when the DB column shape differs from the edited string (e.g. a comma-separated list stored as a text[]). Defaults to identity. */
  toPatchValue?: (v: string | null) => unknown;
}) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const display = value ? (value.length > truncateAt ? value.slice(0, truncateAt) + '…' : value) : 'Click to add…';

  return (
    <>
      <div
        className={`cell-inner text-cell${value ? '' : ' empty'}`}
        onClick={() => {
          setDraft(value ?? '');
          setOpen(true);
        }}
      >
        {display}
      </div>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>{ctx.fieldLabel}</h2>
                <p>{ctx.entityLabel}</p>
              </div>
              <button className="panel-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="panel-body">
              <div className="field-group">
                <label>{ctx.fieldLabel}</label>
                <textarea className="field-textarea" rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <div className="field-hint">{hint}</div>
              </div>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button className="btn" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const newValue = draft.trim() || null;
                  commit({ ...ctx, oldValue: value, newValue, setLocal, toLabel: (v) => v ?? '(empty)', toPatchValue });
                  setOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** The "Seasons detail" panel — one weather blurb per month. */
export function MonthlyWeatherCell({
  ctx,
  value,
  setLocal,
}: { ctx: FieldContext; value: (string | null)[] | null; setLocal: (v: (string | null)[] | null) => void }) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);
  const weather = value ?? new Array(12).fill(null);
  const [draft, setDraft] = useState<(string | null)[]>(weather);
  const filledCount = weather.filter(Boolean).length;

  return (
    <>
      <div
        className={`cell-inner text-cell${filledCount ? '' : ' empty'}`}
        onClick={() => {
          setDraft(value ?? new Array(12).fill(null));
          setOpen(true);
        }}
      >
        {filledCount ? `${filledCount} of 12 months` : 'Click to add…'}
      </div>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>🌤️ Seasons detail</h2>
                <p>{ctx.entityLabel} — one short blurb per month</p>
              </div>
              <button className="panel-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="panel-body">
              <div className="field-group">
                <label>Monthly weather blurb</label>
                {MONTH_NAMES.map((m, i) => (
                  <div className="month-input-row" key={m}>
                    <span className="month-input-tag">{MONTHS_SHORT[i]}</span>
                    <input
                      className="field-input"
                      title={m}
                      placeholder="Not yet authored"
                      value={draft[i] ?? ''}
                      onChange={(e) => {
                        const next = [...draft];
                        next[i] = e.target.value;
                        setDraft(next);
                      }}
                    />
                  </div>
                ))}
                <div className="field-hint">Months left blank just don&apos;t show a blurb — no need to author all 12 before saving.</div>
              </div>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button className="btn" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const cleaned = draft.map((d) => (d && d.trim() ? d.trim() : null));
                  const newValue = cleaned.some(Boolean) ? cleaned : null;
                  commit({
                    ...ctx,
                    oldValue: value,
                    newValue,
                    setLocal,
                    toLabel: (v) => (v ? `${v.filter(Boolean).length} of 12 months` : '(empty)'),
                  });
                  setOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Multi-select chip cell for a set of months (1-12) — same chip+popover interaction as BandCell, but a fixed Jan-Dec option set and a number[] value instead of string[]. */
export function MonthMultiSelectCell({ ctx, value, setLocal }: { ctx: FieldContext; value: number[]; setLocal: (v: number[]) => void }) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);

  function toggle(m: number) {
    const next = value.includes(m) ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b);
    commit({
      ...ctx,
      fieldLabel: `${ctx.fieldLabel} — ${MONTH_NAMES[m - 1]}`,
      oldValue: value.includes(m) ? 'included' : 'not included',
      newValue: value.includes(m) ? 'not included' : 'included',
      setLocal: () => setLocal(next),
      toPatchValue: () => next,
    });
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className={`cell-inner band-cell${value.length ? '' : ' empty-hint'}`} onClick={() => setOpen((o) => !o)}>
        {value.length === 0
          ? 'Click to set…'
          : value.map((m) => (
              <span className="band-chip" key={m} title={MONTH_NAMES[m - 1]}>
                {MONTHS_SHORT[m - 1]}
              </span>
            ))}
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 69 }} onClick={() => setOpen(false)} />
          <div className="band-popover" style={{ top: '100%', left: 0 }}>
            {MONTH_NAMES.map((name, idx) => (
              <label className="band-opt" key={name}>
                <input type="checkbox" checked={value.includes(idx + 1)} onChange={() => toggle(idx + 1)} />
                {name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
