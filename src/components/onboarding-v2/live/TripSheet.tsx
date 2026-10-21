'use client';

import { useState, type ReactNode } from 'react';
import { useUnitText } from '@/components/UnitsProvider';
import { BAND_DIMENSIONS } from '@/lib/scoring/constants';
import { airportByCode } from '@/lib/onboarding/airports';
import { CARE_ITEMS, COMPANIONS, bandDims, careCount, isNarrowed, type Bands } from '@/lib/onboarding/care';
import { getOnboardingSettings } from '@/lib/onboarding/settings';
import { CareAccordion } from '../CareAccordion';
import { HomePicker } from '../HomePicker';
import type { CareHandlers } from '../screens/EssentialsScreen';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKS = ['Any week', 'Week 1', 'Week 2', 'Week 3', 'Week 4'];
const WEATHER_HINT = 'Daily highs: Cold under 50°F · Cool 50 to 69 · Warm 70 to 84 · Hot 85 and up';

export interface TripValues {
  month: number | null;
  week: number;
  who: string[];
  bands: Bands;
  home: string | null;
  maxHours: number;
  careProps: CareHandlers;
}

export interface TripHandlers {
  onMonth: (m: number) => void;
  onWeek: (w: number) => void;
  onWho: (k: string) => void;
  onBandPill: (dim: string, band: string) => void;
  onPickHome: (code: string) => void;
  onClearHome: () => void;
  onMaxHours: (h: number) => void;
  onNeedHome: () => void;
}

/** How many trip settings (not counting the month) the traveler has changed: the number on the Trip button. */
export function tripSetCount(v: TripValues): number {
  return (v.who.length > 0 ? 1 : 0) + (isNarrowed(v.bands, 'budget') ? 1 : 0) + (isNarrowed(v.bands, 'weather') ? 1 : 0) + (v.home ? 1 : 0) + (careCount(v.careProps.care, v.bands) > 0 ? 1 : 0);
}

/** The month as the list heading shows it: "Mar", or "Any month". */
export const monthShort = (month: number | null): string => (month == null ? 'Any month' : MONTHS[month]);

function bandText(bands: Bands, dim: string, any: string): string {
  const d = BAND_DIMENSIONS.find((x) => x.key === dim);
  if (!d || !isNarrowed(bands, dim)) return any;
  return bands[dim].map((b) => d.bands.find((x) => x.key === b)?.label ?? b).join(', ');
}

/**
 * "Your trip": the six trip settings behind the Trip button, one row each with its current value; a row opens its choices right under it
 * (one open at a time). The button at the bottom shows how many places fit and closes the sheet. The list behind keeps following every change.
 */
export function TripSheet({ v, h, placeCount, onClose }: { v: TripValues; h: TripHandlers; placeCount: number; onClose: () => void }) {
  const unitText = useUnitText();
  const [openRow, setOpenRow] = useState<string | null>('when');
  const settings = getOnboardingSettings();
  const home = airportByCode(v.home);
  const nCare = careCount(v.careProps.care, v.bands);

  function reset() {
    v.who.forEach((k) => h.onWho(k));
    for (const d of ['budget', 'weather']) if (isNarrowed(v.bands, d)) v.careProps.onBandReset(d);
    if (v.home) h.onClearHome();
    CARE_ITEMS.forEach((i) => { if (v.careProps.care[i.key]) v.careProps.onClear(i.key); });
  }

  const rows: Array<{ id: string; label: string; value: string; set: boolean; body: ReactNode }> = [
    {
      id: 'when',
      label: 'When',
      value: v.month == null ? 'Any month' : MONTHS[v.month] + (v.week ? ` · week ${v.week}` : ''),
      set: false,
      body: (
        <>
          <div className="lq-seg">
            {MONTHS.map((m, i) => (
              <button key={m} type="button" className={`lq-tp sm${v.month === i ? ' on' : ''}`} aria-pressed={v.month === i} onClick={() => h.onMonth(i)}>{m}</button>
            ))}
          </div>
          {v.month != null && (
            <div className="lq-seg" style={{ marginTop: 8 }}>
              {WEEKS.map((w, i) => (
                <button key={w} type="button" className={`lq-tp${v.week === i ? ' on' : ''}`} aria-pressed={v.week === i} onClick={() => h.onWeek(i)}>{w}</button>
              ))}
            </div>
          )}
        </>
      ),
    },
    {
      id: 'who',
      label: 'Who is going',
      value: v.who.length ? v.who.map((k) => COMPANIONS.find((c) => c.key === k)?.label ?? k).join(', ') : 'Anyone',
      set: v.who.length > 0,
      body: (
        <div className="lq-seg">
          {COMPANIONS.map((c) => (
            <button key={c.key} type="button" className={`lq-tp${v.who.includes(c.key) ? ' on' : ''}`} aria-pressed={v.who.includes(c.key)} onClick={() => h.onWho(c.key)}>{c.label}</button>
          ))}
        </div>
      ),
    },
    ...(['budget', 'weather'] as const).map((dim) => {
      const d = bandDims().find((x) => x.key === dim)!;
      return {
        id: dim,
        label: d.label,
        value: bandText(v.bands, dim, 'Any'),
        set: isNarrowed(v.bands, dim),
        body: (
          <>
            {dim === 'weather' && <div className="lq-hint" style={{ marginBottom: 6 }}>{unitText(WEATHER_HINT)}</div>}
            <div className="lq-seg">
              {d.bands.map((b) => (
                <button key={b.key} type="button" className={`lq-tp${v.bands[dim]?.includes(b.key) ? ' on' : ''}`} aria-pressed={!!v.bands[dim]?.includes(b.key)} onClick={() => h.onBandPill(dim, b.key)}>{b.label}</button>
              ))}
            </div>
            <div className="lq-hint" style={{ marginTop: 6 }}>Pick any. Everything picked, or nothing, means no preference.</div>
          </>
        ),
      };
    }),
    {
      id: 'from',
      label: 'Flying from',
      value: home ? `${home.code}${v.maxHours ? ` · under ${v.maxHours} h` : ''}` : 'Not set',
      set: !!home,
      body: (
        <>
          <HomePicker home={v.home} onPick={h.onPickHome} onClear={h.onClearHome} />
          <div className="lq-lbl">Longest flight</div>
          <div className="lq-seg">
            {settings.flightHourLimits.map((x) => (
              <button key={x} type="button" className={`lq-tp${v.maxHours === x ? ' on' : ''}`} aria-pressed={v.maxHours === x} onClick={() => (v.home ? h.onMaxHours(x) : h.onNeedHome())}>{x === 0 ? 'No limit' : `${x} hours`}</button>
            ))}
          </div>
        </>
      ),
    },
    {
      id: 'matters',
      label: 'What else matters',
      value: nCare ? `${nCare} chosen` : 'None',
      set: nCare > 0,
      body: <CareAccordion {...v.careProps} bare open />,
    },
  ];

  return (
    <div className="ob2-sbg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ob2-sheet lq-trip" role="dialog" aria-modal="true" aria-label="Your trip">
        <div className="lq-triphd">
          <h3>Your trip</h3>
          <button type="button" className="lq-link" onClick={reset}>Reset</button>
        </div>
        <div className="lq-tripbody">
          {rows.map((r) => (
            <div key={r.id} className={`lq-srow${openRow === r.id ? ' open' : ''}`}>
              <button type="button" aria-expanded={openRow === r.id} onClick={() => setOpenRow(openRow === r.id ? null : r.id)}>
                <span className="k">{r.label}</span>
                <span className={`v${r.set ? ' set' : ''}`}>{r.value}</span>
                <span className="ch" aria-hidden="true">›</span>
              </button>
              {openRow === r.id && <div className="lq-spn">{r.body}</div>}
            </div>
          ))}
        </div>
        <div className="lq-tripft">
          <button type="button" className="ob2-btn" onClick={onClose}>Show {placeCount} places</button>
        </div>
      </div>
    </div>
  );
}
