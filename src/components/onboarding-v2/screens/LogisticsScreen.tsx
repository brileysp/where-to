import { getOnboardingSettings } from '@/lib/onboarding/settings';
import { HomePicker } from '../HomePicker';

/**
 * Getting there (spec 4.3), optional. A flight limit is firm: places that do not fit are set aside. The nonstop switch is not in the first
 * version (no real route data), as decided.
 */
export function LogisticsScreen({ home, maxHours, onPick, onClear, onMaxHours, onNeedHome, onContinue }: { home: string | null; maxHours: number; onPick: (code: string) => void; onClear: () => void; onMaxHours: (h: number) => void; onNeedHome: () => void; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <h2>Getting there</h2>
        <p className="ob2-sub">Optional. If flights are not a limit, skip this. When you do set one, it is firm: places that do not fit are set aside, not just ranked lower.</p>
        <div className="ob2-card2">
          <h3>Flying from</h3>
          <HomePicker home={home} onPick={onPick} onClear={onClear} />
        </div>
        <div className="ob2-card2">
          <h3>Longest flight I would take</h3>
          <div className="ob2-otp">
            {getOnboardingSettings().flightHourLimits.map((h) => (
              <button key={h} type="button" className={`ob2-opill ${maxHours === h ? 'on' : ''}`} aria-pressed={maxHours === h} onClick={() => (home ? onMaxHours(h) : onNeedHome())}>
                {h === 0 ? 'No limit' : `${h} hours`}
              </button>
            ))}
          </div>
        </div>
        <div className="ob2-callout">Soft tastes (like “I prefer quiet beaches”) never hide a place. Only limits like these do, and you can always see what was set aside.</div>
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Continue
        </button>
        <button type="button" className="ob2-link" onClick={onContinue}>
          Skip, flights are not a limit
        </button>
      </div>
    </>
  );
}
