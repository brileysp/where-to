import type { ScreenId } from '@/lib/onboarding/path';

const NAMES: Record<ScreenId, string> = {
  door: 'First screen',
  when: 'When',
  logistics: 'Getting there',
  love: 'What do you love to do?',
  rank: 'Top interests',
  essentials: 'The basics',
  vibes: 'Which of these feels like you?',
  results: 'Your shortlist',
  dnabasics: 'Travel DNA basics',
  cards: 'Taste cards',
  dnasum: 'Your Travel DNA',
  saved: 'Saved',
  welcome: 'Welcome back',
};

/** Stands in for screens that are built in a later slice, so the path and Back/Continue can be tried end to end. */
export function PlaceholderScreen({ screen, path, onContinue }: { screen: ScreenId; path: ScreenId[]; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <h2>{NAMES[screen]}</h2>
        <p className="ob2-sub">This screen is built in a later slice. The path below is this person&apos;s own, from the first screen&apos;s answers.</p>
        <ol className="ob2-path" aria-label="This person's screens">
          {path.map((s) => (
            <li key={s} className={s === screen ? 'here' : ''}>
              {NAMES[s]}
            </li>
          ))}
        </ol>
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Continue
        </button>
      </div>
    </>
  );
}
