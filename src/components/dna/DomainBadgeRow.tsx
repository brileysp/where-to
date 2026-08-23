import type { DomainDef } from '@/lib/dna/types';

export function DomainBadgeRow({ completedDeepDives, domains }: { completedDeepDives: string[]; domains: DomainDef[] }) {
  if (!completedDeepDives.length) return null;

  return (
    <div className="dna-domain-badge-row">
      {completedDeepDives.map((key) => {
        const def = domains.find((d) => d.key === key);
        return (
          <span key={key} className="dna-domain-badge" title={`${def?.label || key} — deep dive complete`}>
            {def?.emoji || '✨'}
          </span>
        );
      })}
    </div>
  );
}
