import { WhoCard } from '../WhoCard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The returning traveler's two questions (spec 4.12): when, and who is coming. Everything else comes from the saved Travel DNA. */
export function WelcomeScreen({ name, tags, month, who, onMonth, onWho, onContinue }: { name: string | null; tags: string[]; month: number | null; who: string[]; onMonth: (m: number) => void; onWho: (k: string) => void; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <div className="ob2-brand">Where To?</div>
        <h2>{name ? `Welcome back, ${name}. Planning something?` : 'Welcome back. Planning something?'}</h2>
        <div className="ob2-dna">
          <div className="ob2-lbl" style={{ margin: 0 }}>Starting from your Travel DNA</div>
          <div className="ob2-why">
            {tags.map((t) => (
              <span key={t} className="b">{t}</span>
            ))}
          </div>
          <div className="ob2-fine">No need to answer all that again. Two questions, then your shortlist.</div>
        </div>
        <div className="ob2-card2">
          <h3>When?</h3>
          <div className="ob2-otp">
            {MONTHS.map((m, j) => (
              <button key={m} type="button" className={`ob2-opill ${month === j ? 'on' : ''}`} aria-pressed={month === j} onClick={() => onMonth(j)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <WhoCard title="Who is going this time?" sub="Select all that apply." who={who} onToggle={onWho} />
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Show my shortlist
        </button>
      </div>
    </>
  );
}
