import { useEffect, useRef } from 'react';
import { COMPANIONS } from '@/lib/onboarding/care';
import { MONTH_NAMES } from '@/lib/scoring/constants';
import { WhoCard } from '../WhoCard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The returning traveler's two questions (spec 4.12): when, and who’s coming. Everything else comes from the saved Travel DNA. */
export function WelcomeScreen({ name, tags, month, who, ages, lastTime, onUseLast, onMonth, onWho, onAge, onContinue }: { name: string | null; tags: string[]; month: number | null; who: string[]; ages: string[]; lastTime: { month: number | null; who: string[] } | null; onUseLast: () => void; onMonth: (m: number) => void; onWho: (k: string) => void; onAge: (option: string) => void; onContinue: () => void }) {
  // The month row scrolls sideways, so the chosen month is brought into view (it may be Sep or Oct).
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    const on = el?.querySelector<HTMLElement>('.on');
    if (el && on) el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
  }, [month]);
  const lastText = lastTime && lastTime.month != null ? `${MONTH_NAMES[lastTime.month]} · ${lastTime.who.length ? lastTime.who.map((k) => COMPANIONS.find((c) => c.key === k)?.label ?? k).join(', ') : 'Anyone'}` : null;
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
        {lastText && (
          <button type="button" className="ob2-last" onClick={onUseLast}>
            <span aria-hidden="true">↺</span>
            <span className="tx">
              <b>Same as last time?</b>
              <small>{lastText}</small>
            </span>
            <b className="use">Use ›</b>
          </button>
        )}
        <div className="ob2-card2">
          <h3>When?</h3>
          <div className="ob2-otp ob2-mrow" ref={row}>
            {MONTHS.map((m, j) => (
              <button key={m} type="button" className={`ob2-opill ${month === j ? 'on' : ''}`} aria-pressed={month === j} onClick={() => onMonth(j)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <WhoCard title="Who’s going this time?" sub="Select all that apply." who={who} onToggle={onWho} ages={ages} onAge={onAge} />
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Show my shortlist
        </button>
      </div>
    </>
  );
}
