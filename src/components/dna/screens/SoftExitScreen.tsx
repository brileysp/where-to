export function SoftExitScreen({
  percent,
  onShowMatches,
  onKeepRefining,
}: {
  percent: number;
  onShowMatches: () => void;
  onKeepRefining: () => void;
}) {
  return (
    <div className="dna-screen dna-softexit">
      <div className="dna-softexit-card">
        <div className="dna-softexit-icon">📶</div>
        <h2>{percent}% calibrated — enough signal to start recommending.</h2>
        <p>More swipes will sharpen it further, but you can see matches now.</p>
        <div className="dna-softexit-buttons">
          <button className="btn-primary" onClick={onShowMatches}>
            Show my matches
          </button>
          <button className="dna-btn-secondary" onClick={onKeepRefining}>
            Keep refining
          </button>
        </div>
      </div>
    </div>
  );
}
