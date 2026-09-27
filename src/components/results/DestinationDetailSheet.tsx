'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StampBadge } from './StampBadge';
import { BookmarkIcon } from './BookmarkIcon';
import { CheckIcon } from './CheckIcon';
import { MonthChip } from './MonthChip';
import { MONTH_NAMES } from '@/lib/scoring/constants';
import { ForYouTab } from './ForYouTab';
import { AboutTab } from './AboutTab';
import { CostsTab } from './CostsTab';
import type { SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';

type DetailTab = 'foryou' | 'about' | 'costs';

// How long the "Visited" chip's checkmark shows green before the chips
// collapse and the real stamp takes over — matches DestinationCard's own.
const CONFIRM_MS = 260;

/**
 * The bottom-sheet shell: backdrop, drag handle, header, tab bar. Owns its
 * own detailTab/selectedCategory/generalMonthIdx state — this is view
 * state local to "looking at this one destination right now," not app
 * state, so it resets each time a different destination is opened (the
 * `key={dest.id}` the caller mounts this with handles that).
 */
export function DestinationDetailSheet({
  dest,
  weights,
  emojiOverrides,
  bands,
  selectedStyles,
  month,
  visited,
  onToggleVisited,
  favorited,
  onToggleFavorited,
  onClose,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  /** Admin-set emoji overrides, keyed by slider key — falls back to the slider's own code-defined icon. */
  emojiOverrides: Record<string, string>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  /** The app's search month (1-12). Never changed from in here: the sheet only previews other months. */
  month: number;
  visited: boolean;
  onToggleVisited: () => void;
  favorited: boolean;
  onToggleFavorited: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('foryou');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // The month being previewed inside this sheet. It starts at the search month and moves with the
  // month chip and every month bar, on every tab. The results list behind the sheet is never re-sorted.
  const [previewOverride, setPreviewOverride] = useState<{ forMonth: number; idx: number } | null>(null);
  const [justStamped, setJustStamped] = useState(false);
  // Mirrors the results tile's own bookmark trigger — tapping it reveals
  // the Visited/Save chips in its place instead of toggling anything itself.
  const [actionOpen, setActionOpen] = useState(false);
  const monthIdx = month - 1;
  // An override only counts for the search month it was made under, so if the app's month changes
  // while the sheet is open the preview snaps back to it without an effect.
  const previewIdx = previewOverride && previewOverride.forMonth === monthIdx ? previewOverride.idx : monthIdx;
  const setPreviewIdx = (idx: number) => setPreviewOverride(idx === monthIdx ? null : { forMonth: monthIdx, idx });
  const bodyRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

  // All three tabs share one scroll container (see the CSS grid-stack
  // comment below) — switching tabs must start the newly-visible one at
  // the top, not wherever the previous tab happened to be scrolled to.
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0);
  }, [tab]);

  // Lock the sheet's outer height to its as-opened size (explainer still
  // collapsed at this point) so later in-tab content changes — the match
  // explainer expanding being the main one — can't resize the sheet itself.
  // Without this, the sheet has no fixed height (just a max-height cap), so
  // it's sized to its content; since it's bottom-anchored on mobile, taller
  // content pushes the *top* edge up instead of the bottom edge down. Once
  // locked, any extra content just scrolls inside .detail-sheet-body.
  useLayoutEffect(() => {
    if (sheetRef.current) setLockedHeight(sheetRef.current.getBoundingClientRect().height);
  }, []);

  function handleMarkVisited() {
    if (visited) {
      onToggleVisited();
      setActionOpen(false);
      return;
    }
    // Same beat as the results tile: let the checkmark turn green (the
    // .active class follows `visited` immediately) before collapsing the
    // chips and revealing the real stamp.
    onToggleVisited();
    setTimeout(() => {
      setJustStamped(true);
      setActionOpen(false);
      setTimeout(() => setJustStamped(false), 400);
    }, CONFIRM_MS);
  }

  function handleSave() {
    onToggleFavorited();
    setActionOpen(false);
  }

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div
        className="detail-sheet"
        role="dialog"
        aria-label={`${dest.name} details`}
        ref={sheetRef}
        style={lockedHeight != null ? { height: lockedHeight } : undefined}
      >
        <div className="detail-sheet-handle-wrap">
          <div className="detail-sheet-handle" />
        </div>
        <div className="detail-sheet-header">
          <span className="detail-sheet-emoji">{dest.emoji}</span>
          <div className="detail-sheet-title-wrap">
            <div className="detail-sheet-name">{dest.name}</div>
            <div className="detail-sheet-region">{dest.region}</div>
          </div>
          <button type="button" className="detail-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="detail-sheet-subheader">
          <span className="detail-sheet-month-group">
            <MonthChip month={previewIdx + 1} onChangeMonth={(m) => setPreviewIdx(m - 1)} />
            {previewIdx !== monthIdx && (
              <button type="button" className="detail-sheet-month-reset" onClick={() => setPreviewIdx(monthIdx)}>
                Back to {MONTH_NAMES[monthIdx]}
              </button>
            )}
          </span>
          {actionOpen ? (
            <>
              <div className="month-menu-scrim" onClick={() => setActionOpen(false)} />
              <div className="card-action-chips">
                <button type="button" className={`card-chip card-chip-visited${visited ? ' active' : ''}`} onClick={handleMarkVisited}>
                  <CheckIcon /> Visited
                </button>
                <button type="button" className={`card-chip card-chip-save${favorited ? ' active' : ''}`} onClick={handleSave}>
                  <BookmarkIcon filled={favorited} /> Save
                </button>
              </div>
            </>
          ) : (
            <div className="detail-sheet-action-group">
              {visited && <StampBadge destinationId={dest.id} size={34} popping={justStamped} />}
              <button
                type="button"
                className="card-bookmark-btn"
                aria-label={favorited ? 'Saved — tap to change' : 'Save or mark visited'}
                onClick={() => setActionOpen(true)}
              >
                <BookmarkIcon filled={favorited} />
              </button>
            </div>
          )}
        </div>

        <div className="detail-tabs">
          <button type="button" className={`detail-tab-btn${tab === 'foryou' ? ' active' : ''}`} onClick={() => setTab('foryou')}>
            For You
          </button>
          <button type="button" className={`detail-tab-btn${tab === 'about' ? ' active' : ''}`} onClick={() => setTab('about')}>
            About
          </button>
          <button type="button" className={`detail-tab-btn${tab === 'costs' ? ' active' : ''}`} onClick={() => setTab('costs')}>
            Costs
          </button>
        </div>

        <div className="detail-sheet-body" ref={bodyRef}>
          {/* All three panels stay mounted and stacked in the same grid
              cell — the container sizes itself to the tallest one (always
              For You, in practice), and switching tabs just swaps which
              panel is visible instead of resizing the whole sheet. */}
          <div className={`detail-tab-panel${tab === 'foryou' ? ' active' : ''}`} aria-hidden={tab !== 'foryou'}>
            <ForYouTab
              dest={dest}
              weights={weights}
              emojiOverrides={emojiOverrides}
              bands={bands}
              selectedStyles={selectedStyles}
              previewIdx={previewIdx}
              onChangeMonth={setPreviewIdx}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
          <div className={`detail-tab-panel${tab === 'about' ? ' active' : ''}`} aria-hidden={tab !== 'about'}>
            <AboutTab dest={dest} generalMonthIdx={previewIdx} onSelectGeneralMonth={setPreviewIdx} />
          </div>
          <div className={`detail-tab-panel${tab === 'costs' ? ' active' : ''}`} aria-hidden={tab !== 'costs'}>
            <CostsTab dest={dest} />
          </div>
        </div>
      </div>
    </>
  );
}
