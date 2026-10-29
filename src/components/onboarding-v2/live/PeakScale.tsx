import { PEAK_ENDS, PEAK_NAMES, PEAK_STEPS } from '@/lib/onboarding/peak';

/**
 * "Crowds & prices": a five-step scale from peak times to off peak, starting in the middle. The two ends say what each one means; the step
 * chosen is named underneath. Used on the basics screen and in the Trip sheet.
 */
export function PeakScale({ value, onChange }: { value: number; onChange: (step: number) => void }) {
  return (
    <div className="pk">
      <div className="pk-ends">
        <div>
          <b>{PEAK_ENDS.peak.title}</b>
          <small>{PEAK_ENDS.peak.help}</small>
        </div>
        <div className="r">
          <b>{PEAK_ENDS.off.title}</b>
          <small>{PEAK_ENDS.off.help}</small>
        </div>
      </div>
      <div className="pk-track" role="radiogroup" aria-label="Crowds and prices, from peak times to off peak">
        {Array.from({ length: PEAK_STEPS }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={PEAK_NAMES[i]}
            className={`pk-stop${value === i ? ' on' : ''}`}
            style={{ left: `${(i / (PEAK_STEPS - 1)) * 100}%` }}
            onClick={() => onChange(i)}
          />
        ))}
      </div>
      <div className="pk-cur">{PEAK_NAMES[value] ?? PEAK_NAMES[2]}</div>
    </div>
  );
}
