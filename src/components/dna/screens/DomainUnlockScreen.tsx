import type { DomainDef } from '@/lib/dna/types';

export function DomainUnlockScreen({
  domainKey,
  domains,
  onContinue,
}: {
  domainKey: string;
  domains: DomainDef[];
  onContinue: () => void;
}) {
  const def = domains.find((d) => d.key === domainKey);
  const title = def?.transitionTitle || `${domainKey} is looking like a real interest.`;
  const body = def?.transitionBody || "Let's get more specific.";

  return (
    <div className="dna-screen dna-domain-unlock">
      <div className="dna-domain-unlock-card">
        <div className="dna-domain-unlock-kicker">Going deeper: {domainKey}</div>
        <div className="dna-domain-unlock-title">{title}</div>
        <p className="dna-domain-unlock-body">{body}</p>
        <button className="btn-primary" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
