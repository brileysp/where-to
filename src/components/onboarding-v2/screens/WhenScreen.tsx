const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKS = ['Any week', 'Week 1', 'Week 2', 'Week 3', 'Week 4'];

/** When (spec 4.2): a month, and for a specific window also the week. There is no "I am flexible" option. */
export function WhenScreen({ month, week, windowMode, onMonth, onWeek, onContinue }: { month: number | null; week: number; windowMode: boolean; onMonth: (m: number) => void; onWeek: (w: number) => void; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <h2>When are you going?</h2>
        <p className="ob2-sub">{windowMode ? 'Pick the month, and the week if you know it.' : 'Just pick a month.'}</p>
        <div className="ob2-card2">
          <h3>When?</h3>
          <div className="ob2-otp">
            {MONTHS.map((m, j) => (
              <button key={m} type="button" className={`ob2-opill ${month === j ? 'on' : ''}`} aria-pressed={month === j} onClick={() => onMonth(j)}>
                {m}
              </button>
            ))}
          </div>
          {month != null && windowMode && (
            <div className="ob2-otp" style={{ marginTop: 8 }}>
              {WEEKS.map((w, j) => (
                <button key={w} type="button" className={`ob2-opill ${week === j ? 'on' : ''}`} aria-pressed={week === j} onClick={() => onWeek(j)}>
                  {w}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" disabled={month == null} onClick={onContinue}>
          Continue
        </button>
      </div>
    </>
  );
}
