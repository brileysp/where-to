export function IntroScreen({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="dna-screen dna-intro">
      <div className="dna-intro-icon">🧭</div>
      <h1>Build your Travel DNA</h1>
      <p className="dna-intro-lead">
        Swipe through travel experiences so Where To? can learn what kind of trips are actually right for you.
      </p>
      <p className="dna-intro-sub">Say no, yes, or love. The more signal you give, the better the recommendations get.</p>
      <button className="btn-primary" onClick={onStart}>
        Start building my Travel DNA
      </button>
      <button className="dna-link-btn" onClick={onSkip}>
        Skip swiping — pick a travel style instead
      </button>
      <p className="dna-intro-footnote">You can reset or refine this anytime.</p>
    </div>
  );
}
