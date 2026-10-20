import { VIBES } from '@/lib/onboarding/vibes';

/** "Which of these feels like you?" (spec 4.7): photo picks, for people who did not choose interests. */
export function VibesScreen({ picked, onToggle, onContinue }: { picked: string[]; onToggle: (k: string) => void; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <h2>Which of these feels like you?</h2>
        <p className="ob2-sub">Pick any. These are the photos you would normally see.</p>
        <div className="ob2-grid2">
          {VIBES.map((v) => (
            <button key={v.key} type="button" className={`ob2-vt ${picked.includes(v.key) ? 'on' : ''}`} style={{ background: v.gradient }} aria-pressed={picked.includes(v.key)} onClick={() => onToggle(v.key)}>
              <span className="tick" aria-hidden="true">✓</span>
              <span className="big" aria-hidden="true">{v.emoji}</span>
              <b>{v.label}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Show my shortlist
        </button>
        <button type="button" className="ob2-link" onClick={onContinue}>
          Skip, surprise me
        </button>
      </div>
    </>
  );
}
