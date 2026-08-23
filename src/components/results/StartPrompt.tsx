export function StartPrompt({ onStartSwiping }: { onStartSwiping: () => void }) {
  return (
    <div className="results-month-prompt">
      <div className="results-month-prompt-icon">🗺️</div>
      <h2>Pick a starting point</h2>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', maxWidth: 360 }}>
        Choose a preset in the sidebar, or build your own Travel DNA — recommendations show up once we know what you&apos;re
        actually looking for.
      </p>
      <button type="button" className="btn-primary" onClick={onStartSwiping}>
        Start building my Travel DNA
      </button>
    </div>
  );
}
