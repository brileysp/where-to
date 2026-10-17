import { WhoCard } from '../WhoCard';
import { OpenToCard } from '../OpenToCard';
import { CareAccordion } from '../CareAccordion';
import type { Bands, CareItem, CareState } from '@/lib/onboarding/care';

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
  onRemovePick: (index: number) => void;
  onAddKids: () => void;
}

/** "The basics" (spec 4.6): who is going, budget and weather, and one optional line for everything else. */
export function EssentialsScreen({ who, bands, onWho, onBand, careProps, onContinue }: { who: string[]; bands: Bands; onWho: (k: string) => void; onBand: (dim: string, band: string) => void; careProps: CareHandlers; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <h2>The basics</h2>
        <p className="ob2-sub">A few taps. Your shortlist appears right after.</p>
        <WhoCard title="Who is going?" sub="Select all that apply." who={who} onToggle={onWho} />
        <OpenToCard dims={['budget', 'weather']} bands={bands} onToggle={onBand} />
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
