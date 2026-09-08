import { useState } from 'react';
import { MONTH_NAMES, MONTH_SHORT } from '@/lib/scoring/constants';
import { matchLabel, barColor, smoothedMonthlyDisplay } from '@/lib/scoring/rank';
import type { SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import { rankedBreakdownSliders, specialistHighlight, topWeightStatus } from '@/lib/scoring/breakdown';
import { explainMatch } from '@/lib/scoring/matchExplainer';
import type { ScoredDestination } from '@/lib/scoring/types';
import { MatchExplainer } from './MatchExplainer';

/**
 * "For You" tab — reuses rankedBreakdownSliders (the same weighting logic
 * behind every ranking in this app) for the interest list, and
 * dest.monthly (the real per-slider monthly scores) for the personalized
 * best-months chart — displayed through smoothedMonthlyDisplay so a
 * flag-driven flat run (e.g. every "worst" month scoring identically)
 * doesn't plot as an obviously synthetic plateau; the underlying ranking
 * math this tab's own match score comes from is untouched. Nothing here
 * is a new scoring concept.
 */
export function ForYouTab({
  dest,
  weights,
  bands,
  selectedStyles,
  monthIdx,
  score,
  selectedCategory,
  onSelectCategory,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  monthIdx: number;
  score: number;
  selectedCategory: string | null;
  onSelectCategory: (key: string) => void;
}) {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const ranked = rankedBreakdownSliders(dest, weights, monthIdx, selectedStyles);
  const match = matchLabel(score);
  const explanation = explainMatch(dest, weights, monthIdx, bands, selectedStyles);
  const hasExplanation = explanation.pros.length > 0 || explanation.cons.length > 0;
  // Still used for the default drill-down target and its "top interest"
  // wording below — a separate concern from the match-explainer box above.
  const highlight = specialistHighlight(dest, weights, monthIdx, selectedStyles);
  const defaultKey = highlight?.slider.key ?? ranked[0]?.slider.key ?? null;
  const effectiveKey = selectedCategory ?? defaultKey;
  const effective = ranked.find((r) => r.slider.key === effectiveKey) ?? ranked[0];

  return (
    <div className="detail-tab-content">
      <div className="match-card">
        <div>
          <div className="match-card-eyebrow">Your match for {MONTH_NAMES[monthIdx]}</div>
          <div className={`match-card-label score-${match.cls}`}>{match.text}</div>
        </div>
        <div className="match-score-wrap">
          <div className={`match-card-score score-${match.cls}`}>{score.toFixed(1)}</div>
          {hasExplanation && (
            <button type="button" className="match-info-btn" aria-label="Why this score" onClick={() => setExplainerOpen((v) => !v)}>
              i
            </button>
          )}
        </div>
      </div>

      {explainerOpen && hasExplanation && <MatchExplainer explanation={explanation} />}

      {ranked.length > 0 && (
        <>
          <div className="detail-section-title">Your interests, ranked by what matters most to you</div>
          <div className="detail-section-hint">Tap any interest to see its best months below.</div>
          <div className="interest-list">
            {ranked.map((r) => {
              const isSelected = r.slider.key === effectiveKey;
              return (
                <div
                  key={r.slider.key}
                  className={`interest-row${isSelected ? ' interest-row-selected' : ''}`}
                  onClick={() => onSelectCategory(r.slider.key)}
                >
                  <span className="interest-icon">{r.slider.icon}</span>
                  <span className={`interest-label${isSelected ? ' interest-label-selected' : ''}`}>{r.slider.label}</span>
                  <div className="interest-track">
                    {!r.isNA && (
                      <div className="interest-fill" style={{ width: `${r.score * 10}%`, background: barColor(r.score) }} />
                    )}
                  </div>
                  <span className={`interest-score${r.isNA ? ' interest-score-na' : ''}`}>{r.isNA ? 'N/A' : r.score.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {effective && !effective.isNA && (
        <>
          <div className="detail-section-title">Best months for {effective.slider.label}</div>
          <div className="detail-section-hint">
            {(() => {
              const topStatus = effective ? topWeightStatus(effective.slider.key, weights) : { isTop: false, tied: false };
              if (!topStatus.isTop) return 'Personalized timing for this interest. Tap another above to compare.';
              return topStatus.tied
                ? 'A top interest — personalized timing, not general weather.'
                : 'Your top interest — personalized timing, not general weather.';
            })()}
          </div>
          <div className="months-chart">
            {dest.monthly[effective.slider.key].map((_, i) => {
              const v = smoothedMonthlyDisplay(dest, effective.slider.key, i);
              return (
                <div key={i} className="months-chart-bar-wrap">
                  <div className="months-chart-bar" style={{ height: `${Math.max(4, v * 10)}%`, background: barColor(v) }} />
                </div>
              );
            })}
          </div>
          <div className="months-chart-labels">
            {MONTH_SHORT.map((m, i) => (
              <span key={i} className={`months-chart-label${i === monthIdx ? ' months-chart-label-active' : ''}`}>
                {m[0]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
