import { BAND_DIMENSIONS } from '@/lib/scoring/constants';

export function BandDimensionPicker({
  bands,
  onToggle,
}: {
  bands: Record<string, string[]>;
  onToggle: (dimKey: string, bandKey: string) => void;
}) {
  return (
    <>
      {BAND_DIMENSIONS.map((dim) => (
        <div key={dim.key} className="band-dim">
          <div className="band-dim-header">
            <span>
              {dim.icon} {dim.label}
            </span>
          </div>
          <div className="band-row">
            {dim.bands.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`band-btn${(bands[dim.key] || []).includes(b.key) ? ' active' : ''}`}
                onClick={() => onToggle(dim.key, b.key)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
