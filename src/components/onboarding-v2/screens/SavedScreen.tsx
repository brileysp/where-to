import { keepOn, type DnaRow } from '@/lib/onboarding/dna-rows';

/** "Saved. Next trip starts here." (spec 4.13). */
/** `onPreview` (testing only, with ?fresh=1) plays the next visit: only what was kept carries over, then the two questions. */
export function SavedScreen({ tags, calibration, rows, keep, onPreview, onBack }: { tags: string[]; calibration: number; rows: DnaRow[]; keep: Record<string, boolean>; onPreview?: () => void; onBack: () => void }) {
  const tripOnly = rows.filter((r) => !keepOn(keep, r.key, r.def)).map((r) => r.title.toLowerCase());
  return (
    <>
      <div className="ob2-scr">
        <h2>Saved. Next trip starts here.</h2>
        <div className="ob2-dna">
          <h3>Your Travel DNA</h3>
          <div className="ob2-why">
            {tags.map((t) => (
              <span key={t} className="b">{t}</span>
            ))}
          </div>
          <div className="ob2-sharp"><span>How well we know you</span><div className="m"><i style={{ width: `${calibration}%` }} /></div><b>{calibration}%</b></div>
          <div className="ob2-fine">Every trip you plan sharpens it.</div>
        </div>
        <div className="ob2-callout">
          <b>Kept just for this trip:</b> {tripOnly.join(', ') || 'nothing'}.
          <br />
          <b>Next time we only ask:</b> when, and who’s coming.
        </div>
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onBack}>
          See my places
        </button>
        {onPreview && (
          <button type="button" className="ob2-link" onClick={onPreview}>
            Preview my next visit (testing)
          </button>
        )}
      </div>
    </>
  );
}
