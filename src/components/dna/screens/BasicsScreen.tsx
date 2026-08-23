import { TRAVEL_COMPANIONS } from '@/lib/dna/profile';
import { BAND_DIMENSIONS } from '@/lib/scoring/constants';
import { InterestGrid } from '../InterestGrid';
import type { DnaBands } from '@/lib/dna/types';

interface Props {
  pickedInterests: string[];
  onToggleInterest: (key: string) => void;
  companions: string[];
  onToggleCompanion: (key: string) => void;
  bands: DnaBands;
  onToggleBand: (dimKey: keyof DnaBands, bandKey: string) => void;
  onContinue: () => void;
}

export function BasicsScreen({
  pickedInterests,
  onToggleInterest,
  companions,
  onToggleCompanion,
  bands,
  onToggleBand,
  onContinue,
}: Props) {
  const canContinue = companions.length > 0;

  return (
    <div className="dna-screen dna-basics">
      <div className="dna-step-label">Step 1 of 3 — Tell us a bit, then start swiping</div>
      <h1>A few basics</h1>
      <p className="dna-basics-sub">
        Quick context first — this helps us skip cards that obviously won&apos;t fit, instead of making you swipe
        through them.
      </p>

      <div className="dna-basics-block">
        <h3>What looks good to you?</h3>
        <p className="dna-basics-hint">
          Pick as many as you like — this just points the deck in your direction, it doesn&apos;t lock anything in.
          Skip it if you&apos;d rather see everything.
        </p>
        <InterestGrid picked={pickedInterests} onToggle={onToggleInterest} />
      </div>

      <div className="dna-basics-block">
        <h3>Who do you usually travel with?</h3>
        <p className="dna-basics-hint">Select all that apply.</p>
        <div className="dna-companion-row">
          {TRAVEL_COMPANIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`dna-companion-btn${companions.includes(opt.key) ? ' active' : ''}`}
              onClick={() => onToggleCompanion(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dna-basics-block">
        <h3>Open To</h3>
        <p className="dna-basics-hint">What you&apos;re willing to accept — pick any combination. Everything selected means &ldquo;no preference.&rdquo;</p>
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
                  className={`band-btn${(bands[dim.key as keyof DnaBands] || []).includes(b.key) ? ' active' : ''}`}
                  onClick={() => onToggleBand(dim.key as keyof DnaBands, b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={onContinue} disabled={!canContinue}>
        Start swiping
      </button>
      {!canContinue && (
        <p className="dna-basics-note">Pick at least one travel-companion option to continue.</p>
      )}
    </div>
  );
}
