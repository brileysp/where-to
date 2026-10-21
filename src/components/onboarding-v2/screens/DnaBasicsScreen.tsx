import { WhoCard } from '../WhoCard';
import { OpenToCard } from '../OpenToCard';
import { CareAccordion } from '../CareAccordion';
import { HomeLocation, type HomeBundle } from '../HomeLocation';
import type { Bands } from '@/lib/onboarding/care';
import type { CareHandlers } from './EssentialsScreen';

/** The Travel DNA path's basics (spec 4.10): who you usually travel with, all four bands, a home city or airport, and the lasting "what matters" items. */
export function DnaBasicsScreen({ who, bands, loc, onWho, onBand, careProps, onContinue }: { who: string[]; bands: Bands; loc: HomeBundle; onWho: (k: string) => void; onBand: (dim: string, band: string) => void; careProps: CareHandlers; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <WhoCard title="Who do you usually travel with?" sub="Select all that apply." who={who} onToggle={onWho} />
        <OpenToCard dims={['budget', 'weather', 'vibe', 'physical']} bands={bands} onToggle={onBand} />
        <div className="ob2-card2">
          <h3>Where you live</h3>
          <p className="ob2-sub small">Optional. Used to warn you about long flights and to count the flying against a short trip.</p>
          <HomeLocation {...loc} />
        </div>
        <CareAccordion {...careProps} />
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Start swiping
        </button>
      </div>
    </>
  );
}
