import { useEffect, useRef, useState } from 'react';
import { MONTH_NAMES, MONTH_SHORT } from '@/lib/scoring/constants';
import { matchLabel, barColor, smoothedMonthlyDisplay, scoreForMonth, styleAdjustedScore } from '@/lib/scoring/rank';
import type { SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import { topInterestChips } from '@/lib/scoring/breakdown';
import { matchAdjustments } from '@/lib/scoring/matchExplainer';
import type { MatchAdjustment } from '@/lib/scoring/matchExplainer';
import { isSliderNA } from '@/lib/scoring/destinations';
import type { ScoredDestination } from '@/lib/scoring/types';
import { InterestChip, shortInterestLabel } from './InterestChip';
import { prefersReducedMotion } from './useResortDemo';

// The place-card open sequence (plays every time, on every card — see the
// "Place Card Open, Two Ways" mockup, version B): interest pills arrive
// already visible but bare, the traveller's #1 interest pops itself open,
// then every chip's score lands together right as the content below
// appears. A real tap on any chip before it finishes takes over immediately
// rather than making the person wait out the rest of the script. "My
// Interests" is the one that opens by default now (see below), not the
// traveller's top interest.
const REVEAL_TOP_CHIP_MS = 500;
const REVEAL_SCORES_MS = 760;
const REVEAL_CONTENT_MS = 810;
type RevealStage = 0 | 1 | 2 | 3;

/** Lowercases a reason's leading letter so it reads as a clause: "Pricier than you want" -> "pricier than you want". */
function lowerFirst(s: string): string {
  return s.length ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function joinReasons(reasons: MatchAdjustment[]): string {
  return reasons.map((r) => lowerFirst(r.label)).join(' and ');
}

/**
 * "For You" tab. A chip per top interest, led by "My Interests" — selected by default, matching
 * the results-list header's own chip of the same name. Selecting "My Interests" shows a combined,
 * computed month-by-month score (see DnaDetail); selecting any other chip shows that interest's
 * own authored blurb and month chart (see InterestDetail), same as before.
 *
 * Everything here is computed for `previewIdx`, the month being previewed inside this card. That
 * is separate from the app's search month: changing it moves every score, every chip bubble, and
 * the month card, but never re-sorts the results list behind the sheet. Nothing here is a new
 * scoring concept: scoreForMonth for the combined score, styleAdjustedScore for each interest.
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
  /** null selects "My Interests" — the combined view, not "nothing chosen yet". */
  selectedCategory: string | null;
  onSelectCategory: (key: string | null) => void;
}) {
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

  // Tapping a month while "My Interests" is selected contracts every chip
  // to bare icon+score (see the InterestChip `active` props below) so the
  // whole row reads as a comparable strip of numbers instead of one chip
  // sitting open with a label. Picking any chip — including tapping back to
  // "My Interests" itself — clears it, the same way a real tap always wins
  // over the open-sequence script below.
  const [comparing, setComparing] = useState(false);

  function handleSelectCategory(key: string | null) {
    if (stage < 3) {
      revealTimers.current.forEach(clearTimeout);
      setStage(3);
    }
    setComparing(false);
    onSelectCategory(key);
  }

  function handleChangeMonth(idx: number) {
    if (selectedCategory === null) setComparing(true);
    onChangeMonth(idx);
  }

  const score = scoreForMonth(dest, weights, previewIdx, bands, selectedStyles);

  const chips = topInterestChips(weights).map((slider) => ({
    slider,
    isNA: isSliderNA(dest, slider.key),
    score: styleAdjustedScore(dest, slider.key, previewIdx, selectedStyles),
  }));
  const isDnaSelected = selectedCategory === null;
  const selectedChip = isDnaSelected ? null : (chips.find((c) => c.slider.key === selectedCategory) ?? null);

  return (
    <div className="detail-tab-content">
      {chips.length > 0 && (
        <>
          <div className="detail-section-title interest-chips-title">Your top interests · Tap to compare</div>
          <div className="interest-chip-row-wrap">
            <div className="interest-chip-row">
              <InterestChip
                emoji="🧬"
                label="My Interests"
                active={stage >= 1 && !comparing && isDnaSelected}
                score={stage >= 2 ? score : undefined}
                bubblePop
                onClick={() => handleSelectCategory(null)}
              />
              {chips.map((c) => (
                <InterestChip
                  key={c.slider.key}
                  emoji={emojiOverrides[c.slider.key] ?? c.slider.icon}
                  label={shortInterestLabel(c.slider.label)}
                  fullLabel={c.slider.label}
                  active={stage >= 1 && !comparing && c.slider.key === selectedCategory}
                  score={stage >= 2 ? (c.isNA ? null : c.score) : undefined}
                  bubblePop
                  onClick={() => handleSelectCategory(c.slider.key)}
                />
              ))}
            </div>
            <div className="interest-chip-row-fade" aria-hidden />
          </div>

          {stage >= 3 &&
            (isDnaSelected ? (
              <DnaDetail dest={dest} weights={weights} bands={bands} selectedStyles={selectedStyles} previewIdx={previewIdx} onChangeMonth={handleChangeMonth} />
            ) : (
              selectedChip && (
                <InterestDetail
                  dest={dest}
                  row={selectedChip}
                  icon={emojiOverrides[selectedChip.slider.key] ?? selectedChip.slider.icon}
                  previewIdx={previewIdx}
                  onChangeMonth={handleChangeMonth}
                />
              )
            ))}
        </>
      )}
    </div>
  );
}

/**
 * "My Interests" selected: a combined score for every month (scoreForMonth run 12 times, the same
 * function the match score and results list already use) instead of one interest's own chart. The
 * explanation is built from real numbers, never authored — it names the one real final score, then
 * says whether an Open To filter is actually pulling it down, reusing the exact reason text
 * matchAdjustments already builds for the filter chips so the wording can't drift between the two.
 */
function DnaDetail({
  dest,
  weights,
  bands,
  selectedStyles,
  previewIdx,
  onChangeMonth,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  previewIdx: number;
  onChangeMonth: (monthIdx: number) => void;
}) {
  const months = Array.from({ length: 12 }, (_, i) => scoreForMonth(dest, weights, i, bands, selectedStyles));
  const score = months[previewIdx];
  const quality = matchLabel(score);
  const badReasons = matchAdjustments(dest, previewIdx, bands).filter((a) => a.tone === 'bad');

  let sentence = `${MONTH_NAMES[previewIdx]}’s match score of ${score.toFixed(1)} is based on your combined top interests`;
  if (badReasons.length > 0) sentence += `, then adjusted lower because it’s ${joinReasons(badReasons)}`;
  sentence += '.';

  return (
    <div className="interest-detail">
      <div className="interest-detail-heading">
        <span className="interest-detail-icon" aria-hidden="true">
          🧬
        </span>
        My Interests
      </div>
      <p className="dna-sentence">{sentence}</p>
      <p className="dna-hint">Tap any interest above to learn more.</p>
      <p className="dna-hint">Tap any month on the chart below to see how it compares.</p>
      <div className="detail-section-title interest-detail-months-title">Combined match by month · Tap to compare</div>
      <div className="months-chart">
        {months.map((v, i) => (
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
        ))}
      </div>
      <div className="months-chart-labels">
        {MONTH_SHORT.map((m, i) => (
          <span key={i} className={`months-chart-label${i === previewIdx ? ' months-chart-label-active' : ''}`} onClick={() => onChangeMonth(i)}>
            {m[0]}
          </span>
        ))}
      </div>
      <div className="month-detail-card month-detail-card-scored">
        <div className="month-detail-top">
          <div className="month-detail-text">
            <div className="month-detail-name">Your combined match in {MONTH_NAMES[previewIdx]}</div>
            <div className={`month-detail-quality score-${quality.cls}`}>{quality.text}</div>
          </div>
          <div className={`month-detail-score score-${quality.cls}`}>{score.toFixed(1)}</div>
        </div>
      </div>
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
      {slider.label} in {dest.name}
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
          <div className="month-detail-text">
            <div className="month-detail-name">
              {slider.label} in {dest.name} in {MONTH_NAMES[previewIdx]}
            </div>
            <div className={`month-detail-quality score-${monthQuality.cls}`}>{monthQuality.text}</div>
          </div>
          <div className={`month-detail-score score-${monthQuality.cls}`}>{score.toFixed(1)}</div>
        </div>
        {monthBlurb && <p className="card-monthly-blurb">{monthBlurb}</p>}
      </div>
    </div>
  );
}
