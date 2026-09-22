'use client';

import { useState } from 'react';
import { useFieldEdit } from './useFieldEdit';
import { SETTING_TAGS, MAX_SETTING_TAGS } from '@/lib/places/setting-tags';

/**
 * Grows a textarea to fit its content instead of clipping/scrolling it —
 * used as both the `ref` (sizes correctly the instant a panel opens with
 * existing text) and the `onChange` handler (keeps growing as the admin
 * types) on every free-text field in these panels, so "can I see the whole
 * blurb" is never a question.
 */
function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

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

/**
 * Place-type tags: an ORDERED multi-select (first = primary, marked ★), 1–4 tags
 * from the closed list in src/lib/places/setting-tags.ts. Unlike BandCell, order
 * matters, so each checked tag has a "make primary" button that moves it first.
 */
export function SettingTagsCell({ ctx, value, setLocal }: { ctx: FieldContext; value: string[]; setLocal: (v: string[]) => void }) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);
  const label = (slug: string) => SETTING_TAGS.find((t) => t.slug === slug)?.label ?? slug;

  function change(next: string[], desc: string) {
    if (next.length < 1 || next.length > MAX_SETTING_TAGS) return;
    commit({
      ...ctx,
      fieldLabel: `${ctx.fieldLabel} — ${desc}`,
      oldValue: value.map(label).join(', ') || '—',
      newValue: next.map(label).join(', '),
      setLocal: (val) => setLocal(val === next.map(label).join(', ') ? next : value),
      toPatchValue: () => next,
    });
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className={`cell-inner band-cell${value.length ? '' : ' empty-hint'}`} onClick={() => setOpen((o) => !o)}>
        {value.length === 0
          ? 'Click to set…'
          : value.map((k, i) => (
              <span className="band-chip" key={k} title={label(k)}>
                {i === 0 ? '★ ' : ''}{label(k)}
              </span>
            ))}
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 69 }} onClick={() => setOpen(false)} />
          <div className="band-popover" style={{ top: '100%', left: 0 }}>
            {SETTING_TAGS.map((t) => {
              const on = value.includes(t.slug);
              return (
                <label className="band-opt" key={t.slug}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={(on && value.length === 1) || (!on && value.length >= MAX_SETTING_TAGS)}
                    onChange={() => change(on ? value.filter((k) => k !== t.slug) : [...value, t.slug], `${on ? 'removed' : 'added'} ${t.label}`)}
                  />
                  {t.emoji} {t.label}
                  {on && value[0] !== t.slug && (
                    <button type="button" style={{ marginLeft: 'auto', fontSize: 10.5, border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                      onClick={(e) => { e.preventDefault(); change([t.slug, ...value.filter((k) => k !== t.slug)], `${t.label} made primary`); }}>
                      make primary
                    </button>
                  )}
                  {on && value[0] === t.slug && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-faint)' }}>primary</span>}
                </label>
              );
            })}
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
                <textarea
                  ref={autoResize}
                  className="field-textarea"
                  rows={9}
                  style={{ minHeight: 160 }}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    autoResize(e.target);
                  }}
                />
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
                    <textarea
                      ref={autoResize}
                      className="field-textarea month-input-textarea"
                      rows={1}
                      title={m}
                      placeholder="Not yet authored"
                      value={draft[i] ?? ''}
                      onChange={(e) => {
                        const next = [...draft];
                        next[i] = e.target.value;
                        setDraft(next);
                        autoResize(e.target);
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

/**
 * Same grid-with-month-names panel as MonthlyWeatherCell, adapted for a
 * per-slider sliderMonthlyWeather entry (one slice of a whole-object jsonb
 * column keyed by slider, so it needs toPatchValue's read-modify-write
 * pattern the same way SourcesPanelCell does, unlike the plain top-level
 * monthlyWeather column MonthlyWeatherCell edits).
 *
 * Unlike MonthlyWeatherCell's flat 12-row list, months here collapse into
 * one shared block wherever their text is byte-identical — a lot of real
 * content reuses one blurb across a whole season, and 12 separate boxes
 * make that impossible to see at a glance or edit without drifting out of
 * sync. A ring + legend surface which months share text (including
 * non-contiguous reuse, e.g. a "baseline" blurb covering Oct plus Dec–Mar
 * separately), each block's ⋯ menu can split a month back out or merge it
 * into any other block, and a word-overlap heuristic flags near-duplicate
 * blocks that are probably meant to be the same blurb but drifted in
 * wording — all of this is view-only bookkeeping over the same flat
 * (string | null)[12] the old list edited; Apply's commit is unchanged.
 */
const CAT_KEYS = ['1', '2', '3', '4'] as const;

interface WeatherGroup {
  months: number[];
  text: string | null;
  colorKey: (typeof CAT_KEYS)[number] | null;
}

function buildWeatherGroups(draft: (string | null)[], forcedSplit: Set<number>): WeatherGroup[] {
  const keyOf = (i: number) => {
    const t = draft[i];
    if (!t?.trim()) return `__empty_${i}`; // never coalesce blanks — they're not "the same text", just unwritten
    if (forcedSplit.has(i)) return `__split_${i}`;
    return t;
  };
  const indexOf = new Map<string, number>();
  const groups: WeatherGroup[] = [];
  for (let i = 0; i < 12; i++) {
    const key = keyOf(i);
    let gi = indexOf.get(key);
    if (gi === undefined) {
      gi = groups.length;
      indexOf.set(key, gi);
      groups.push({ months: [], text: draft[i]?.trim() ? draft[i]!.trim() : null, colorKey: null });
    }
    groups[gi].months.push(i);
  }
  // Only real reuse (2+ months, real text) earns a categorical color — a
  // singleton is just a month that doesn't (yet) share text with anything,
  // and cycling the palette onto it would fake a pattern that isn't there.
  let cursor = 0;
  groups.forEach((g) => {
    g.colorKey = g.text && g.months.length > 1 ? CAT_KEYS[cursor++ % CAT_KEYS.length] : null;
  });
  return groups;
}

/** Contiguous calendar runs within a set of month indices, wrapping across the year boundary (so Oct-Mar reads as one run, not two). */
function monthRanges(months: number[]): number[][] {
  const set = new Set(months);
  const runs: number[][] = [];
  const visited = new Set<number>();
  for (let i = 0; i < 12; i++) {
    if (!set.has(i) || visited.has(i)) continue;
    let start = i;
    if (set.size < 12) {
      while (set.has((start - 1 + 12) % 12) && (start - 1 + 12) % 12 !== i) {
        start = (start - 1 + 12) % 12;
        if (start === i) break;
      }
    }
    let end = start;
    const run = [start];
    visited.add(start);
    while (set.has((end + 1) % 12) && !visited.has((end + 1) % 12)) {
      end = (end + 1) % 12;
      run.push(end);
      visited.add(end);
    }
    runs.push(run);
  }
  return runs;
}

function monthRangeLabel(run: number[]): string {
  if (run.length === 12) return 'Jan – Dec';
  if (run.length === 1) return MONTH_NAMES[run[0]].slice(0, 3);
  return `${MONTH_NAMES[run[0]].slice(0, 3)} – ${MONTH_NAMES[run[run.length - 1]].slice(0, 3)}`;
}

const BLURB_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'is', 'are', 'with', 'that', 'this',
  'it', 'its', "it's", 'for', 'as', 'by', 'from', 'into', 'still', 'just', 'ahead', 'begin', 'begins',
]);
function blurbWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,—–'’"()°-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !BLURB_STOPWORDS.has(w));
}
/** Jaccard similarity over significant words — good enough to flag "probably the same claim, reworded" without a real NLP dependency. */
function blurbSimilarity(a: string, b: string): number {
  const wa = new Set(blurbWords(a));
  const wb = new Set(blurbWords(b));
  let shared = 0;
  wa.forEach((w) => { if (wb.has(w)) shared++; });
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : shared / union;
}
const BLURB_SUGGEST_THRESHOLD = 0.4;

export function SliderMonthlyWeatherCell({
  ctx,
  value,
  setLocal,
  toPatchValue,
  renderTrigger,
}: {
  ctx: FieldContext;
  value: (string | null)[];
  setLocal: (v: (string | null)[]) => void;
  toPatchValue: (v: (string | null)[]) => unknown;
  /** Override the default "N of 12 months" pill — e.g. Place Profile makes
   * the whole interest-name row header the click target instead. Receives
   * the same onClick the default trigger uses, so the panel still opens
   * correctly with the current draft. */
  renderTrigger?: (opts: { filledCount: number; onClick: () => void }) => React.ReactNode;
}) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);
  const weather = value.length ? value : new Array(12).fill(null);
  const [draft, setDraft] = useState<(string | null)[]>(weather);
  const [forcedSplit, setForcedSplit] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [menu, setMenu] = useState<{ anchorMonth: number; top: number; right: number } | null>(null);
  const filledCount = weather.filter(Boolean).length;
  const openPanel = () => {
    setDraft(value.length ? value : new Array(12).fill(null));
    setForcedSplit(new Set());
    setDismissed(new Set());
    setMenu(null);
    setOpen(true);
  };

  function setMonths(months: number[], text: string | null) {
    setDraft((prev) => {
      const next = [...prev];
      months.forEach((m) => { next[m] = text; });
      return next;
    });
  }
  function clearForcedSplit(months: number[]) {
    setForcedSplit((prev) => {
      const next = new Set(prev);
      months.forEach((m) => next.delete(m));
      return next;
    });
  }

  const groups = open ? buildWeatherGroups(draft, forcedSplit) : [];
  const draftFilledCount = draft.filter((d) => d?.trim()).length;
  const authoredGroups = groups.filter((g) => g.text !== null);
  const reusedGroups = authoredGroups.filter((g) => g.months.length > 1);

  function suggestionFor(g: WeatherGroup): { target: WeatherGroup; score: number } | null {
    if (!g.text || dismissed.has(g.months[0])) return null;
    let best: { target: WeatherGroup; score: number } | null = null;
    for (const other of authoredGroups) {
      if (other === g) continue;
      const score = blurbSimilarity(g.text, other.text!);
      if (score >= BLURB_SUGGEST_THRESHOLD && (!best || score > best.score)) best = { target: other, score };
    }
    return best;
  }

  const activeMenuGroup = menu ? groups.find((g) => g.months[0] === menu.anchorMonth) ?? null : null;

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ filledCount, onClick: openPanel })
      ) : (
        <div className={`cell-inner text-cell${filledCount ? '' : ' empty'}`} onClick={openPanel}>
          {filledCount ? `${filledCount} of 12 months` : 'Click to add…'}
        </div>
      )}
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>{ctx.fieldLabel}</h2>
                <p>{ctx.entityLabel} — one blurb per month, explaining that month&apos;s score</p>
              </div>
              <button className="panel-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            {draftFilledCount > 0 && (
              <div className="mw-overview">
                <svg width="104" height="104" viewBox="0 0 104 104">
                  {Array.from({ length: 12 }, (_, i) => {
                    const g = groups.find((gr) => gr.months.includes(i))!;
                    const fill = g.colorKey ? `var(--cat-${g.colorKey})` : g.text ? 'var(--border-strong)' : 'var(--border)';
                    const cx = 52, cy = 52, rOuter = 46, rInner = 29;
                    const a0 = ((i * 30 - 90) * Math.PI) / 180;
                    const a1 = (((i + 1) * 30 - 90) * Math.PI) / 180;
                    const x0o = cx + rOuter * Math.cos(a0), y0o = cy + rOuter * Math.sin(a0);
                    const x1o = cx + rOuter * Math.cos(a1), y1o = cy + rOuter * Math.sin(a1);
                    const x0i = cx + rInner * Math.cos(a0), y0i = cy + rInner * Math.sin(a0);
                    const x1i = cx + rInner * Math.cos(a1), y1i = cy + rInner * Math.sin(a1);
                    const d = `M ${x0i} ${y0i} L ${x0o} ${y0o} A ${rOuter} ${rOuter} 0 0 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 0 0 ${x0i} ${y0i} Z`;
                    return <path key={i} d={d} fill={fill} stroke="var(--bg-sunken)" strokeWidth={2} />;
                  })}
                  {Array.from({ length: 12 }, (_, i) => {
                    const cx = 52, cy = 52, rLabel = 56;
                    const amid = (((i + 0.5) * 30 - 90) * Math.PI) / 180;
                    return (
                      <text
                        key={i}
                        x={cx + rLabel * Math.cos(amid)}
                        y={cy + rLabel * Math.sin(amid)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontFamily="var(--font-plex-mono, monospace)"
                        fontSize={7.5}
                        fill="var(--text-faint)"
                      >
                        {MONTHS_SHORT[i]}
                      </text>
                    );
                  })}
                </svg>
                <div className="mw-legend">
                  <div className="mw-legend-title">
                    <b>{authoredGroups.length}</b> distinct blurb{authoredGroups.length === 1 ? '' : 's'} across {draftFilledCount} authored month{draftFilledCount === 1 ? '' : 's'}
                    {reusedGroups.length > 0 && (
                      <>
                        {' '}
                        — <b>{reusedGroups.length}</b> reused
                      </>
                    )}
                    {draftFilledCount < 12 && <> · {12 - draftFilledCount} not yet authored</>}
                  </div>
                  {reusedGroups.length > 0 ? (
                    reusedGroups.map((g) => (
                      <div className="mw-legend-row" key={g.months.join(',')}>
                        <span className="mw-swatch" style={{ background: `var(--cat-${g.colorKey})` }} />
                        <span className="mw-range">{monthRanges(g.months).map(monthRangeLabel).join(', ')}</span>
                        <span className="mw-legend-count">{g.months.length} mo</span>
                      </div>
                    ))
                  ) : (
                    <div className="mw-legend-empty">Every authored month stands on its own — nothing to merge.</div>
                  )}
                </div>
              </div>
            )}

            <div className="panel-body mw-groups">
              {groups.map((g) => {
                const anchor = g.months[0];
                const suggestion = suggestionFor(g);
                const groupStyle = {
                  '--mw-group-color': g.colorKey ? `var(--cat-${g.colorKey})` : g.text ? 'var(--border-strong)' : 'var(--border)',
                  '--mw-group-soft': g.colorKey ? `var(--cat-${g.colorKey}-soft)` : 'var(--bg-sunken)',
                } as React.CSSProperties;
                return (
                  <div className="mw-group" key={g.months.join(',')} style={groupStyle}>
                    <div className="mw-group-head">
                      <span className="mw-swatch" style={{ background: 'var(--mw-group-color)' }} />
                      <span className="mw-range">{monthRanges(g.months).map(monthRangeLabel).join(', ')}</span>
                      <span className="mw-count">{g.months.length}mo</span>
                      <button
                        type="button"
                        className="mw-menu-btn"
                        style={{ marginLeft: 'auto' }}
                        aria-label="More options for this month"
                        onClick={(e) => {
                          if (menu?.anchorMonth === anchor) {
                            setMenu(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenu({ anchorMonth: anchor, top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                    <div className="mw-group-body">
                      <textarea
                        ref={autoResize}
                        className="field-textarea month-input-textarea"
                        rows={1}
                        placeholder="Not yet authored"
                        title={g.months.map((m) => MONTH_NAMES[m]).join(', ')}
                        value={g.text ?? ''}
                        onChange={(e) => {
                          setMonths(g.months, e.target.value);
                          autoResize(e.target);
                        }}
                      />
                      {g.months.length > 1 && (
                        <div className="field-hint">
                          Shared by <b>{g.months.length} months</b> — editing this updates all of them.
                        </div>
                      )}
                      {suggestion && (
                        <div className="mw-suggest">
                          <span className="mw-suggest-label">
                            Reads a lot like <b>{monthRanges(suggestion.target.months).map(monthRangeLabel).join(', ')}</b>
                          </span>
                          <button
                            type="button"
                            className="mw-suggest-merge"
                            onClick={() => {
                              setMonths(g.months, suggestion.target.text);
                              clearForcedSplit(g.months);
                            }}
                          >
                            Merge
                          </button>
                          <button type="button" className="mw-suggest-dismiss" aria-label="Dismiss suggestion" onClick={() => setDismissed((prev) => new Set(prev).add(anchor))}>
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="field-hint">Editing a shared block updates every month in it. The ⋯ menu splits a month out or merges it into another.</div>
            </div>

            {activeMenuGroup && menu && (
              <>
                <div className="mw-menu-scrim" onClick={() => setMenu(null)} />
                <div className="mw-menu" style={{ top: menu.top, right: menu.right }}>
                  {activeMenuGroup.months.length > 1 && (
                    <>
                      <div className="mw-menu-label">Split out</div>
                      <div className="mw-menu-hint">Pull one month out to write its own text</div>
                      {activeMenuGroup.months.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="mw-menu-opt"
                          onClick={() => {
                            setForcedSplit((prev) => new Set(prev).add(m));
                            setMenu(null);
                          }}
                        >
                          {MONTH_NAMES[m]} only
                        </button>
                      ))}
                      <div className="mw-menu-divider" />
                    </>
                  )}
                  <div className="mw-menu-label">Merge into…</div>
                  {groups.filter((g) => g !== activeMenuGroup && g.text !== null).length === 0 && (
                    <div className="mw-menu-hint">No other authored month to merge into yet.</div>
                  )}
                  {groups
                    .filter((g) => g !== activeMenuGroup && g.text !== null)
                    .map((g) => (
                      <button
                        key={g.months.join(',')}
                        type="button"
                        className="mw-merge-opt"
                        onClick={() => {
                          const targetGroup = activeMenuGroup;
                          setMonths(targetGroup.months, g.text);
                          clearForcedSplit(targetGroup.months);
                          setMenu(null);
                        }}
                      >
                        <span className="mo-range">{monthRanges(g.months).map(monthRangeLabel).join(',')}</span>
                        <span className="mo-snippet">{g.text}</span>
                      </button>
                    ))}
                </div>
              </>
            )}

            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button className="btn" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const cleaned = draft.map((d) => (d && d.trim() ? d.trim() : null));
                  const newValue = cleaned.some(Boolean) ? cleaned : [];
                  commit({
                    ...ctx,
                    oldValue: value,
                    newValue,
                    setLocal,
                    toLabel: (v) => (v.filter(Boolean).length ? `${v.filter(Boolean).length} of 12 months` : '(empty)'),
                    toPatchValue,
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

export interface SliderSource {
  url: string;
  label?: string;
  note?: string;
  addedAt: string; // ISO date, "YYYY-MM-DD"
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Structured editor for one slider's sliderSources entry — which external
 * page(s) were consulted to research or verify THIS slider's content/score
 * for THIS destination. An array on purpose, same reasoning as
 * AdvisoryPanelCell just above: a real research pass often draws on more
 * than one source, and a later pass can add a corroborating or superseding
 * one without discarding the first. Deliberately real form fields (URL,
 * optional label, optional note, a date) rather than JsonPanelCell's raw
 * textarea — this is a citation record, worth the same validated-input
 * treatment advisories get.
 */
export function SourcesPanelCell({
  ctx,
  value,
  setLocal,
  toPatchValue,
}: {
  ctx: FieldContext;
  value: SliderSource[];
  setLocal: (v: SliderSource[]) => void;
  /** Override when the DB column shape differs from the edited array (sliderSources is keyed by slider, so this cell only edits one slider's slice of the whole-object column). Defaults to identity. */
  toPatchValue?: (v: SliderSource[]) => unknown;
}) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SliderSource[]>(value);

  function openPanel() {
    setDraft(value.map((s) => ({ ...s })));
    setOpen(true);
  }

  function updateEntry(idx: number, patch: Partial<SliderSource>) {
    setDraft((d) => d.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeEntry(idx: number) {
    setDraft((d) => d.filter((_, i) => i !== idx));
  }

  function addEntry() {
    setDraft((d) => [...d, { url: '', label: '', note: '', addedAt: todayISO() }]);
  }

  return (
    <>
      <div className={`cell-inner wrap source-cell${value.length ? '' : ' empty-hint'}`} onClick={openPanel}>
        {value.length === 0
          ? 'Click to add…'
          : value.map((s, i) => (
              <span className="source-chip" key={i} title={s.url}>
                🔗 {s.label || hostnameOf(s.url)}
              </span>
            ))}
      </div>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>🔗 Sources</h2>
                <p>{ctx.entityLabel} — {ctx.fieldLabel}</p>
              </div>
              <button className="panel-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="panel-body">
              {draft.length === 0 && <div className="panel-note">No sources on file for this interest yet.</div>}
              {draft.map((s, idx) => (
                <div className="adv-entry" key={idx}>
                  <button className="btn-ghost-bad remove-entry" title="Remove this source" onClick={() => removeEntry(idx)}>
                    ✕
                  </button>
                  <div className="field-group" style={{ marginBottom: 10 }}>
                    <label className="mini-label">URL</label>
                    <input
                      className="field-input"
                      type="url"
                      placeholder="https://…"
                      value={s.url}
                      onChange={(e) => updateEntry(idx, { url: e.target.value })}
                    />
                  </div>
                  <div className="adv-entry-top">
                    <div style={{ flex: 1 }}>
                      <label className="mini-label">Label (optional)</label>
                      <input
                        className="field-input"
                        placeholder="e.g. site name"
                        value={s.label ?? ''}
                        onChange={(e) => updateEntry(idx, { label: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="mini-label">Verified on</label>
                      <input
                        className="field-input"
                        type="date"
                        style={{ maxWidth: 170 }}
                        value={s.addedAt}
                        onChange={(e) => updateEntry(idx, { addedAt: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="mini-label">Note (optional)</label>
                    <textarea
                      className="field-textarea"
                      rows={2}
                      placeholder="What this source confirmed or was used for"
                      value={s.note ?? ''}
                      onChange={(e) => updateEntry(idx, { note: e.target.value })}
                    />
                  </div>
                </div>
              ))}
              <button className="add-advisory-btn" onClick={addEntry}>
                + Add source
              </button>
              <div className="panel-note">
                Not shown on the public site and never read by the scoring engine — a research record for this interest at
                this destination, so a later pass (by a person or an AI session) can see what was already checked instead
                of re-deriving it, and someone reviewing content can click through to what backs it.
              </div>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button className="btn" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const cleaned = draft
                    .filter((s) => s.url.trim().length > 0)
                    .map((s) => ({
                      url: s.url.trim(),
                      ...(s.label?.trim() ? { label: s.label.trim() } : {}),
                      ...(s.note?.trim() ? { note: s.note.trim() } : {}),
                      addedAt: s.addedAt || todayISO(),
                    }));
                  commit({
                    ...ctx,
                    oldValue: value,
                    newValue: cleaned,
                    setLocal,
                    toLabel: (v) => (v.length ? `${v.length} source${v.length === 1 ? '' : 's'}` : '(none)'),
                    toPatchValue,
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

export interface TravelAdvisory {
  category: 'security' | 'environmental' | 'access' | 'health' | 'other';
  severity: 'moderate' | 'serious';
  text: string;
  lastReviewed: string; // ISO date, "YYYY-MM-DD"
}

const ADVISORY_CATEGORY_LABEL: Record<TravelAdvisory['category'], string> = {
  security: 'Security',
  environmental: 'Environmental',
  access: 'Access',
  health: 'Health',
  other: 'Other',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isStaleAdvisory(lastReviewed: string): boolean {
  const months = (Date.now() - new Date(`${lastReviewed}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return months > 6;
}

/**
 * Structured editor for a destination's travelAdvisories array — deliberately
 * real form fields (category select, severity toggle, free text, a
 * last-reviewed date) rather than JsonPanelCell's raw textarea, since this
 * field is safety-relevant enough to want validated input, not hand-typed
 * JSON. Commits the whole array in one edit, same shape as JsonPanelCell.
 */
export function AdvisoryPanelCell({
  ctx,
  value,
  setLocal,
}: {
  ctx: FieldContext;
  value: TravelAdvisory[];
  setLocal: (v: TravelAdvisory[]) => void;
}) {
  const commit = useFieldEdit();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TravelAdvisory[]>(value);

  function openPanel() {
    setDraft(value.map((a) => ({ ...a })));
    setOpen(true);
  }

  function updateEntry(idx: number, patch: Partial<TravelAdvisory>) {
    setDraft((d) => d.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function removeEntry(idx: number) {
    setDraft((d) => d.filter((_, i) => i !== idx));
  }

  function addEntry() {
    setDraft((d) => [...d, { category: 'security', severity: 'moderate', text: '', lastReviewed: todayISO() }]);
  }

  return (
    <>
      <div className={`cell-inner wrap advisory-cell${value.length ? '' : ' empty-hint'}`} onClick={openPanel}>
        {value.length === 0
          ? 'Click to add…'
          : value.map((a, i) => (
              <span className={`adv-chip adv-chip-${a.category}`} key={i}>
                {isStaleAdvisory(a.lastReviewed) && <span className="stale-dot" title="Last reviewed over 6 months ago" />}
                {ADVISORY_CATEGORY_LABEL[a.category]} · {a.severity}
              </span>
            ))}
      </div>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>⚠️ Advisories</h2>
                <p>{ctx.entityLabel}</p>
              </div>
              <button className="panel-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="panel-body">
              {draft.length === 0 && <div className="panel-note">No advisories on file for this destination.</div>}
              {draft.map((a, idx) => (
                <div className="adv-entry" key={idx}>
                  <button className="btn-ghost-bad remove-entry" title="Remove this advisory" onClick={() => removeEntry(idx)}>
                    ✕
                  </button>
                  <div className="adv-entry-top">
                    <div style={{ flex: 1 }}>
                      <label className="mini-label">Category</label>
                      <select
                        className="field-select"
                        value={a.category}
                        onChange={(e) => updateEntry(idx, { category: e.target.value as TravelAdvisory['category'] })}
                      >
                        {Object.entries(ADVISORY_CATEGORY_LABEL).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="mini-label">Severity</label>
                      <div className="sev-toggle">
                        <button
                          type="button"
                          className={`sev-btn sev-moderate${a.severity === 'moderate' ? ' on' : ''}`}
                          onClick={() => updateEntry(idx, { severity: 'moderate' })}
                        >
                          Moderate
                        </button>
                        <button
                          type="button"
                          className={`sev-btn sev-serious${a.severity === 'serious' ? ' on' : ''}`}
                          onClick={() => updateEntry(idx, { severity: 'serious' })}
                        >
                          Serious
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="field-group" style={{ marginBottom: 10 }}>
                    <label className="mini-label">Advisory text</label>
                    <textarea
                      className="field-textarea"
                      rows={4}
                      value={a.text}
                      onChange={(e) => updateEntry(idx, { text: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="mini-label">Last reviewed</label>
                    <input
                      className="field-input"
                      type="date"
                      style={{ maxWidth: 170 }}
                      value={a.lastReviewed}
                      onChange={(e) => updateEntry(idx, { lastReviewed: e.target.value })}
                    />
                  </div>
                </div>
              ))}
              <button className="add-advisory-btn" onClick={addEntry}>
                + Add advisory
              </button>
              <div className="panel-note">
                Shown as a banner on the destination page regardless of which interest is selected — independent of every
                slider&apos;s content and score, and never read by the scoring engine.
              </div>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button className="btn" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const cleaned = draft.filter((a) => a.text.trim().length > 0).map((a) => ({ ...a, text: a.text.trim() }));
                  commit({
                    ...ctx,
                    oldValue: value,
                    newValue: cleaned,
                    setLocal,
                    toLabel: (v) => (v.length ? `${v.length} advisor${v.length === 1 ? 'y' : 'ies'}` : '(none)'),
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
