import { HomeLocation, type HomeBundle } from '../HomeLocation';

/**
 * Getting there (spec 4.3), optional: where you fly from. How far is too far is worked out from this and the trip length (no separate
 * longest-flight question), so it only asks where you live.
 */
export function LogisticsScreen({ loc, onContinue }: { loc: HomeBundle; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <h2>Getting there</h2>
        <p className="ob2-sub">Optional. Where you fly from helps us work out which places are a long way for the time you have.</p>
        <div className="ob2-card2">
          <h3>Flying from</h3>
          <HomeLocation {...loc} />
        </div>
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Continue
        </button>
        <button type="button" className="ob2-link" onClick={onContinue}>
          Skip for now
        </button>
      </div>
    </>
  );
}
