// Purely perceptual — the actual ranking is synchronous and instant, but
// showing zero latency after picking a month reads as suspicious/broken.
// This gives the "we're working on it" beat the interaction expects.
export function FetchingResults() {
  return (
    <div className="results-fetching">
      <div className="results-fetching-spinner" />
      <p>Fetching your results…</p>
    </div>
  );
}
