import { WhoCard } from '../WhoCard';
import { OpenToCard } from '../OpenToCard';
import { CareAccordion } from '../CareAccordion';
import { HomePicker } from '../HomePicker';
import type { Bands } from '@/lib/onboarding/care';
import type { CareHandlers } from './EssentialsScreen';

/** The Travel DNA path's basics (spec 4.10): who you usually travel with, all four bands, a home city or airport, and the lasting "what matters" items. */
export function DnaBasicsScreen({ who, bands, home, onWho, onBand, onPick, onClear, careProps, onContinue }: { who: string[]; bands: Bands; home: string | null; onWho: (k: string) => void; onBand: (dim: string, band: string) => void; onPick: (code: string) => void; onClear: () => void; careProps: CareHandlers; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <WhoCard title="Who do you usually travel with?" sub="Select all that apply." who={who} onToggle={onWho} />
        <OpenToCard dims={['budget', 'weather', 'vibe', 'physical']} bands={bands} onToggle={onBand} />
        <div className="ob2-card2">
          <h3>Home city or airport</h3>
          <p className="ob2-sub small">Optional. Type a city or airport code. Used to warn you about long flights.</p>
          <HomePicker home={home} onPick={onPick} onClear={onClear} />
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
