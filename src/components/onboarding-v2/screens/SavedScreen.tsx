import { keepOn, type DnaRow } from '@/lib/onboarding/dna-rows';

/** "Saved. Next trip starts here." (spec 4.13). */
export function SavedScreen({ tags, calibration, rows, keep, onReturning, onBack }: { tags: string[]; calibration: number; rows: DnaRow[]; keep: Record<string, boolean>; onReturning: () => void; onBack: () => void }) {
  const tripOnly = rows.filter((r) => !keepOn(keep, r.key, r.def)).map((r) => r.title.toLowerCase());
  return (
    <>
      <div className="ob2-scr">
        <h2>Saved. Next trip starts here.</h2>
        <div className="ob2-dna">
          <h3>Your Travel DNA, first sketch</h3>
          <div className="ob2-why">
            {tags.map((t) => (
              <span key={t} className="b">{t}</span>
            ))}
          </div>
          <div className="ob2-sharp"><span>Calibration</span><div className="m"><i style={{ width: `${calibration}%` }} /></div><b>{calibration}%</b></div>
          <div className="ob2-fine">A sketch, not a verdict. Every trip you plan sharpens it.</div>
        </div>
        <div className="ob2-callout">
          <b>Kept just for this trip:</b> {tripOnly.join(', ') || 'nothing'}.
          <br />
          <b>Next time we only ask:</b> when, and who is coming.
        </div>
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onReturning}>
          See it as a returning traveler
        </button>
        <button type="button" className="ob2-btn ghost" onClick={onBack}>
          Back to my shortlist
        </button>
      </div>
    </>
  );
}
