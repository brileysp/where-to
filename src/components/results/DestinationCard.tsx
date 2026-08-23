import { forwardRef, useState } from 'react';
import { MONTH_NAMES, NEUTRAL_WEIGHTS } from '@/lib/scoring/constants';
import { matchLabel, scoreForMonth, scoreLabel } from '@/lib/scoring/rank';
import type { SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import { defaultHighlightCount, rankedBreakdownSliders } from '@/lib/scoring/breakdown';
import { generateMonthlyBlurb } from '@/lib/scoring/blurb';
import { costItemIcon } from '@/lib/scoring/costIcons';
import type { ScoredDestination } from '@/lib/scoring/types';
import { Breakdown } from './Breakdown';
import { YearStrip } from './YearStrip';

interface Props {
  dest: ScoredDestination;
  rank: number;
  score: number;
  month: number;
  weights: Record<string, number>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  isBreakdownExpanded: boolean;
  previewMonth: number;
  onYearBarClick: (m: number) => void;
  onToggleBreakdown: () => void;
  highlighted: boolean;
}

/**
 * The year strip is the primary control for this card, not a decorative
 * chart — badges/blurb/sliders below it always reflect `previewMonth`
 * (which defaults to the app's chosen `month`). There's no separate
 * "primary" vs "alt month" content block anymore: switching months just
 * re-renders this one section in place, so there's never anything new to
 * scroll for, and the alt month gets the exact same expandable slider list
 * as the default one.
 */
/** Whole dollars render bare ($75); anything with cents keeps two decimals
 * rather than silently rounding an author's real price. */
function formatPrice(price: number): string {
  return Number.isInteger(price)
    ? price.toLocaleString('en-US')
    : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const DestinationCard = forwardRef<HTMLElement, Props>(function DestinationCard(
  {
    dest,
    rank,
    score,
    month,
    weights,
    bands,
    selectedStyles,
    isBreakdownExpanded,
    previewMonth,
    onYearBarClick,
    onToggleBreakdown,
    highlighted,
  },
  ref,
) {
  const [activeTab, setActiveTab] = useState<'about' | 'cost'>('about');

  const previewMonthIdx = previewMonth - 1;
  const isPreviewingAlt = previewMonth !== month;
  // `score` is already computed for `month` by the parent (it's what the
  // list is ranked on) — only recompute when previewing a different month.
  const displayScore = isPreviewingAlt ? scoreForMonth(dest, weights, previewMonthIdx, bands, selectedStyles) : score;
  const match = matchLabel(displayScore);
  // Neutral-weighted, independent of this user's picks — so the timing
  // verdict stays true ("April is great in Japan") even when the
  // personalized match score is low (a beach-only profile scores Japan
  // poorly regardless of month). See NEUTRAL_WEIGHTS.
  const timingScore = scoreForMonth(dest, NEUTRAL_WEIGHTS, previewMonthIdx, bands);
  const timing = scoreLabel(timingScore);
  const badges = dest.badges[previewMonthIdx];
  const monthlyBlurb = generateMonthlyBlurb(dest, previewMonth);
  const ranked = rankedBreakdownSliders(dest, weights, previewMonthIdx, selectedStyles);
  const highlightCount = defaultHighlightCount(weights);
  const hasMore = ranked.length > highlightCount;
  // Only worth a dedicated About/Cost tab block when there's something
  // beyond the season-line paragraph below to show — otherwise this would
  // just repeat `dest.about` a second time for the ~142 destinations not
  // yet backfilled with overview/costRange content.
  const showAboutCostTabs = Boolean(dest.overview || dest.costRange);
  // The season-line only makes sense as About-tab content now (it's
  // "when/why seasons matter", not "what does this cost") — for
  // destinations without a real `overview` yet, `about-text` already
  // falls back to `dest.about`, so showing it a second time here would
  // just duplicate that fallback.
  const showSeasonLineWithAbout = Boolean(dest.overview);

  return (
    <article ref={ref} className={`card${highlighted ? ' card-search-highlight' : ''}`} data-dest-id={dest.id}>
      <div className="card-top">
        <div className="card-rank">#{rank}</div>
        <div className="card-name-wrap">
          <div className="card-name">
            {dest.emoji} {dest.name}
          </div>
          <div className="card-region">{dest.region}</div>
        </div>
      </div>

      {showAboutCostTabs &&
        (dest.costRange ? (
          <div className="card-tabs">
            <div className="tabs">
              <button
                type="button"
                className={`tab-btn${activeTab === 'about' ? ' active' : ''}`}
                onClick={() => setActiveTab('about')}
              >
                About
              </button>
              <button
                type="button"
                className={`tab-btn tab-btn-cost${activeTab === 'cost' ? ' active' : ''}`}
                onClick={() => setActiveTab('cost')}
              >
                {dest.costRange.min}–{dest.costRange.max}
              </button>
            </div>
            {activeTab === 'about' ? (
              <>
                <p className="about-text">{dest.overview ?? dest.about}</p>
                {showSeasonLineWithAbout && <p className="season-line">{dest.about}</p>}
              </>
            ) : (
              <>
                {dest.costOverview && <p className="cost-overview-text">{dest.costOverview}</p>}
                <div className="price-list">
                  {dest.costItems.map((item, i) => (
                    <div className="price-row" key={i}>
                      <span className="price-item">
                        <span className="price-icon">{costItemIcon(item.label)}</span>
                        {item.label}
                        {item.unit ? `, ${item.unit}` : ''}
                      </span>
                      <span className="price-val">${formatPrice(item.price)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="about-text">{dest.overview}</p>
            <p className="season-line">{dest.about}</p>
          </>
        ))}

      {!showAboutCostTabs && <p className="season-line">{dest.about}</p>}

      <div className="card-month-label">Tap any month to compare</div>
      <YearStrip
        dest={dest}
        weights={weights}
        bands={bands}
        baseMonth={month}
        previewMonth={previewMonth}
        onBarClick={onYearBarClick}
      />

      <div className="month-zone">
        <div className="month-head">
          <div className="month-head-left">
            <span className={`month-name${isPreviewingAlt ? ' previewing' : ''}`}>
              {MONTH_NAMES[previewMonthIdx]}
              {isPreviewingAlt && (
                <button
                  type="button"
                  className="month-name-reset"
                  onClick={() => onYearBarClick(month)}
                  aria-label="Reset to your month"
                >
                  ↺
                </button>
              )}
            </span>
            <div className={`timing-label score-${timing.cls}`}>{timing.text}</div>
          </div>
          <div className={`card-score score-${match.cls}`}>
            <div className="card-score-eyebrow">Your match</div>
            <div className="card-score-num">{displayScore.toFixed(1)}</div>
            <span className="card-score-text">{match.text}</span>
          </div>
        </div>

        <div className="card-badges">
          {badges.map((b, i) => (
            <span key={i} className={`badge badge-${b.tone}`}>
              {b.label}
            </span>
          ))}
        </div>

        <div className="card-monthly-blurb" dangerouslySetInnerHTML={{ __html: monthlyBlurb }} />

        <div className="card-breakdown-slot">
          <Breakdown
            dest={dest}
            weights={weights}
            monthIdx={previewMonthIdx}
            expanded={isBreakdownExpanded}
            highlightCount={highlightCount}
            selectedStyles={selectedStyles}
          />
        </div>
        {hasMore && (
          <button type="button" className="breakdown-toggle-btn" onClick={onToggleBreakdown}>
            {isBreakdownExpanded ? 'Show fewer ▲' : `Show ${ranked.length - highlightCount} more ▾`}
          </button>
        )}
      </div>
    </article>
  );
});
