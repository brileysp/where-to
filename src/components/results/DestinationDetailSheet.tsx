'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StampBadge } from './StampBadge';
import { ForYouTab } from './ForYouTab';
import { AboutTab } from './AboutTab';
import { CostsTab } from './CostsTab';
import type { SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';

type DetailTab = 'foryou' | 'about' | 'costs';

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
  bands,
  selectedStyles,
  month,
  score,
  visited,
  onToggleVisited,
  onClose,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  month: number;
  score: number;
  visited: boolean;
  onToggleVisited: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('foryou');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [generalMonthIdx, setGeneralMonthIdx] = useState(month - 1);
  const [justStamped, setJustStamped] = useState(false);
  const monthIdx = month - 1;
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

  function handleToggleVisited() {
    onToggleVisited();
    setJustStamped(true);
    setTimeout(() => setJustStamped(false), 400);
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
          {visited && <StampBadge destinationId={dest.id} size={34} popping={justStamped} />}
          <button type="button" className={`visit-btn${visited ? ' visited' : ''}`} onClick={handleToggleVisited}>
            {visited ? '✓ Visited' : '🏷 Mark visited'}
          </button>
          <button type="button" className="detail-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
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
              bands={bands}
              selectedStyles={selectedStyles}
              monthIdx={monthIdx}
              score={score}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
          <div className={`detail-tab-panel${tab === 'about' ? ' active' : ''}`} aria-hidden={tab !== 'about'}>
            <AboutTab dest={dest} generalMonthIdx={generalMonthIdx} onSelectGeneralMonth={setGeneralMonthIdx} />
          </div>
          <div className={`detail-tab-panel${tab === 'costs' ? ' active' : ''}`} aria-hidden={tab !== 'costs'}>
            <CostsTab dest={dest} />
          </div>
        </div>
      </div>
    </>
  );
}
