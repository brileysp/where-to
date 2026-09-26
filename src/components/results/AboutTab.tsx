import { MONTH_SHORT, MONTH_NAMES } from '@/lib/scoring/constants';
import { scoreLabel, timingScoreForMonth, barColor } from '@/lib/scoring/rank';
import { generateMonthlyBlurb } from '@/lib/scoring/blurb';
import type { ScoredDestination } from '@/lib/scoring/types';

/**
 * "About" tab — general (not personalized) timing, reusing
 * timingScoreForMonth/scoreLabel/generateMonthlyBlurb exactly as the
 * results card already does. "Good to know" (visa/flight/language) is
 * deliberately omitted — no such fields exist in the schema yet, and
 * placeholder text would be worse than not showing the section.
 */
export function AboutTab({
  dest,
  generalMonthIdx,
  onSelectGeneralMonth,
}: {
  dest: ScoredDestination;
  generalMonthIdx: number;
  onSelectGeneralMonth: (i: number) => void;
}) {
  // Badges must track whichever month is actually selected in this tab's
  // own chart below (generalMonthIdx, which is the sheet's preview month), not the app's search
  // month — otherwise tapping a different month here leaves a stale badge from
  // wherever the month picker happens to be pointed, showing
  // e.g. a "Rainy season" pill next to a description of a dry month.
  const badges = dest.badges[generalMonthIdx];
  const generalScores = Array.from({ length: 12 }, (_, i) => timingScoreForMonth(dest, i));
  const selectedLabel = scoreLabel(generalScores[generalMonthIdx]);
  const blurb = generateMonthlyBlurb(dest, generalMonthIdx + 1);

  return (
    <div className="detail-tab-content">
      <div className="detail-card">
        <p className="about-text">{dest.overview ?? dest.about}</p>
        {dest.overview && <p className="season-line">{dest.about}</p>}
      </div>

      <div className="detail-card">
        <div className="detail-section-title">Best months overall · Tap to compare</div>
        <div className="months-chart months-chart-compact">
          {generalScores.map((v, i) => (
            <div
              key={i}
              className={`months-chart-bar-wrap${i === generalMonthIdx ? ' months-chart-bar-wrap-selected' : ''}`}
              onClick={() => onSelectGeneralMonth(i)}
            >
              <div className="months-chart-bar" style={{ height: `${Math.max(4, v * 10)}%`, background: barColor(v) }} />
            </div>
          ))}
        </div>
        <div className="months-chart-labels">
          {MONTH_SHORT.map((m, i) => (
            <span
              key={i}
              className={`months-chart-label${i === generalMonthIdx ? ' months-chart-label-active' : ''}`}
              onClick={() => onSelectGeneralMonth(i)}
            >
              {m[0]}
            </span>
          ))}
        </div>

        <div className="month-detail-card">
          <div className="month-detail-name">{MONTH_NAMES[generalMonthIdx]}</div>
          <div className={`month-detail-quality score-${selectedLabel.cls}`}>{selectedLabel.text}</div>
          {badges.length > 0 && (
            <div className="detail-badges">
              {badges.map((b, i) => (
                <span key={i} className={`badge badge-${b.tone}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
          <div className="card-monthly-blurb" dangerouslySetInnerHTML={{ __html: blurb }} />
        </div>
      </div>
    </div>
  );
}
