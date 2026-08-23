import { INTEREST_EMOJIS } from '@/lib/dna/interests';

export function InterestGrid({ picked, onToggle }: { picked: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="dna-interest-grid">
      {INTEREST_EMOJIS.map((def) => {
        const selected = picked.includes(def.key);
        return (
          <button
            key={def.key}
            type="button"
            className={`dna-interest-btn${selected ? ' active' : ''}`}
            onClick={() => onToggle(def.key)}
          >
            <span className="dna-interest-emoji">{def.emoji}</span>
            <span className="dna-interest-label">{def.label}</span>
          </button>
        );
      })}
    </div>
  );
}
