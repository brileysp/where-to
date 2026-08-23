import { rankedBreakdownSliders, matchReasonTier } from '@/lib/scoring/breakdown';
import { barColor } from '@/lib/scoring/rank';
import type { SelectedStyles } from '@/lib/scoring/rank';
import { getStyleLabel } from '@/lib/dna/domains';
import type { ScoredDestination } from '@/lib/scoring/types';

export function Breakdown({
  dest,
  weights,
  monthIdx,
  expanded,
  highlightCount,
  selectedStyles,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  monthIdx: number;
  expanded: boolean;
  highlightCount: number;
  selectedStyles?: SelectedStyles;
}) {
  const ranked = rankedBreakdownSliders(dest, weights, monthIdx, selectedStyles);
  if (!ranked.length) {
    return <p className="match-reasons-empty">Not enough signal yet to explain the match — try Travel DNA or the sliders.</p>;
  }
  const visible = expanded ? ranked : ranked.slice(0, highlightCount);

  return (
    <div className="breakdown">
      {visible.map((r, i) => {
        const highlight = i < highlightCount && !r.isNA;
        const selectedForSlider = selectedStyles?.[r.slider.key] || [];
        // A chip is a claim that this destination is a real match for the
        // style, not just a minor contributor — casual (and none/unrated)
        // still feed the score via styleAdjustedScore's multiplier, but
        // don't earn a chip. Iceland being 'casual' for deserts shouldn't
        // put a Desert chip on it when the score bar already reflects that
        // casual weighting.
        const chipworthyStyles = selectedForSlider.filter((styleKey) => {
          const tier = dest.activityStyleTiers[r.slider.key]?.[styleKey];
          return tier === 'signature' || tier === 'strong';
        });
        const styleChips = chipworthyStyles.length > 0 && (
          <div className="style-chip-row">
            {chipworthyStyles.map((styleKey) => (
              <span key={styleKey} className="style-chip">
                {getStyleLabel(r.slider.key, styleKey)}
              </span>
            ))}
          </div>
        );
        if (r.isNA) {
          return (
            <div key={r.slider.key}>
              <div className="breakdown-row breakdown-row-na">
                <span>{r.slider.icon}</span>
                <span>{r.slider.label}</span>
                <div className="breakdown-track" />
                <span>N/A</span>
              </div>
              {styleChips}
            </div>
          );
        }
        const tier = matchReasonTier(r.score);
        return (
          <div key={r.slider.key}>
            <div className={`breakdown-row${highlight ? ` breakdown-row-${tier.cls}` : ''}`}>
              <span>{r.slider.icon}</span>
              <span>{r.slider.label}</span>
              <div className="breakdown-track">
                <div className="breakdown-fill" style={{ width: `${r.score * 10}%`, background: barColor(r.score) }} />
              </div>
              <span>{r.score.toFixed(1)}</span>
            </div>
            {styleChips}
          </div>
        );
      })}
    </div>
  );
}
