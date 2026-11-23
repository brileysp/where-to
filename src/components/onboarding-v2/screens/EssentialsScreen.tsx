import { useState } from 'react';
import { useUnitText } from '@/components/UnitsProvider';
import { SummaryRow } from '../SummaryRow';
import { bandText, continentsText } from '../live/TripSheet';
import { CareAccordion } from '../CareAccordion';
import { KIDS_ITEM, KidsAges } from '../KidsAges';
import { ContinentPicker } from '../live/ContinentPicker';
import { PeakScale } from '../live/PeakScale';
import { PlaceTypePicker } from '../live/PlaceTypePicker';
import { DEFAULT_PEAK, PEAK_NAMES, PEAK_TITLE } from '@/lib/onboarding/peak';
import { allPlaceTypes, placeTypesText } from '@/lib/onboarding/place-types';
import { COMPANIONS, bandDims, bandTitle, isNarrowed, type Bands, type CareItem, type CareState } from '@/lib/onboarding/care';
import { allRegions, type RegionKey } from '@/lib/onboarding/regions';

export interface CareHandlers {
  scope: 'trip' | 'dna';
  care: CareState;
  bands: Bands;
  open: boolean;
  tiles: string[];
  bare?: boolean;
  onOpen: () => void;
  onTile: (key: string) => void;
  onBandChoice: (dim: string, band: string) => void;
  onBandReset: (dim: string) => void;
  onOption: (item: CareItem, option: string) => void;
  onFirm: (key: string, firm: boolean) => void;
  onClear: (key: string) => void;
}

const WEATHER_HINT = 'Daily highs: Cold under 50°F · Cool 50 to 69 · Warm 70 to 84 · Hot 85 and up';

/**
 * "The basics" (spec 4.6), reworked on 23 Nov 2026 (owner picks): every setting is a quiet row that reads "Any" until something is left out and opens on tap (budget, climate, continents and place types start with everything on), so a
 * screen of filled pills no longer looks like a screen of choices. Budget and Climate start open because they change the list the most; the rest follow in order of
 * how much they change it. One button at the bottom.
 */
export function EssentialsScreen({ who, bands, continents, placeTypes, peak, last, onBand, onPeak, onWho, onContinents, onPlaceTypes, careProps, onContinue }: { who: string[]; bands: Bands; continents: RegionKey[]; placeTypes: string[]; peak: number; last: boolean; onBand: (dim: string, band: string) => void; onPeak: (step: number) => void; onWho: (k: string) => void; onContinents: (next: RegionKey[]) => void; onPlaceTypes: (next: string[]) => void; careProps: CareHandlers; onContinue: () => void }) {
  const unitText = useUnitText();
  const [open, setOpen] = useState<string[]>(['budget', 'weather']);
  const toggle = (k: string) => setOpen((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const bandRow = (dim: 'budget' | 'weather') => {
    const d = bandDims().find((x) => x.key === dim)!;
    const set = bands[dim] ?? [];
    return (
      <SummaryRow key={dim} title={bandTitle(d)} value={bandText(bands, dim, 'Any')} set={isNarrowed(bands, dim)} open={open.includes(dim)} onToggle={() => toggle(dim)}>
        {dim === 'weather' && <div className="ob2-fine" style={{ margin: '0 0 6px' }}>{unitText(WEATHER_HINT)}</div>}
        <div className="ob2-otp">
          {d.bands.map((b) => (
            <button key={b.key} type="button" className={`ob2-opill ${set.includes(b.key) ? 'on' : ''}`} aria-pressed={set.includes(b.key)} onClick={() => onBand(dim, b.key)}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="ob2-fine" style={{ margin: '6px 0 0' }}>Everything is on. Tap one to leave it out.</div>
      </SummaryRow>
    );
  };
  const typesOn = !allPlaceTypes(placeTypes);
  return (
    <>
      <div className="ob2-scr">
        <h2>The basics</h2>
        <p className="ob2-sub">A few taps. Your shortlist appears right after.</p>
        {bandRow('budget')}
        {bandRow('weather')}
        <SummaryRow title="Where in the world" value={continentsText(continents)} set={!allRegions(continents)} open={open.includes('where')} onToggle={() => toggle('where')}>
          <p className="ob2-sub small" style={{ margin: '0 0 6px' }}>Everywhere is on. Tap a continent to leave it out.</p>
          <ContinentPicker on={continents} onChange={onContinents} />
        </SummaryRow>
        <SummaryRow title="What kind of place" value={placeTypesText(placeTypes)} set={typesOn} open={open.includes('kind')} onToggle={() => toggle('kind')}>
          <p className="ob2-sub small" style={{ margin: '0 0 6px' }}>Everything is on. Tap a kind to leave it out.</p>
          <PlaceTypePicker on={placeTypes} onChange={onPlaceTypes} />
        </SummaryRow>
        <SummaryRow title={PEAK_TITLE} value={PEAK_NAMES[peak] ?? PEAK_NAMES[DEFAULT_PEAK]} set={peak !== DEFAULT_PEAK} open={open.includes('peak')} onToggle={() => toggle('peak')}>
          <PeakScale value={peak} onChange={onPeak} />
        </SummaryRow>
        <SummaryRow title="Who’s going" value={who.length ? who.map((k) => COMPANIONS.find((c) => c.key === k)?.label ?? k).join(', ') : 'Anyone'} set={who.length > 0} open={open.includes('who')} onToggle={() => toggle('who')}>
          <div className="ob2-otp">
            {COMPANIONS.map((c) => (
              <button key={c.key} type="button" className={`ob2-opill ${who.includes(c.key) ? 'on' : ''}`} aria-pressed={who.includes(c.key)} onClick={() => onWho(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          {who.includes('kids') && <KidsAges ages={careProps.care.kids?.o ?? []} onToggle={(o) => careProps.onOption(KIDS_ITEM, o)} />}
          <div className="ob2-fine" style={{ margin: '6px 0 0' }}>Select all that apply.</div>
        </SummaryRow>
        <CareAccordion {...careProps} />
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          {last ? 'Show my places' : 'Continue'}
        </button>
      </div>
    </>
  );
}
