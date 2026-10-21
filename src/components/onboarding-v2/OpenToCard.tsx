import { useUnitText } from '@/components/UnitsProvider';
import { bandDims, bandTitle, type Bands } from '@/lib/onboarding/care';

/** The app's own "Open to" pills (spec 5.2): everything selected means no preference. */
const WEATHER_HINT = 'Daily highs: Cold under 50°F · Cool 50 to 69 · Warm 70 to 84 · Hot 85 and up';

export function OpenToCard({ dims, bands, onToggle }: { dims: string[]; bands: Bands; onToggle: (dim: string, band: string) => void }) {
  const unitText = useUnitText();
  return (
    <div className="ob2-card2">
      <h3>Open to</h3>
      <p className="ob2-sub small">What you&apos;re willing to accept. Pick any combination. Everything selected means “no preference.”</p>
      {dims.map((k) => {
        const d = bandDims().find((x) => x.key === k)!;
        return (
          <div key={k} className="ob2-otg">
            <div className="otl">
              <span aria-hidden="true">{d.icon}</span>
              {bandTitle(d)}
            </div>
            {k === 'weather' && <div className="oth">{unitText(WEATHER_HINT)}</div>}
            <div className="ob2-otp">
              {d.bands.map((b) => (
                <button key={b.key} type="button" className={`ob2-opill ${bands[k]?.includes(b.key) ? 'on' : ''}`} aria-pressed={!!bands[k]?.includes(b.key)} onClick={() => onToggle(k, b.key)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
