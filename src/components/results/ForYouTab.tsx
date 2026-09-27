import { useEffect, useRef, useState } from 'react';
import { MONTH_NAMES, MONTH_SHORT, allBandsSelected } from '@/lib/scoring/constants';
import { matchLabel, barColor, smoothedMonthlyDisplay, scoreForMonth, styleAdjustedScore, bandPenalty } from '@/lib/scoring/rank';
import type { SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import { topInterestChips } from '@/lib/scoring/breakdown';
import { matchAdjustments } from '@/lib/scoring/matchExplainer';
import { isSliderNA } from '@/lib/scoring/destinations';
import type { ScoredDestination } from '@/lib/scoring/types';
import { InterestChip, shortInterestLabel } from './InterestChip';
import { prefersReducedMotion } from './useResortDemo';

// The place-card open sequence (plays every time, on every card — see the
// "Place Card Open, Two Ways" mockup, version B): interest pills arrive
// already visible but bare, the traveller's #1 interest pops itself open,
// then every chip's score lands together right as the detail content below
// appears. A real tap on any chip before it finishes takes over immediately
// rather than making the person wait out the rest of the script.
const REVEAL_TOP_CHIP_MS = 500;
const REVEAL_SCORES_MS = 760;
const REVEAL_CONTENT_MS = 810;
type RevealStage = 0 | 1 | 2 | 3;

/**
 * "For You" tab. The match card leads (with a note behind its (i) explaining what the Open To
 * filters did to the score), then one chip per top interest, then the selected interest's detail:
 * its text, a twelve-month chart, and the selected month's score and text.
 *
 * Everything here is computed for `previewIdx`, the month being previewed inside this card. That
 * is separate from the app's search month: changing it moves the match score, every chip score and
 * the month card, but never re-sorts the results list behind the sheet. Nothing here is a new
 * scoring concept: scoreForMonth for the match, styleAdjustedScore for each interest.
 */
export function ForYouTab({
  dest,
  weights,
  emojiOverrides,
  bands,
  selectedStyles,
  previewIdx,
  onChangeMonth,
  selectedCategory,
  onSelectCategory,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  /** Admin-set emoji overrides, keyed by slider key — falls back to the slider's own code-defined icon. */
  emojiOverrides: Record<string, string>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  previewIdx: number;
  onChangeMonth: (monthIdx: number) => void;
  selectedCategory: string | null;
  onSelectCategory: (key: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);

  // Runs once per place-card open: this component remounts fresh every time
  // (DestinationDetailSheet keys the whole sheet by destination id), so a
  // plain mount effect is enough — no dest-id bookkeeping needed here.
  const [stage, setStage] = useState<RevealStage>(prefersReducedMotion() ? 3 : 0);
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    revealTimers.current = [
      setTimeout(() => setStage(1), REVEAL_TOP_CHIP_MS),
      setTimeout(() => setStage(2), REVEAL_SCORES_MS),
      setTimeout(() => setStage(3), REVEAL_CONTENT_MS),
    ];
    return () => revealTimers.current.forEach(clearTimeout);
  }, []);

  function handleSelectCategory(key: string) {
    // A real tap wins over the script — jump straight to the settled state
    // instead of leaving the person waiting for chips to catch up to what
    // they already did.
    if (stage < 3) {
      revealTimers.current.forEach(clearTimeout);
      setStage(3);
    }
    onSelectCategory(key);
  }

  const score = scoreForMonth(dest, weights, previewIdx, bands, selectedStyles);
  const match = matchLabel(score);

  // What the Open To filters did: the reasons, and (when a filter took something off) the score without them.
  const adjustments = matchAdjustments(dest, previewIdx, bands);
  const filtersCostScore = bandPenalty(dest, previewIdx, bands) < 1;
  const scoreWithoutFilters = filtersCostScore ? scoreForMonth(dest, weights, previewIdx, allBandsSelected(), selectedStyles) : score;

  const chips = topInterestChips(weights).map((slider) => ({
    slider,
    isNA: isSliderNA(dest, slider.key),
    score: styleAdjustedScore(dest, slider.key, previewIdx, selectedStyles),
  }));
  // Your #1 interest is selected first, wherever it scores this month.
  const effectiveKey = selectedCategory ?? chips[0]?.slider.key ?? null;
  const selected = chips.find((c) => c.slider.key === effectiveKey) ?? chips[0];

  return (
    <div className="detail-tab-content">
      <div className="match-card">
        <div className="match-card-top">
          <div>
            <div className="match-card-eyebrow">
              <span className="match-card-dna" aria-hidden="true">
                🧬
              </span>
              Your match for {MONTH_NAMES[previewIdx]}
            </div>
            <div className={`match-card-label score-${match.cls}`}>{match.text}</div>
          </div>
          <div className="match-score-wrap">
            <div className={`match-card-score score-${match.cls}`}>{score.toFixed(1)}</div>
            {adjustments.length > 0 && (
              <button
                type="button"
                className="match-info-btn"
                aria-label="Why this score"
                aria-expanded={noteOpen}
                onClick={() => setNoteOpen((v) => !v)}
              >
                i
              </button>
            )}
          </div>
        </div>
        {noteOpen && adjustments.length > 0 && (
          <div className="match-card-note">
            Based on your combined interests, then adjusted for being{' '}
            {adjustments.map((a) => (
              <span key={a.key} className={`match-adjust-chip ${a.tone}`}>
                <span aria-hidden="true">{a.icon}</span> {a.label}
              </span>
            ))}
            {filtersCostScore && (
              <span className="match-adjust-numbers">
                <b>{scoreWithoutFilters.toFixed(1)}</b> → <b>{score.toFixed(1)}</b>
              </span>
            )}
          </div>
        )}
      </div>

      {chips.length > 0 && selected && (
        <>
          <div className="detail-section-title interest-chips-title">Your top interests · Tap to compare</div>
          <div className="interest-chip-row-wrap">
            <div className="interest-chip-row">
              {chips.map((c) => (
                <InterestChip
                  key={c.slider.key}
                  emoji={emojiOverrides[c.slider.key] ?? c.slider.icon}
                  label={shortInterestLabel(c.slider.label)}
                  fullLabel={c.slider.label}
                  active={stage >= 1 && c.slider.key === selected.slider.key}
                  score={stage >= 2 ? (c.isNA ? null : c.score) : undefined}
                  bubblePop
                  onClick={() => handleSelectCategory(c.slider.key)}
                />
              ))}
            </div>
            <div className="interest-chip-row-fade" aria-hidden />
          </div>

          {stage >= 3 && (
            <InterestDetail
              dest={dest}
              row={selected}
              icon={emojiOverrides[selected.slider.key] ?? selected.slider.icon}
              previewIdx={previewIdx}
              onChangeMonth={onChangeMonth}
            />
          )}
        </>
      )}
    </div>
  );
}

function InterestDetail({
  dest,
  row,
  icon,
  previewIdx,
  onChangeMonth,
}: {
  dest: ScoredDestination;
  row: { slider: { key: string; icon: string; label: string }; isNA: boolean; score: number };
  /** Resolved icon (admin override already applied) — don't read row.slider.icon directly here. */
  icon: string;
  previewIdx: number;
  onChangeMonth: (monthIdx: number) => void;
}) {
  const { slider, isNA, score } = row;
  const heading = (
    <div className="interest-detail-heading">
      <span className="interest-detail-icon">{icon}</span>
      {slider.label}
    </div>
  );
  if (isNA) {
    return (
      <div className="interest-detail">
        {heading}
        <p className="interest-place-blurb">Not available here.</p>
      </div>
    );
  }

  const placeBlurb = dest.sliderOverview[slider.key];
  const monthBlurb = dest.sliderMonthlyWeather[slider.key]?.[previewIdx];
  const monthQuality = matchLabel(score);

  return (
    <div className="interest-detail">
      {heading}
      {placeBlurb && <p className="interest-place-blurb">{placeBlurb}</p>}
      <div className="detail-section-title interest-detail-months-title">{shortInterestLabel(slider.label)} by month · Tap to compare</div>
      <div className="months-chart">
        {dest.monthly[slider.key].map((_, i) => {
          const v = smoothedMonthlyDisplay(dest, slider.key, i);
          return (
            <button
              type="button"
              key={i}
              className={`months-chart-bar-wrap${i === previewIdx ? ' months-chart-bar-wrap-selected' : ''}`}
              aria-label={`${MONTH_NAMES[i]}, ${v.toFixed(1)}`}
              aria-pressed={i === previewIdx}
              onClick={() => onChangeMonth(i)}
            >
              <span className="months-chart-bar" style={{ height: `${Math.max(4, v * 10)}%`, background: barColor(v) }} />
            </button>
          );
        })}
      </div>
      <div className="months-chart-labels">
        {MONTH_SHORT.map((m, i) => (
          <span
            key={i}
            className={`months-chart-label${i === previewIdx ? ' months-chart-label-active' : ''}`}
            onClick={() => onChangeMonth(i)}
          >
            {m[0]}
          </span>
        ))}
      </div>
      <div className="month-detail-card month-detail-card-scored">
        <div className="month-detail-top">
          <div>
            <div className="month-detail-name">{MONTH_NAMES[previewIdx]}</div>
            <div className={`month-detail-quality score-${monthQuality.cls}`}>{monthQuality.text}</div>
          </div>
          <div className={`month-detail-score score-${monthQuality.cls}`}>{score.toFixed(1)}</div>
        </div>
        {monthBlurb && <p className="card-monthly-blurb">{monthBlurb}</p>}
      </div>
    </div>
  );
}
