export function MonthPrompt() {
  return (
    <div className="results-month-prompt">
      <div className="results-month-prompt-icon">📅</div>
      <h2>When are you thinking of traveling?</h2>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', maxWidth: 360 }}>
        Scores and seasonal notes depend on timing — pick a month in the sidebar to see ranked recommendations.
      </p>
    </div>
  );
}
