import { CARE_ITEMS } from '@/lib/onboarding/care';

const KIDS = CARE_ITEMS.find((c) => c.key === 'kids')!;

/**
 * Shown right under "Who's going" once "With my kids" is picked (owner pick, 22 Nov 2026): the ages question of the Kid-friendly row, so that answer does something
 * without a trip to What else matters. It writes the same choice that row does, so the two always agree.
 */
export function KidsAges({ ages, onToggle }: { ages: string[]; onToggle: (option: string) => void }) {
  return (
    <div className="ob2-kids">
      <div className="ob2-fine" style={{ margin: '8px 0 6px' }}>How old are they? We favor places that work for those ages.</div>
      <div className="ob2-otp">
        {KIDS.options!.map(([o, label]) => (
          <button key={o} type="button" className={`ob2-opill soft ${ages.includes(o) ? 'on' : ''}`} aria-pressed={ages.includes(o)} onClick={() => onToggle(o)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The kid-friendly item, for the code that has to toggle one of its options. */
export const KIDS_ITEM = KIDS;
