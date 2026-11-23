import { ALL_PLACE_TYPES, PLACE_TYPES, togglePlaceType } from '@/lib/onboarding/place-types';

/** "What kind of place?": every type is on to start; tapping one leaves it out. At least one stays on. */
export function PlaceTypePicker({ on, onChange }: { on: readonly string[]; onChange: (next: string[]) => void }) {
  const all = on.length === ALL_PLACE_TYPES.length;
  return (
    <div className="ob2-otp">
      {PLACE_TYPES.map((t) => {
        const isOn = on.includes(t.key);
        return (
          <button key={t.key} type="button" className={`ob2-opill soft ${isOn ? 'on' : ''}`} aria-pressed={isOn} onClick={() => onChange(togglePlaceType(on, t.key))}>
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </button>
        );
      })}
      {!all && (
        <button type="button" className="ob2-opill" onClick={() => onChange([...ALL_PLACE_TYPES])}>
          All
        </button>
      )}
    </div>
  );
}
