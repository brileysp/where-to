import { HomeLocation, type HomeBundle } from '../HomeLocation';
import { LengthPicker } from '../live/LengthPicker';
import type { TripLength } from '@/lib/onboarding/trip-length';
import { spanNote, tripMonthShares } from '@/lib/onboarding/trip-span';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKS = ['Any week', 'Week 1', 'Week 2', 'Week 3', 'Week 4'];

/** When (spec 4.2): a month, and for a specific window also the week. There is no "I am flexible" option. */
/** The note under the week picker when the trip is long enough to count a second month. */
function spanNoteFor(month: number | null, week: number, length: TripLength | null): string | null {
  return spanNote(tripMonthShares(month, week, length));
}

export function WhenScreen({ month, week, length, loc, windowMode, onMonth, onWeek, onLength, onContinue }: { month: number | null; week: number; length: TripLength | null; loc: HomeBundle; windowMode: boolean; onMonth: (m: number) => void; onWeek: (w: number) => void; onLength: (l: TripLength | null) => void; onContinue: () => void }) {
  const note = spanNoteFor(month, week, length);
  return (
    <>
      <div className="ob2-scr">
        <h2>When are you going?</h2>
        <p className="ob2-sub">{windowMode ? 'Pick the month and how long, then the week you start.' : 'Just pick a month.'}</p>
        <div className="ob2-card2">
          <h3>When?</h3>
          <div className="ob2-mgrid">
            {MONTHS.map((m, j) => (
              <button key={m} type="button" className={`ob2-opill ${month === j ? 'on' : ''}`} aria-pressed={month === j} onClick={() => onMonth(j)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="ob2-card2">
          <h3>How long?</h3>
          <p className="ob2-sub small">Optional. Places far from home rank lower when the flights would eat most of a short trip.</p>
          <LengthPicker value={length} onChange={onLength} variant="ob2" />
          <div className="ob2-flyfrom">
            <h4>Flying from</h4>
            <p className="ob2-sub small">So we can tell which places are a long flight for the time you have. Optional.</p>
            <HomeLocation {...loc} />
          </div>
        </div>
        {month != null && windowMode && (
          <div className="ob2-card2">
            <h3>Which week do you start?</h3>
            <p className="ob2-sub small">Week 1 is the 1st to the 7th, week 2 the 8th to the 14th, week 3 the 15th to the 21st, week 4 the 22nd to the end.</p>
            <div className="ob2-otp">
              {WEEKS.map((w, j) => (
                <button key={w} type="button" className={`ob2-opill ${week === j ? 'on' : ''}`} aria-pressed={week === j} onClick={() => onWeek(j)}>
                  {w}
                </button>
              ))}
            </div>
            {note && <p className="ob2-sub small ob2-spannote">{note}</p>}
          </div>
        )}
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" disabled={month == null} onClick={onContinue}>
          Continue
        </button>
      </div>
    </>
  );
}
