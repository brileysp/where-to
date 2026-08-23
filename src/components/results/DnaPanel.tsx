export function DnaPanel({
  hintText,
  isDnaActive,
  onUseTravelDNA,
  onKeepRefining,
  onReview,
  onReset,
}: {
  hintText: string;
  isDnaActive: boolean;
  onUseTravelDNA: () => void;
  onKeepRefining: () => void;
  onReview: () => void;
  onReset: () => void;
}) {
  return (
    <div className="panel panel-dna">
      <h2>Travel DNA</h2>
      {isDnaActive && <div className="dna-active-badge">✓ Active — powering your results below</div>}
      <p className="panel-hint">{hintText}</p>
      <div className="dna-sidebar-actions">
        <button type="button" className={`btn-secondary${isDnaActive ? ' btn-active' : ''}`} onClick={onUseTravelDNA}>
          {isDnaActive ? '✓ Using my Travel DNA' : 'Use my Travel DNA'}
        </button>
        <button type="button" className="btn-secondary" onClick={onKeepRefining}>
          Keep refining
        </button>
        <button type="button" className="btn-secondary" onClick={onReview}>
          Review Travel DNA
        </button>
      </div>
      <button type="button" className="btn-secondary dna-reset-btn" onClick={onReset}>
        Reset Travel DNA
      </button>
    </div>
  );
}
