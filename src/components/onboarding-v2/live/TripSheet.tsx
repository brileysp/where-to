'use client';

import { useState, type ReactNode } from 'react';
import { useUnitText } from '@/components/UnitsProvider';
import { BAND_DIMENSIONS, MONTH_NAMES } from '@/lib/scoring/constants';
import { CARE_ITEMS, COMPANIONS, bandDims, bandTitle, careCount, isNarrowed, type Bands } from '@/lib/onboarding/care';
import { ELSEWHERE, HomeLocation, type HomeBundle } from '../HomeLocation';
import { originLabel, resolveOrigin, type Origin } from '@/lib/onboarding/origin';
import { allRegions, REGION_KEYS, REGION_LABELS, type RegionKey } from '@/lib/onboarding/regions';
import type { TripAdjust } from '@/lib/onboarding/trip-adjust';
import { TRIP_LENGTHS, type TripLength } from '@/lib/onboarding/trip-length';
import { CareAccordion } from '../CareAccordion';
import { KIDS_ITEM, KidsAges } from '../KidsAges';
import type { CareHandlers } from '../screens/EssentialsScreen';
import { ContinentPicker } from './ContinentPicker';
import { PlaceTypePicker } from './PlaceTypePicker';
import { ALL_PLACE_TYPES, allPlaceTypes, placeTypesText } from '@/lib/onboarding/place-types';
import { TripName } from './TripsSheet';
import { PeakScale } from './PeakScale';
import { DEFAULT_PEAK, PEAK_NAMES, PEAK_TITLE } from '@/lib/onboarding/peak';
import { nextYearFor, type Trip } from '@/lib/onboarding/trips';
import { LengthPicker } from './LengthPicker';
import type { TripsApi } from './useTrips';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKS = ['Any week', 'Week 1', 'Week 2', 'Week 3', 'Week 4'];
const WEATHER_HINT = 'Daily highs: Cold under 50°F · Cool 50 to 69 · Warm 70 to 84 · Hot 85 and up';

export interface TripValues {
  month: number | null;
  week: number;
  length: TripLength | null;
  continents: RegionKey[];
  placeTypes: string[];
  who: string[];
  bands: Bands;
  loc: HomeBundle;
  maxHours: number;
  peak: number;
  careProps: CareHandlers;
}

export interface TripHandlers {
  onMonth: (m: number) => void;
  onWeek: (w: number) => void;
  onLength: (l: TripLength | null) => void;
  onContinents: (next: RegionKey[]) => void;
  onPlaceTypes: (next: string[]) => void;
  onWho: (k: string) => void;
  onBandPill: (dim: string, band: string) => void;
  onMaxHours: (h: number) => void;
  onPeak: (step: number) => void;
  onNeedHome: () => void;
}

/** Where flights are measured from right now (null until the traveler says where they live). */
export const originOf = (loc: HomeBundle): Origin | null => resolveOrigin({ airport: loc.airport, country: loc.country === ELSEWHERE ? null : loc.country, sub: loc.sub });

/** How many trip settings (not counting the month) the traveler has changed: the number on the Trip button. */
export function tripSetCount(v: TripValues): number {
  return (
    (v.length ? 1 : 0) +
    (v.who.length > 0 ? 1 : 0) +
    (isNarrowed(v.bands, 'budget') ? 1 : 0) +
    (isNarrowed(v.bands, 'weather') ? 1 : 0) +
    (v.peak !== DEFAULT_PEAK ? 1 : 0) +
    (!allRegions(v.continents) ? 1 : 0) +
    (!allPlaceTypes(v.placeTypes) ? 1 : 0) +
    (originOf(v.loc) ? 1 : 0) +
    (careCount(v.careProps.care, v.bands) > 0 ? 1 : 0)
  );
}

/** The month as the list heading shows it: "Mar", or "Any month". */
export const monthShort = (month: number | null): string => (month == null ? 'Any month' : MONTHS[month]);

export function bandText(bands: Bands, dim: string, any: string): string {
  const d = BAND_DIMENSIONS.find((x) => x.key === dim);
  if (!d || !isNarrowed(bands, dim)) return any;
  return bands[dim].map((b) => d.bands.find((x) => x.key === b)?.label ?? b).join(', ');
}

export function continentsText(on: readonly RegionKey[]): string {
  if (allRegions(on)) return 'All';
  const off = REGION_KEYS.filter((k) => !on.includes(k));
  return off.length <= 2 ? `All except ${off.map((k) => REGION_LABELS[k]).join(', ')}` : REGION_KEYS.filter((k) => on.includes(k)).map((k) => REGION_LABELS[k]).join(', ');
}

/** The "How long" card: what the trip length does to the places, from the real numbers. */
function LengthEffect({ length, adjust, names, inScope, home }: { length: TripLength; adjust: TripAdjust; names: Record<string, string>; inScope: Set<string>; home: string }) {
  const tiers: Record<'ok' | 'stretch' | 'far', string[]> = { ok: [], stretch: [], far: [] };
  for (const id of inScope) {
    const t = adjust.tiers[id];
    if (t) tiers[t].push(id);
  }
  const total = tiers.ok.length + tiers.stretch.length + tiers.far.length;
  const lab = TRIP_LENGTHS.find((l) => l.key === length)!;
  const examples = (ids: string[]) => ids.slice().sort((a, b) => adjust.hours[b] - adjust.hours[a]).slice(0, 3).map((id) => `${names[id] ?? id} (${adjust.hours[id]} h)`).join(', ');
  return (
    <div className="lq-fit">
      <div className="t">
        Trip: <b>{lab.label}</b> ({lab.days} days), from <b>{home}</b>. Of the {total} places in view:
      </div>
      <div className="bars">
        <i className="b-ok" style={{ flex: tiers.ok.length }} />
        <i className="b-st" style={{ flex: tiers.stretch.length }} />
        <i className="b-far" style={{ flex: tiers.far.length }} />
      </div>
      <div className="tiers">
        <div className="tier"><i className="b-ok" /><span><b>{tiers.ok.length}</b> fit fine</span></div>
        <div className="tier"><i className="b-st" /><span><b>{tiers.stretch.length}</b> a stretch. Rank a little lower.{tiers.stretch.length ? ` e.g. ${examples(tiers.stretch)}` : ''}</span></div>
        <div className="tier"><i className="b-far" /><span><b>{tiers.far.length}</b> mostly travel. Rank much lower.{tiers.far.length ? ` e.g. ${examples(tiers.far)}` : ''}</span></div>
      </div>
    </div>
  );
}

/**
 * "Your trip": the settings behind the Trip button, one row each with its current value, in this order: When, How long, Budget & comfort,
 * Climate, Continents, Flying from, then Who’s going (not in the list the owner gave, kept so travelers can still say who is coming), What else matters. A row opens its choices right under it (one open at a time). The button at the bottom
 * shows how many places are in view and closes the sheet. The list behind keeps following every change.
 */
export function TripSheet({ v, h, placeCount, adjust, names, inScope, api, defaultsDiff, onMakeDefault, onClose }: { v: TripValues; h: TripHandlers; placeCount: number; adjust: TripAdjust; names: Record<string, string>; inScope: Set<string>; api: TripsApi; defaultsDiff?: Record<'budget' | 'weather' | 'peak' | 'who', boolean>; onMakeDefault?: (part: 'budget' | 'weather' | 'peak' | 'who') => void; onClose: () => void }) {
  const trip: Trip = api.active;
  const onRename = api.rename;
  const onYear = api.setYear;
  const [sure, setSure] = useState(false);
  const unitText = useUnitText();
  const [openRow, setOpenRow] = useState<string | null>('when');
  const [weekOpen, setWeekOpen] = useState(false);
  const origin = originOf(v.loc);
  const nCare = careCount(v.careProps.care, v.bands);
  const makeDefaultLink = (part: 'budget' | 'weather' | 'peak' | 'who') =>
    defaultsDiff?.[part] ? (
      <button type="button" className="lq-link lq-mkdef" onClick={() => onMakeDefault?.(part)}>Make this my default</button>
    ) : null;

  function reset() {
    v.who.forEach((k) => h.onWho(k));
    for (const d of ['budget', 'weather']) if (isNarrowed(v.bands, d)) v.careProps.onBandReset(d);
    h.onPeak(DEFAULT_PEAK);
    h.onLength(null);
    h.onContinents([]);
    h.onPlaceTypes([...ALL_PLACE_TYPES]);
    v.loc.onClearAirport();
    CARE_ITEMS.forEach((i) => { if (v.careProps.care[i.key]) v.careProps.onClear(i.key); });
  }

  const bandRow = (dim: 'budget' | 'weather') => {
    const d = bandDims().find((x) => x.key === dim)!;
    return {
      id: dim,
      label: bandTitle(d),
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
          {makeDefaultLink(dim)}
        </>
      ),
    };
  };

  const rows: Array<{ id: string; label: string; value: string; set: boolean; body: ReactNode }> = [
    {
      id: 'when',
      label: 'When',
      value: v.month == null ? 'Any month' : `${MONTH_NAMES[v.month]}${trip.year != null ? ` ${trip.year}` : ''}${v.week ? ` · week ${v.week}` : ''}`,
      set: false,
      body: (
        <>
          <div className="lq-seg">
            {MONTHS.map((m, i) => (
              <button key={m} type="button" className={`lq-tp sm${v.month === i ? ' on' : ''}`} aria-pressed={v.month === i} onClick={() => h.onMonth(i)}>{m}</button>
            ))}
          </div>
          {v.month != null && trip.year != null && (() => {
            const first = nextYearFor(v.month);
            const year = trip.year;
            return (
              <div className="lq-yearstep">
                <button type="button" aria-label="Earlier year" disabled={year <= first} onClick={() => onYear(year - 1)}>‹</button>
                <b>{year}</b>
                <button type="button" aria-label="Later year" disabled={year >= first + 2} onClick={() => onYear(year + 1)}>›</button>
              </div>
            );
          })()}
          {v.month != null && (
            <div className="lq-weekrow">
              <button type="button" aria-expanded={weekOpen} onClick={() => setWeekOpen((o) => !o)}>
                <span className="k">Which week?</span>
                <span className={`v${v.week ? ' set' : ''}`}>{WEEKS[v.week] ?? WEEKS[0]}</span>
                <span className="ch" aria-hidden="true">{weekOpen ? '⌃' : '›'}</span>
              </button>
              {weekOpen && (
                <div className="lq-seg" style={{ marginTop: 6 }}>
                  {WEEKS.map((w, i) => (
                    <button key={w} type="button" className={`lq-tp${v.week === i ? ' on' : ''}`} aria-pressed={v.week === i} onClick={() => h.onWeek(i)}>{w}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ),
    },
    {
      id: 'long',
      label: 'How long',
      value: v.length ? TRIP_LENGTHS.find((l) => l.key === v.length)!.label : 'Not sure',
      set: !!v.length,
      body: (
        <>
          <LengthPicker value={v.length} onChange={h.onLength} />
          <div className="lq-hint" style={{ marginTop: 6 }}>Pick one, or leave it blank. It ranks places lower when flights eat the trip; it never hides them.</div>
          {v.length && !origin && <div className="lq-fit"><div className="t">Set <b>Flying from</b> so we can use this.</div></div>}
          {v.length && origin && <LengthEffect length={v.length} adjust={adjust} names={names} inScope={inScope} home={origin.label} />}
        </>
      ),
    },
    bandRow('budget'),
    bandRow('weather'),
    {
      id: 'peak',
      label: PEAK_TITLE,
      value: PEAK_NAMES[v.peak] ?? PEAK_NAMES[DEFAULT_PEAK],
      set: v.peak !== DEFAULT_PEAK,
      body: (
        <>
          <PeakScale value={v.peak} onChange={h.onPeak} />
          {makeDefaultLink('peak')}
        </>
      ),
    },
    {
      id: 'continents',
      label: 'Continents',
      value: continentsText(v.continents),
      set: !allRegions(v.continents),
      body: <ContinentPicker on={v.continents} onChange={h.onContinents} />,
    },
    {
      id: 'kinds',
      label: 'What kind of place',
      value: placeTypesText(v.placeTypes),
      set: !allPlaceTypes(v.placeTypes),
      body: <PlaceTypePicker on={v.placeTypes} onChange={h.onPlaceTypes} />,
    },
    {
      id: 'from',
      label: 'Flying from',
      value: origin ? originLabel({ airport: v.loc.airport, country: v.loc.country === ELSEWHERE ? null : v.loc.country, sub: v.loc.sub }) : 'Not set',
      set: !!origin,
      body: <HomeLocation {...v.loc} />,
    },
    {
      id: 'who',
      label: 'Who’s going',
      value: v.who.length ? v.who.map((k) => COMPANIONS.find((c) => c.key === k)?.label ?? k).join(', ') : 'Anyone',
      set: v.who.length > 0,
      body: (
        <>
          <div className="lq-seg">
            {COMPANIONS.map((c) => (
              <button key={c.key} type="button" className={`lq-tp${v.who.includes(c.key) ? ' on' : ''}`} aria-pressed={v.who.includes(c.key)} onClick={() => h.onWho(c.key)}>{c.label}</button>
            ))}
          </div>
          {v.who.includes('kids') && <KidsAges ages={v.careProps.care.kids?.o ?? []} onToggle={(o) => v.careProps.onOption(KIDS_ITEM, o)} />}
          {makeDefaultLink('who')}
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
          <TripName name={trip.name} onRename={onRename} big />
        </div>
        <div className="lq-switch" role="group" aria-label="Your trips">
          <button type="button" className="lq-swchip add" onClick={() => { setSure(false); void api.create(); }}>+ New trip</button>
          {api.trips.map((t2) => (
            <button key={t2.id} type="button" className={`lq-swchip${t2.id === api.activeId ? ' on' : ''}`} aria-pressed={t2.id === api.activeId} onClick={() => { setSure(false); api.switchTo(t2.id); }}>
              {t2.id === api.activeId ? '✓ ' : ''}{t2.name}
            </button>
          ))}
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
        <div className="lq-resetrow">
          <button type="button" className="lq-link" onClick={reset}>Reset this trip</button>
          {api.trips.length > 1 && (
            <button type="button" className="lq-link" onClick={() => (sure ? (api.remove(trip.id), setSure(false)) : setSure(true))}>
              {sure ? 'Sure? Delete it' : 'Delete this trip'}
            </button>
          )}
        </div>
        <div className="lq-hint" style={{ textAlign: 'center', padding: '0 4px 6px' }}>Interests, Travel DNA and where you live are shared by every trip.</div>
        <div className="lq-tripft">
          <button type="button" className="ob2-btn" onClick={onClose}>Show {placeCount} places</button>
        </div>
      </div>
    </div>
  );
}
