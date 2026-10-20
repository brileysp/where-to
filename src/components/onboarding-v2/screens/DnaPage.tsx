import { useMemo, useRef, type ReactNode } from 'react';
import { computeDisplayCalibrationPercent } from '@/lib/dna/calibration-feedback';
import { dnaStateFor, type ProfileInput } from '@/lib/onboarding/bridge';
import { CARE_ITEMS, COMPANIONS, bandDims, isNarrowed, type Bands, type CareItem, type CareState } from '@/lib/onboarding/care';
import { dnaRows, keepOn, rowHasChoices, type DnaRow, type RowContext } from '@/lib/onboarding/dna-rows';
import { interestByKey, pickerGroups, pickerInterests } from '@/lib/onboarding/interests';
import { LEVEL_LABELS, LEVEL_ORDER, topCount, type Levels } from '@/lib/onboarding/levels';
import { getOnboardingSettings, type InterestLevelId } from '@/lib/onboarding/settings';
import { VIBES } from '@/lib/onboarding/vibes';
import type { FlowData } from '../FlowData';
import { HomePicker } from '../HomePicker';
import { useFlip } from '../useFlip';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DnaPageProps {
  data: FlowData;
  dnaMode: boolean;
  input: ProfileInput;
  levels: Levels;
  subs: Record<string, string[]>;
  bands: Bands;
  care: CareState;
  who: string[];
  home: string | null;
  vibes: string[];
  month: number | null;
  week: number;
  maxHours: number;
  /** Interests listed, in the order fixed when the page was opened. */
  order: string[];
  open: Record<string, boolean>;
  collapsed: Record<string, boolean>;
  showAll: boolean;
  keep: Record<string, boolean>;
  onLevel: (key: string, level: InterestLevelId) => void;
  onSpecific: (interest: string, chip: string) => void;
  onToggleOpen: (key: string, current: boolean) => void;
  onToggleBlock: (key: string) => void;
  onShowAll: () => void;
  onKeep: (key: string, def: boolean) => void;
  onBandPill: (dim: string, band: string) => void;
  /** The "What matters" bands (social vibe, physical demand): pick none for no preference. */
  onBandChoice: (dim: string, band: string) => void;
  onCareOption: (item: CareItem, option: string) => void;
  onCareFirm: (key: string, firm: boolean) => void;
  onWho: (key: string) => void;
  onPickHome: (code: string) => void;
  onClearHome: () => void;
  onMaxHours: (h: number) => void;
  onNeedHome: () => void;
  onVibe: (key: string) => void;
  onMonth: (m: number) => void;
  onSave: () => void;
  onSecondary: () => void;
  onBack: () => void;
}

export function DnaPage(p: DnaPageProps) {
  const root = useRef<HTMLDivElement>(null);
  useFlip(root);
  const settings = getOnboardingSettings();
  const ctx: RowContext = { dnaMode: p.dnaMode, bands: p.bands, care: p.care, who: p.who, home: p.home, vibes: p.vibes, answerCount: p.input.answers.length, month: p.month, week: p.week, maxHours: p.maxHours };
  const rows = dnaRows(ctx);
  const calibration = Math.round(useMemo(() => computeDisplayCalibrationPercent(dnaStateFor(p.input, p.data.dimensions), p.data.cards), [p.input, p.data]));
  const isOpen = (key: string) => (p.open[key] !== undefined ? p.open[key] : rowHasChoices(key, { ...ctx, subs: p.subs }));
  const nTop = topCount(p.levels);
  const selected = Object.keys(p.levels).length;
  const fineTuned = Object.keys(p.levels).filter((k) => (p.subs[k] ?? []).length).length;
  const total = pickerInterests().length;
  const listed = new Set(p.order);
  const offAll = pickerInterests().filter((i) => !listed.has(i.key));

  function renderInterest(k: string) {
    const i = interestByKey(k)!;
    const level: InterestLevelId = p.levels[k] ?? 'off';
    const on = level !== 'off';
    const ch = p.data.chips[k] ?? [];
    const picked = p.subs[k] ?? [];
    const can = on && ch.length > 0;
    const open = can && isOpen(`i:${k}`);
    const pickedText = picked.map((c) => ch.find((x) => x.key === c)?.label ?? c).join(', ');
    return (
      <div key={k} className={`ob2-dc ic ${on ? '' : 'off'}`} data-flip={`i:${k}`}>
        <div className="dch">
          <span className="e" aria-hidden="true">{i.icon}</span>
          {can ? (
            <div className="dhd" role="button" tabIndex={0} aria-expanded={open} onClick={() => p.onToggleOpen(`i:${k}`, open)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), p.onToggleOpen(`i:${k}`, open))}>
              <div className="t">
                <b>{i.label}</b>
                {picked.length > 0 && !open && <small>{pickedText}</small>}
              </div>
              <span className="xpi" aria-hidden="true">{open ? '▴' : '▾'}</span>
            </div>
          ) : (
            <div className="dhd">
              <div className="t"><b>{i.label}</b></div>
            </div>
          )}
        </div>
        <div className="lvl" role="group" aria-label={`${i.label} level`}>
          {LEVEL_ORDER.map((l) => (
            <button key={l} type="button" className={level === l ? 'on' : ''} aria-pressed={level === l} onClick={() => p.onLevel(k, l)}>
              {l === 'top' ? '★ ' : ''}
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
        {open && (
          <div className="rks">
            <div className="ob2-rkl">What kind?</div>
            <div className="ob2-chips">
              {ch.map((c) => (
                <button key={c.key} type="button" className={`ob2-chip sc ${picked.includes(c.key) ? 'on' : ''}`} aria-pressed={picked.includes(c.key)} onClick={() => p.onSpecific(k, c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function editor(r: DnaRow): ReactNode {
    const k = r.key;
    if (k.startsWith('b_')) {
      const d = bandDims().find((x) => x.key === k.slice(2))!;
      // Social vibe and physical demand are "What matters" items: nothing picked is no preference. Budget and weather keep everything selected.
      if (d.key === 'vibe' || d.key === 'physical') {
        const set = isNarrowed(p.bands, d.key) ? p.bands[d.key] : [];
        return (
          <>
            <div className="ob2-chips">
              {d.bands.map((b) => (
                <button key={b.key} type="button" className={`ob2-chip ${set.includes(b.key) ? 'on' : ''}`} aria-pressed={set.includes(b.key)} onClick={() => p.onBandChoice(d.key, b.key)}>
                  {b.label}
                </button>
              ))}
            </div>
            <div className="ob2-fine" style={{ margin: 0 }}>Pick any that sound good. Pick none for no preference.</div>
          </>
        );
      }
      return (
        <>
          <div className="ob2-otp">
            {d.bands.map((b) => (
              <button key={b.key} type="button" className={`ob2-opill ${p.bands[d.key]?.includes(b.key) ? 'on' : ''}`} aria-pressed={!!p.bands[d.key]?.includes(b.key)} onClick={() => p.onBandPill(d.key, b.key)}>
                {b.label}
              </button>
            ))}
          </div>
          <div className="ob2-fine" style={{ margin: 0 }}>Everything selected means no preference.</div>
        </>
      );
    }
    if (k.startsWith('c_')) {
      const c = CARE_ITEMS.find((x) => x.key === k.slice(2))!;
      const v = p.care[c.key] ?? { o: [], firm: false };
      return (
        <>
          <div className="ob2-chips">
            {c.options!.map(([o, l]) => (
              <button key={o} type="button" className={`ob2-chip ${v.o.includes(o) ? 'on' : ''}`} aria-pressed={v.o.includes(o)} onClick={() => p.onCareOption(c, o)}>
                {l}
              </button>
            ))}
          </div>
          {c.firm && v.o.length > 0 && (
            <div className="ob2-seg2">
              <button type="button" className={!v.firm ? 'on' : ''} onClick={() => p.onCareFirm(c.key, false)}>Nice to have</button>
              <button type="button" className={v.firm ? 'on' : ''} onClick={() => p.onCareFirm(c.key, true)}>{c.firm}</button>
            </div>
          )}
        </>
      );
    }
    if (k === 'who')
      return (
        <div className="ob2-otp">
          {COMPANIONS.map((c) => (
            <button key={c.key} type="button" className={`ob2-opill ${p.who.includes(c.key) ? 'on' : ''}`} aria-pressed={p.who.includes(c.key)} onClick={() => p.onWho(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      );
    if (k === 'origin') return <HomePicker home={p.home} onPick={p.onPickHome} onClear={p.onClearHome} />;
    if (k === 'vibes')
      return (
        <div className="ob2-otp">
          {VIBES.map((v) => (
            <button key={v.key} type="button" className={`ob2-opill ${p.vibes.includes(v.key) ? 'on' : ''}`} aria-pressed={p.vibes.includes(v.key)} onClick={() => p.onVibe(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      );
    if (k === 'when')
      return (
        <div className="ob2-otp">
          {MONTHS.map((m, j) => (
            <button key={m} type="button" className={`ob2-opill ${p.month === j ? 'on' : ''}`} aria-pressed={p.month === j} onClick={() => p.onMonth(j)}>
              {m}
            </button>
          ))}
        </div>
      );
    if (k === 'limits')
      return (
        <>
          <HomePicker home={p.home} onPick={p.onPickHome} onClear={p.onClearHome} />
          <div className="ob2-otp">
            {settings.flightHourLimits.map((h) => (
              <button key={h} type="button" className={`ob2-opill ${p.maxHours === h ? 'on' : ''}`} aria-pressed={p.maxHours === h} onClick={() => (p.home ? p.onMaxHours(h) : p.onNeedHome())}>
                {h === 0 ? 'No limit' : `${h} hours`}
              </button>
            ))}
          </div>
        </>
      );
    return null;
  }

  function renderRow(r: DnaRow) {
    const on = keepOn(p.keep, r.key, r.def);
    const editable = r.key !== 'ans';
    const open = editable && isOpen(r.key);
    return (
      <div key={r.key} className={`ob2-dc ${on ? '' : 'off'}`}>
        <div className="dch">
          <span className="e" aria-hidden="true">{r.icon}</span>
          {editable ? (
            <div className="dhd" role="button" tabIndex={0} aria-expanded={open} onClick={() => p.onToggleOpen(r.key, open)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), p.onToggleOpen(r.key, open))}>
              <div className="t">
                <b>{r.title}</b>
                <small>{r.summary}</small>
              </div>
              <span className="xpi" aria-hidden="true">{open ? '▴' : '▾'}</span>
            </div>
          ) : (
            <div className="dhd">
              <div className="t">
                <b>{r.title}</b>
                <small>{r.summary}</small>
              </div>
            </div>
          )}
          <button type="button" className={`ob2-tg ${on ? 'on' : ''}`} aria-label={`${on ? 'Keep' : 'Do not keep'} ${r.title} in my Travel DNA`} aria-pressed={on} onClick={() => p.onKeep(r.key, r.def)} />
        </div>
        {open && <div className="ded">{editor(r)}</div>}
      </div>
    );
  }

  function renderBlock(id: string, title: string, count: string | number | undefined, sub: string | undefined, children: ReactNode) {
    const closed = !!p.collapsed[id];
    return (
      <div key={id} className="ob2-dsec">
        <button type="button" className="dsh" aria-expanded={!closed} onClick={() => p.onToggleBlock(id)}>
          <h3>
            {title}
            {count != null && <small> · {count}</small>}
          </h3>
          <span className="xpi" aria-hidden="true">{closed ? '▾' : '▴'}</span>
        </button>
        {!closed && (
          <>
            {sub && <p className="ob2-fine" style={{ margin: 0 }}>{sub}</p>}
            {children}
          </>
        )}
      </div>
    );
  }

  const bySec = (sec: DnaRow['sec']) => rows.filter((r) => r.sec === sec && r.def);
  const rowsBlock = (id: string, title: string, sub: string, list: DnaRow[]) =>
    list.length ? (
      renderBlock(id, title, list.length, sub, list.map((r) => renderRow(r)))
    ) : null;
  const tripOnly = rows.filter((r) => !r.def);

  return (
    <>
      <div className="ob2-top">
        <button type="button" className="ob2-back" onClick={p.onBack} aria-label={p.dnaMode ? 'Back' : 'Back to shortlist'}>‹</button>
        <div className="ob2-prog"><i style={{ width: '100%' }} /></div>
      </div>
      <div className="ob2-scr" ref={root}>
        <h2>{p.dnaMode ? 'Your Travel DNA, first sketch' : 'Your Travel DNA'}</h2>
        <div className="ob2-dna">
          <div className="ob2-sharp"><span>Calibration</span><div className="m"><i style={{ width: `${calibration}%` }} /></div><b>{calibration}%</b></div>
          <div className="ob2-fine">
            {p.dnaMode ? 'A sketch, not a verdict. Every trip you plan sharpens it.' : 'Changes apply to your list right away. Save to keep them as your defaults for the next trip. Switch off anything you do not want to carry over.'}
          </div>
        </div>
        {renderBlock('ints', 'Interests', `${selected}/${total} selected · ${fineTuned}/${total} fine-tuned`, 'Each interest has a level, and up to five can be Top. Tap a card header for its specifics.', (<>
          {p.order.map((k) => renderInterest(k))}
          {p.order.length === 0 && <div className="ob2-fine">No interests yet. Tap Show all to add some.</div>}
          <div className="ob2-fine" style={{ margin: 0 }}>{nTop} of {settings.maxTopInterests} top interests. The order updates the next time you open this page.</div>
          {p.showAll &&
            pickerGroups().map((g) => {
              const items = offAll.filter((i) => i.group === g.name);
              return items.length ? (
                <div key={g.name} className="ob2-dgrp">
                  <h4>{g.icon} {g.name}</h4>
                  {items.map((i) => renderInterest(i.key))}
                </div>
              ) : null;
            })}
          <button type="button" className="ob2-btn ghost" style={{ alignSelf: 'flex-start', width: 'auto' }} onClick={p.onShowAll}>
            {p.showAll ? 'Hide the rest' : `Show all ${offAll.length} more interests`}
          </button>
        </>))}
        {rowsBlock('open', 'Open to', 'Your defaults. Tap a card header to edit it.', bySec('open'))}
        {rowsBlock('care', 'What matters when you choose', 'Tap a card header to edit it. Nothing picked means no preference.', bySec('care'))}
        {rowsBlock('who', 'Who and where from', '', bySec('who'))}
        {rowsBlock('taste', 'Tastes we learned', '', bySec('taste'))}
        {rowsBlock('trip', 'This trip only', 'Switch on to keep any of these in your Travel DNA.', tripOnly)}
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={p.onSave}>
          {p.dnaMode ? 'Save my Travel DNA' : 'Save and go back'}
        </button>
        <button type="button" className="ob2-btn ghost" onClick={p.onSecondary}>
          {p.dnaMode ? 'See where it points' : 'Back without saving'}
        </button>
      </div>
    </>
  );
}
