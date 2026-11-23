import { COMPANIONS } from '@/lib/onboarding/care';
import { KidsAges } from './KidsAges';

export function WhoCard({ title, sub, who, onToggle, ages, onAge }: { title: string; sub: string; who: string[]; onToggle: (key: string) => void; /** With a kids' ages handler, picking "With my kids" shows the ages question under the pills. */ ages?: string[]; onAge?: (option: string) => void }) {
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
      {who.includes('kids') && onAge && <KidsAges ages={ages ?? []} onToggle={onAge} />}
    </div>
  );
}
