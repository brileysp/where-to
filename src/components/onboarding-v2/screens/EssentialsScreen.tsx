import { WhoCard } from '../WhoCard';
import { OpenToCard } from '../OpenToCard';
import { CareAccordion } from '../CareAccordion';
import { ContinentPicker } from '../live/ContinentPicker';
import type { Bands, CareItem, CareState } from '@/lib/onboarding/care';
import type { RegionKey } from '@/lib/onboarding/regions';

export interface CareHandlers {
  scope: 'trip' | 'dna';
  care: CareState;
  bands: Bands;
  open: boolean;
  tiles: string[];
  kidsSuggested: boolean;
  bare?: boolean;
  onOpen: () => void;
  onTile: (key: string) => void;
  onBandChoice: (dim: string, band: string) => void;
  onBandReset: (dim: string) => void;
  onOption: (item: CareItem, option: string) => void;
  onFirm: (key: string, firm: boolean) => void;
  onClear: (key: string) => void;
  onAddKids: () => void;
}

/** "The basics" (spec 4.6): who is going, budget and weather, and one optional line for everything else. */
export function EssentialsScreen({ who, bands, continents, onWho, onBand, onContinents, careProps, onContinue }: { who: string[]; bands: Bands; continents: RegionKey[]; onWho: (k: string) => void; onBand: (dim: string, band: string) => void; onContinents: (next: RegionKey[]) => void; careProps: CareHandlers; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <h2>The basics</h2>
        <p className="ob2-sub">A few taps. Your shortlist appears right after.</p>
        <WhoCard title="Who is going?" sub="Select all that apply." who={who} onToggle={onWho} />
        <OpenToCard dims={['budget', 'weather']} bands={bands} onToggle={onBand} />
        <div className="ob2-card2">
          <h3>Where in the world?</h3>
          <p className="ob2-sub small">Everywhere is on. Tap a continent to leave it out.</p>
          <ContinentPicker on={continents} onChange={onContinents} />
        </div>
        <CareAccordion {...careProps} />
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Continue
        </button>
        <button type="button" className="ob2-link" onClick={onContinue}>
          Skip, I will decide later
        </button>
      </div>
    </>
  );
}
