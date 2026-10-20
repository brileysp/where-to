import { COMPANIONS } from '@/lib/onboarding/care';

export function WhoCard({ title, sub, who, onToggle }: { title: string; sub: string; who: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="ob2-card2">
      <h3>{title}</h3>
      <p className="ob2-sub small">{sub}</p>
      <div className="ob2-otp">
        {COMPANIONS.map((c) => (
          <button key={c.key} type="button" className={`ob2-opill ${who.includes(c.key) ? 'on' : ''}`} aria-pressed={who.includes(c.key)} onClick={() => onToggle(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
