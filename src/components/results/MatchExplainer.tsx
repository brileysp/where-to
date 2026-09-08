import type { MatchExplanation } from '@/lib/scoring/matchExplainer';

/**
 * Replaces the old "Specialist boost" callout — instead of always-visible
 * text bragging about one interest, this renders as short pros/cons chips
 * underneath the match card, shown only once the caller's own (i) toggle
 * is on. Purely presentational: the parent owns the expanded/collapsed
 * state since the toggle button itself lives inline next to the score,
 * outside this panel's own position in the layout.
 */
export function MatchExplainer({ explanation }: { explanation: MatchExplanation }) {
  const { pros, cons } = explanation;
  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <div className="match-explainer">
      {pros.length > 0 && (
        <div className="explainer-row pros">
          <span className="explainer-mark">✓</span>
          <span className="chip-list">
            {pros.map((p) => (
              <span className="mini-chip" key={p.key}>
                {p.icon} {p.label}
              </span>
            ))}
          </span>
        </div>
      )}
      {cons.length > 0 && (
        <div className="explainer-row cons">
          <span className="explainer-mark">✗</span>
          <span className="chip-list">
            {cons.map((c) => (
              <span className="mini-chip" key={c.key}>
                {c.icon} {c.label}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
