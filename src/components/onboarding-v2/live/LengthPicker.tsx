import { TRIP_LENGTHS, type TripLength } from '@/lib/onboarding/trip-length';

/** "How long?": four choices, or none for no preference (tapping the chosen one again clears it). Style `ob2` for the full screens, `lq` for the sheet. */
export function LengthPicker({ value, onChange, variant = 'lq' }: { value: TripLength | null; onChange: (v: TripLength | null) => void; variant?: 'lq' | 'ob2' }) {
  return (
    <div className={variant === 'ob2' ? 'ob2-otp' : 'lq-seg'}>
      {TRIP_LENGTHS.map((l) => (
        <button key={l.key} type="button" className={variant === 'ob2' ? `ob2-opill ${value === l.key ? 'on' : ''}` : `lq-tp${value === l.key ? ' on' : ''}`} aria-pressed={value === l.key} onClick={() => onChange(value === l.key ? null : l.key)}>
          {l.label}
          {l.sub && <small className="lq-tpsub">{l.sub}</small>}
        </button>
      ))}
    </div>
  );
}
