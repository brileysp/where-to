import { useUnitText } from '@/components/UnitsProvider';
import { useEffect, useRef, useState } from 'react';
import { MONTH_NAMES, MONTH_SHORT, SLIDERS } from '@/lib/scoring/constants';
import { matchLabel, barColor, smoothedMonthlyDisplay, adjustedScoreForMonth, styleAdjustedScore, effectiveWeights } from '@/lib/scoring/rank';
import type { InterestFactors, PlaceAdjust, SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import { CARE_NOTE_KEY } from '@/lib/onboarding/care-match';
import type { PlaceNote } from '@/lib/onboarding/live-factors';
import { topInterestChips } from '@/lib/scoring/breakdown';
import { matchAdjustments } from '@/lib/scoring/matchExplainer';
import type { MatchAdjustment } from '@/lib/scoring/matchExplainer';
import { isSliderNA } from '@/lib/scoring/destinations';
import type { ScoredDestination } from '@/lib/scoring/types';
import { InterestChip, shortInterestLabel } from './InterestChip';
import { prefersReducedMotion } from './useResortDemo';
import { splitEmphasis } from '@/lib/text/emphasis';

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
 * scoring concept: adjustedScoreForMonth (the list's own number) for the combined score, styleAdjustedScore for each interest.
 */
export function ForYouTab({
  dest,
  weights,
  emojiOverrides,
  shortNames,
  bands,
  selectedStyles,
  previewIdx,
  onChangeMonth,
  selectedCategory,
  onSelectCategory,
  factors,
  adjust,
  searchIdx,
  notes,
  interestKeys,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  /** Admin-set emoji overrides, keyed by slider key — falls back to the slider's own code-defined icon. */
  emojiOverrides: Record<string, string>;
  /** Admin-set pill names, keyed by slider key — falls back to the automatic short name. */
  shortNames: Record<string, string>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  previewIdx: number;
  onChangeMonth: (monthIdx: number) => void;
  /** null selects "My Interests" — the combined view, not "nothing chosen yet". */
  selectedCategory: string | null;
  onSelectCategory: (key: string | null) => void;
  /** What the traveler's chips and answers keep of this place's score, by interest (onboarding's live questions). Missing = nothing changes. */
  factors?: InterestFactors;
  /** What the list does to this place beyond the month's own score (season leaning, trip length, what else matters), so the numbers here match the list's. */
  adjust?: PlaceAdjust;
  /** The traveler's month (0 = January), for a trip over several months. */
  searchIdx?: number;
  /** This place's reasons and matches by interest, for the notes under the chips. */
  notes?: Record<string, PlaceNote>;
  /** Show exactly these interests as chips (the ones the traveler picked) instead of working them out from the weights. */
  interestKeys?: string[];
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

  const score = adjustedScoreForMonth(dest, weights, previewIdx, bands, selectedStyles, factors, adjust, searchIdx);
  const placeFactor = (key: string) => factors?.[dest.id]?.[key] ?? 1;

  const chipSliders = interestKeys ? interestKeys.flatMap((k) => SLIDERS.filter((x) => x.key === k)) : topInterestChips(weights);
  const chips = chipSliders.map((slider) => ({
    slider,
    isNA: isSliderNA(dest, slider.key),
    score: styleAdjustedScore(dest, slider.key, previewIdx, selectedStyles) * placeFactor(slider.key),
  }));
  const isDnaSelected = selectedCategory === null;
  const selectedChip = isDnaSelected ? null : (chips.find((c) => c.slider.key === selectedCategory) ?? null);

  return (
    <div className="detail-tab-content">
      {chips.length > 0 && (
        <>
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
                  label={shortInterestLabel(c.slider.label, shortNames[c.slider.key])}
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
              <DnaDetail dest={dest} weights={weights} bands={bands} selectedStyles={selectedStyles} factors={factors} adjust={adjust} searchIdx={searchIdx} notes={notes} emojiOverrides={emojiOverrides} previewIdx={previewIdx} onChangeMonth={handleChangeMonth} />
            ) : (
              selectedChip && (
                <InterestDetail
                  dest={dest}
                  row={selectedChip}
                  icon={emojiOverrides[selectedChip.slider.key] ?? selectedChip.slider.icon}
                  shortName={shortInterestLabel(selectedChip.slider.label, shortNames[selectedChip.slider.key])}
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
  factors,
  adjust,
  searchIdx,
  notes,
  emojiOverrides,
  previewIdx,
  onChangeMonth,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  factors?: InterestFactors;
  adjust?: PlaceAdjust;
  searchIdx?: number;
  notes?: Record<string, PlaceNote>;
  emojiOverrides: Record<string, string>;
  previewIdx: number;
  onChangeMonth: (monthIdx: number) => void;
}) {
  const months = Array.from({ length: 12 }, (_, i) => adjustedScoreForMonth(dest, weights, i, bands, selectedStyles, factors, adjust, searchIdx));
  const score = months[previewIdx];
  const quality = matchLabel(score);
  const badReasons = matchAdjustments(dest, previewIdx, bands).filter((a) => a.tone === 'bad');

  // Said only when something lowered the score (owner pick, 22 Nov 2026); otherwise the summary line below says it all.
  const lowered = badReasons.length > 0 ? `Adjusted lower because it’s ${joinReasons(badReasons)}.` : null;

  return (
    <div className="interest-detail">
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
      <div className="dna-summary">
        <span className={`dna-summary-score score-${quality.cls}`}>{score.toFixed(1)}</span>
        <b className={`score-${quality.cls}`}>{quality.text}</b>
        <span className="dna-summary-month">{MONTH_NAMES[previewIdx]}</span>
      </div>
      {lowered && <p className="dna-sentence">{lowered}</p>}
      <MatchRows dest={dest} weights={weights} selectedStyles={selectedStyles} factors={factors} notes={notes} emojiOverrides={emojiOverrides} previewIdx={previewIdx} />
    </div>
  );
}

function InterestDetail({
  dest,
  row,
  icon,
  shortName,
  previewIdx,
  onChangeMonth,
}: {
  dest: ScoredDestination;
  row: { slider: { key: string; icon: string; label: string }; isNA: boolean; score: number };
  /** Resolved icon (admin override already applied) — don't read row.slider.icon directly here. */
  icon: string;
  /** The pill name for this interest (admin-set or automatic). */
  shortName: string;
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
      {placeBlurb && <p className="interest-place-blurb"><EmphasisText text={placeBlurb} /></p>}
      <div className="detail-section-title interest-detail-months-title">{shortName} by month</div>
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
            <div className="month-detail-name">In {MONTH_NAMES[previewIdx]}</div>
            <div className={`month-detail-quality score-${monthQuality.cls}`}>{monthQuality.text}</div>
          </div>
          <div className={`month-detail-score score-${monthQuality.cls}`}>{score.toFixed(1)}</div>
        </div>
        {monthBlurb && <p className="card-monthly-blurb"><EmphasisText text={monthBlurb} /></p>}
      </div>
    </div>
  );
}

/**
 * "My Interests": every interest the traveler has, one shaded row each, filled to how well this place suits it in the month shown. An interest that the
 * traveler's picks and answers lowered keeps a hatched ghost to where it was and an "i": tap the row to see why. Top interests first, then the rest.
 */
const TOP_WEIGHT = 9;
function MatchRows({ dest, weights, selectedStyles, factors, notes, emojiOverrides, previewIdx }: { dest: ScoredDestination; weights: Record<string, number>; selectedStyles?: SelectedStyles; factors?: InterestFactors; notes?: Record<string, PlaceNote>; emojiOverrides: Record<string, string>; previewIdx: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const eff = effectiveWeights(weights);
  const rows = SLIDERS.filter((s) => (eff[s.key] || 0) > 0).map((s) => {
    const na = isSliderNA(dest, s.key);
    const orig = na ? 0 : styleAdjustedScore(dest, s.key, previewIdx, selectedStyles);
    const f = factors?.[dest.id]?.[s.key] ?? 1;
    const pct = Math.round(orig * f * 10);
    const origPct = Math.round(orig * 10);
    return { s, na, pct, origPct, cut: !na && f < 0.999 && origPct - pct >= 1, top: (weights[s.key] || 0) >= TOP_WEIGHT };
  });
  rows.sort((a, b) => Number(b.top) - Number(a.top) || Number(a.na) - Number(b.na) || b.pct - a.pct);
  if (!rows.length) return null;
  const hasLikes = rows.some((r) => !r.top) && rows.some((r) => r.top);
  const tone = (p: number) => (p >= 80 ? 'var(--good)' : p >= 50 ? 'var(--okay)' : 'var(--poor)');
  const care = notes?.[CARE_NOTE_KEY]?.reasons ?? [];
  return (
    <div className="mi-rows">
      {rows.map((r, i) => {
        const key = r.s.key;
        const icon = emojiOverrides[key] ?? r.s.icon;
        const why = notes?.[key]?.reasons.map((x) => x.message).join('. ');
        const inner = (
          <>
            {!r.na && r.cut && <span className="mi-ghost" style={{ left: `${r.pct}%`, width: `${r.origPct - r.pct}%` }} />}
            {!r.na && <span className="mi-fill" style={{ width: `${r.pct}%`, background: tone(r.pct) }} />}
            <span className="mi-e" aria-hidden="true">{icon}</span>
            <span className="mi-nm">{r.s.label}</span>
            {r.cut && <span className="mi-i" aria-hidden="true">i</span>}
            <span className="mi-pc" style={r.na ? { color: 'var(--text-faint)' } : { color: tone(r.pct) }}>{r.na ? 'Not here' : `${r.pct}%`}</span>
          </>
        );
        return (
          <div key={key}>
            {hasLikes && i === 0 && <div className="mi-sep first">Top interests</div>}
            {hasLikes && !r.top && (i === 0 || rows[i - 1].top) && <div className="mi-sep">Also liked</div>}
            {r.cut ? (
              <button type="button" className="mi-row tap" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>{inner}</button>
            ) : (
              <div className={`mi-row${r.na ? ' na' : ''}`}>{inner}</div>
            )}
            {r.cut && open === key && (
              <div className="mi-why"><b>Was {r.origPct}%.</b> {why || 'Your picks and answers lower this a little.'}</div>
            )}
          </div>
        );
      })}
      {care.length > 0 && <p className="mi-care">🧳 {care.map((x) => x.message).join('. ')}</p>}
    </div>
  );
}

/** Blurb text with marked species names in a slightly heavier weight. */
function EmphasisText({ text }: { text: string }) {
  const u = useUnitText();
  return (
    <>
      {splitEmphasis(u(text)).map((p, i) =>
        p.emphasis ? (
          <span key={i} className="species-name">
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

