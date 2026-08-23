import { getWhyWeThinkThis } from '@/lib/dna/evidence';
import type { DnaCard, Evidence } from '@/lib/dna/types';

// Renders nothing (not even an empty shell) when there's genuinely no
// evidence to show, rather than displaying an empty section.
export function EvidenceDetails({ evidence, allCards }: { evidence: Evidence | null; allCards: DnaCard[] }) {
  if (!evidence) return null;
  const why = getWhyWeThinkThis(evidence, allCards, 3);
  if (!why.loved.length && !why.liked.length && !why.rejected.length) return null;

  return (
    <details className="dna-evidence">
      <summary>Why we think this</summary>
      {why.loved.length > 0 && (
        <>
          <p className="dna-evidence-label">Loved:</p>
          <ul className="dna-evidence-list">
            {why.loved.map((t, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: t }} />
            ))}
          </ul>
        </>
      )}
      {why.liked.length > 0 && (
        <>
          <p className="dna-evidence-label">Liked:</p>
          <ul className="dna-evidence-list">
            {why.liked.map((t, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: t }} />
            ))}
          </ul>
        </>
      )}
      {why.rejected.length > 0 && (
        <>
          <p className="dna-evidence-label">Rejected:</p>
          <ul className="dna-evidence-list">
            {why.rejected.map((t, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: t }} />
            ))}
          </ul>
        </>
      )}
      {why.patternSummary && (
        <>
          <p className="dna-evidence-label">Pattern:</p>
          <p className="dna-evidence-pattern">{why.patternSummary}</p>
        </>
      )}
    </details>
  );
}
