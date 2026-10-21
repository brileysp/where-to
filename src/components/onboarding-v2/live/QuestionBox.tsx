'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OnboardingChip } from '@/lib/db/queries/onboarding-chips';
import { interestsInGroup, pickerGroups } from '@/lib/onboarding/interests';
import type { LiveItem } from '@/lib/onboarding/live-questions';
import type { MatchSetups } from '@/lib/onboarding/live-types';
import type { Levels } from '@/lib/onboarding/levels';
import type { InterestAnswers } from '@/lib/onboarding/profile';
import type { LiveFlow } from './useLiveFlow';

const LOCK = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);
export const OPEN_LOCK = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5 7V5a3 3 0 0 1 5.6-1.5" />
  </svg>
);

export interface BoxContext {
  flow: LiveFlow;
  setups: MatchSetups;
  levels: Levels;
  subs: Record<string, string[]>;
  qa: InterestAnswers;
  chips: Record<string, OnboardingChip[]>;
  /** Emoji and name for an interest. */
  nameOf: (key: string) => { icon: string; label: string };
  /** "Reshuffles ~2 of your top 5" for a question. */
  impactText: (item: LiveItem) => string;
  onTick: (interest: string, chip: string) => void;
}

/** Every question in the flow, so the box can be sized to the tallest one. */
function allItems(setups: MatchSetups): LiveItem[] {
  return Object.entries(setups).flatMap(([interest, s]) => s.questions.map((q) => ({ interest, q, because: q.whenChips[0] })));
}

export function QuestionBox({ ctx, wrapRef }: { ctx: BoxContext; wrapRef?: React.Ref<HTMLDivElement> }) {
  const { flow } = ctx;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [qh, setQh] = useState<number | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => allItems(ctx.setups), [ctx.setups]);

  // The box is as tall as the tallest question, measured off-screen at the real width, so the list below never jumps between questions.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const m = measureRef.current;
    if (!m || !width) return;
    let best = 0;
    Array.from(m.children).forEach((c) => { best = Math.max(best, (c as HTMLElement).offsetHeight); });
    setQh(best ? best + 2 : null);
  }, [width, items]);

  const f = flow;
  const label = f.unlocked ? 'List unlocked' : `${f.remaining} question${f.remaining === 1 ? '' : 's'} to unlock`;
  return (
    <div className={`lq-wrap ${f.open ? '' : 'shut'}`} ref={wrapRef}>
      <div className="lq-in">
        <div className="lq-win" aria-hidden={!f.open}>
          <div className="lq-meter">
            <b>DNA {f.percent}%</b>
            <div className="lq-mbar">
              <div className="lq-fill" style={{ width: `${Math.max(2, (f.points / f.barSize) * 100)}%` }} />
              <div className={`lq-gate ${f.unlocked ? 'open' : ''}`} style={{ ['--gx' as string]: `${f.gatePct}%` }}>{f.unlocked ? OPEN_LOCK : LOCK}</div>
            </div>
            <span className="lq-sr">{label}</span>
          </div>
          <SwapBody bodyRef={bodyRef} panelKey={panelKey(f)} dir={f.dir} fixedHeight={f.step === 'q1' || f.step === 'q3' || f.step === 'newq' ? qh : null}>
            {renderPanel(ctx)}
          </SwapBody>
        </div>
      </div>
      <div className="lq-measure" ref={measureRef} style={{ width }} aria-hidden>
        {items.map((it) => (
          <div key={`${it.interest}.${it.q.key}`} className="lq-swap">
            <QuestionPanel ctx={ctx} item={it} measure />
          </div>
        ))}
      </div>
    </div>
  );
}

function panelKey(f: LiveFlow): string {
  return f.item ? `${f.step}|${f.item.interest}.${f.item.q.key}` : f.step;
}

function renderPanel(ctx: BoxContext): ReactNode {
  const f = ctx.flow;
  if (f.step === 'chips') return <ChipsPanel ctx={ctx} />;
  if (f.step === 'interests') return <InterestsPanel ctx={ctx} />;
  if (f.step === 'newchips') return <NewChipsPanel ctx={ctx} />;
  if (!f.item) return <div className="lq-panel"><span className="lq-tag">All set for now</span><h3>You answered the questions for your top interests</h3></div>;
  return <QuestionPanel key={`${f.item.interest}.${f.item.q.key}`} ctx={ctx} item={f.item} />;
}

/** Slides the old panel out and the next one in, and eases the box to its new height (a constant one for questions). */
type Shown = { key: string; node: ReactNode; phase: 'idle' | 'leave' | 'enter'; back: boolean };

function SwapBody({ bodyRef, panelKey: key, dir, fixedHeight, children }: { bodyRef: React.RefObject<HTMLDivElement | null>; panelKey: string; dir: 1 | -1 | 0; fixedHeight: number | null; children: ReactNode }) {
  const [shown, setShown] = useState<Shown>({ key, node: children, phase: 'idle', back: false });
  const latest = useRef({ key, children });
  useEffect(() => { latest.current = { key, children }; });

  // Derived while rendering (React's sanctioned prop-change pattern): the same panel just refreshes; a different one slides out first.
  if (shown.phase !== 'leave') {
    if (shown.key === key) {
      if (shown.node !== children) setShown({ ...shown, node: children });
    } else if (dir === 0) setShown({ key, node: children, phase: 'idle', back: false });
    else setShown({ ...shown, phase: 'leave', back: dir < 0 });
  }
  useEffect(() => {
    if (shown.phase === 'leave') {
      const t = setTimeout(() => setShown({ key: latest.current.key, node: latest.current.children, phase: 'enter', back: shown.back }), 140);
      return () => clearTimeout(t);
    }
    if (shown.phase === 'enter') {
      const t = setTimeout(() => setShown((s) => ({ ...s, phase: 'idle' })), 260);
      return () => clearTimeout(t);
    }
  }, [shown.phase, shown.back]);

  const innerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (fixedHeight) return;
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedHeight, shown.key]);

  const height = fixedHeight ?? h;
  const cls = `lq-swap${fixedHeight ? ' fixed' : ''}${shown.phase === 'leave' ? ' leave' : shown.phase === 'enter' ? ' enter' : ''}${shown.back ? ' back' : ''}`;
  return (
    <div className="lq-body" ref={bodyRef} style={height ? { height } : undefined}>
      <div ref={innerRef} className={cls} style={fixedHeight ? { height: '100%' } : undefined}>
        {shown.node}
      </div>
    </div>
  );
}

// ---- one question ----

export function QuestionPanel({ ctx, item, measure }: { ctx: BoxContext; item: LiveItem; measure?: boolean }) {
  const f = ctx.flow;
  const { q, interest } = item;
  const multi = q.maxPicks > 1;
  const saved = ctx.qa[interest]?.[q.key];
  const [picks, setPicks] = useState<number[]>(measure ? [] : saved ?? []);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const nm = ctx.nameOf(interest);
  const chipLabel = item.because ? ctx.chips[interest]?.find((c) => c.key === item.because)?.label ?? item.because : '';
  const label = item.because ? `Because you picked ${chipLabel}` : `${nm.icon} ${nm.label}`;
  const tail = measure ? ' · 10 of 10 · 10 more to unlock' : ` · ${f.j + 1} of ${f.total}${f.step === 'q1' ? ` · ${f.remaining} more to unlock` : item.optional ? ' · optional' : ''}`;
  const short = q.options.length >= 5 && q.options.every((o) => o.length <= 34);

  function commit(next: number[], ms: number) {
    busy.current = true;
    timer.current = setTimeout(() => f.answer(item, next), ms);
  }
  function tap(i: number) {
    if (busy.current || measure) return;
    if (!multi) { setPicks([i]); commit([i], 230); return; }
    const at = picks.indexOf(i);
    const next = picks.slice();
    if (at >= 0) next.splice(at, 1);
    else { if (next.length >= q.maxPicks) next.shift(); next.push(i); }
    setPicks(next);
    if (at < 0 && next.length === q.maxPicks) commit(next, 260);
  }
  return (
    <div className="lq-panel">
      <div className="lq-r">
        <span className="lq-tag" style={item.because ? { color: 'var(--text-dim)' } : undefined}>{label}{tail}</span>
        {multi && <span className="lq-small">pick up to {q.maxPicks}</span>}
      </div>
      <h3>{q.text}</h3>
      <div className={`lq-rows${short ? ' two' : ''}`} role={multi ? 'group' : 'radiogroup'} aria-label={q.text}>
        {q.options.map((o, i) => (
          <button key={o} type="button" className={`lq-row${picks.includes(i) ? ' sel' : ''}`} role={multi ? 'checkbox' : 'radio'} aria-checked={picks.includes(i)} onClick={() => tap(i)}>
            <i className={`lq-rd${multi ? ' sq' : ''}`} />
            <span>{o}</span>
          </button>
        ))}
      </div>
      <div className="lq-foot">
        <div>{(measure || f.j > 0) && <button type="button" className="lq-link" onClick={f.back}>‹ Back</button>}</div>
        <span className="fm">{measure ? 'Reshuffles ~3 of your top 5' : item.q.mapped ? ctx.impactText(item) : 'No effect on the list yet'}</span>
        <div className="fr">
          <button type="button" className="lq-link strong" hidden={!(multi && picks.length >= 1)} onClick={() => { if (!busy.current && picks.length) { busy.current = true; f.answer(item, picks.slice()); } }}>Next ›</button>
          <button type="button" className="lq-link" onClick={() => { if (!busy.current && !measure) { busy.current = true; f.skip(item); } }}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// ---- the other steps ----

function ChipsPanel({ ctx }: { ctx: BoxContext }) {
  const f = ctx.flow;
  const keys = f.initial.all.filter((k) => (ctx.chips[k]?.length ?? 0) > 0);
  const opened = keys.reduce((n, k) => n + Object.values(ctx.setups[k]?.questions ?? []).filter((q) => q.whenChips.some((c) => (ctx.subs[k] ?? []).includes(c))).length, 0);
  const listRef = useRef<HTMLDivElement>(null);
  return (
    <div className="lq-panel">
      <div className="lq-r"><span className="lq-tag">Your chips</span></div>
      <h3>What kind of trip in each interest?</h3>
      <div className="lq-list" ref={listRef}>
        {keys.map((k) => {
          const nm = ctx.nameOf(k);
          return (
            <div key={k} className="lq-ic">
              <h4>{nm.icon} {nm.label}<small>{f.initial.top.includes(k) ? 'top' : 'selected'}</small></h4>
              <div className="lq-pills">
                {ctx.chips[k].map((c) => {
                  const on = (ctx.subs[k] ?? []).includes(c.key);
                  return <button key={c.key} type="button" className={`lq-pill${on ? ' sel' : ''}`} aria-pressed={on} onClick={() => ctx.onTick(k, c.key)}>{c.label}</button>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="lq-cta" onClick={f.finishChips}>Continue{opened ? ` • ${opened} new question${opened > 1 ? 's' : ''} opened` : ''}</button>
    </div>
  );
}

function InterestsPanel({ ctx }: { ctx: BoxContext }) {
  const f = ctx.flow;
  const have = Object.keys(ctx.levels);
  const nn = f.newOnes.length;
  return (
    <div className="lq-panel">
      <div className="lq-r"><span className="lq-tag">Keep building your DNA</span></div>
      <h3>Add more interests to your list</h3>
      <div className="lq-hint">Your list reshuffles as you add them, then you pick the kinds of trip you want in each and answer any new questions.</div>
      <div className="lq-list tall">
        <div className="lq-ic">
          <h4>Already in your list<small>{have.length} interests</small></h4>
          <div className="lq-pills">
            {f.initial.all.map((k) => {
              const nm = ctx.nameOf(k);
              const top = f.initial.top.includes(k);
              return <span key={k} className={`lq-pill have${top ? ' top' : ''}`}>✓ {nm.icon} {nm.label}{top ? ' · top' : ''}</span>;
            })}
            {f.added.map((k) => {
              const nm = ctx.nameOf(k);
              return <button key={k} type="button" className="lq-pill sel" aria-label={`Remove ${nm.label}`} onClick={() => f.removeInterest(k)}>{nm.icon} {nm.label} · new</button>;
            })}
          </div>
        </div>
        {pickerGroups().map((g) => {
          const items = interestsInGroup(g.name).filter((i) => !ctx.levels[i.key]);
          if (!items.length) return null;
          return (
            <div key={g.name} className="lq-ic">
              <h4>Add: {g.name}</h4>
              <div className="lq-pills">
                {items.map((i) => { const nm = ctx.nameOf(i.key); return <button key={i.key} type="button" className="lq-pill" onClick={() => f.addInterest(i.key)}>{nm.icon} {nm.label}</button>; })}
              </div>
            </div>
          );
        })}
      </div>
      {nn > 0 && <button type="button" className="lq-cta" onClick={f.toNewChips}>Continue • pick the kinds of trip for {nn} new interest{nn > 1 ? 's' : ''}</button>}
      <div className="lq-foot" style={{ gridTemplateColumns: '1fr auto' }}>
        <span>{f.added.length ? `${f.added.length} added` : 'None added yet'}</span>
        <button type="button" className="lq-link" onClick={f.backToChips}>Change my chips</button>
      </div>
    </div>
  );
}

function NewChipsPanel({ ctx }: { ctx: BoxContext }) {
  const f = ctx.flow;
  return (
    <div className="lq-panel">
      <div className="lq-r"><span className="lq-tag">Your chips for the new interests</span></div>
      <h3>What kind of trip in each?</h3>
      <div className="lq-list tall">
        {f.newOnes.map((k) => {
          const nm = ctx.nameOf(k);
          const cs = ctx.chips[k] ?? [];
          return (
            <div key={k} className="lq-ic">
              <h4>{nm.icon} {nm.label}<small>new</small></h4>
              <div className="lq-pills">
                {cs.length === 0 && <span className="lq-hint">No chips for this one yet.</span>}
                {cs.map((c) => { const on = (ctx.subs[k] ?? []).includes(c.key); return <button key={c.key} type="button" className={`lq-pill${on ? ' sel' : ''}`} aria-pressed={on} onClick={() => ctx.onTick(k, c.key)}>{c.label}</button>; })}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="lq-cta" onClick={f.finishNewChips}>Continue</button>
    </div>
  );
}
