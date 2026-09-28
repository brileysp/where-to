import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { matchLabel } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';
import { StampBadge } from './StampBadge';
import { BookmarkIcon } from './BookmarkIcon';
import { CheckIcon } from './CheckIcon';

// How long the "Visited" chip's checkmark shows green before the chips
// collapse and the real stamp takes over — long enough to read as a
// confirmation, short enough not to feel like a delay.
const CONFIRM_MS = 260;

interface Props {
  dest: ScoredDestination;
  rank: number;
  score: number;
  highlighted: boolean;
  visited: boolean;
  favorited: boolean;
  onOpenDetail: () => void;
  onToggleFavorited: () => void;
  onToggleVisited: () => void;
}

// Small stable (not random-per-render) per-destination nudge for where the
// stamp lands within its zone — real stamps don't land in an identical
// spot every time. Range is deliberately conservative (top always
// negative-but-small, left within the zone's own width) so the stamp
// stays inside the card on every destination and only ever grazes the
// tail of a long name, never covers it.
function stampOffset(destinationId: string): { top: number; left: number } {
  let h = 0;
  for (let i = 0; i < destinationId.length; i++) h = (h * 31 + destinationId.charCodeAt(i)) | 0;
  h = Math.abs(h);
  return {
    top: -4 - (h % 19), // -4..-22
    left: -6 + ((h >> 5) % 17), // -6..10
  };
}

/**
 * A compact, fully-clickable card — nothing here besides rank/name/score
 * on one line and emoji/region/stamp/bookmark on the next. Everything
 * that used to live inline (year strip, badges, monthly blurb, interest
 * breakdown) lives one tap away in DestinationDetailSheet, reached by
 * clicking anywhere on the card. Rank, name, and score share one line so
 * the name gets the full card width up to wherever the score sits,
 * rather than losing space to a fixed-width meta cluster — rank is kept
 * small and gray precisely so it doesn't compete with the name or score
 * for attention despite sharing their line.
 *
 * The bookmark button doesn't toggle anything itself — tapping it opens
 * two chips (Visited / Save) in its place; picking one acts and closes
 * them again, landing back on the stamp+bookmark view. `open` is local,
 * transient UI state, not app state, so it isn't lifted to the parent.
 */
export const DestinationCard = forwardRef<HTMLElement, Props>(function DestinationCard(
  { dest, rank, score, highlighted, visited, favorited, onOpenDetail, onToggleFavorited, onToggleVisited },
  ref,
) {
  const match = matchLabel(score);
  const offset = stampOffset(dest.id);
  const [open, setOpen] = useState(false);
  const [justStamped, setJustStamped] = useState(false);

  // The fade only means something when the region pill has actually lost
  // width — measured directly rather than assumed, so a card with a short
  // region name (plenty of room to spare) never gets its trailing edge
  // faded out for no reason. This has to be measured on .card-region
  // itself, not the .card-bottom-left wrapper around it: .card-region
  // clips its own overflow (it needs overflow:hidden for its own
  // now-decorative text-overflow:ellipsis, which never actually fires
  // since ellipsis is a no-op on a flex container), so whatever it clips
  // never shows up as its *parent's* scrollWidth — the wrapper always
  // measures as non-overflowing even when the region text inside it is
  // being cut off mid-word.
  //
  // Watched continuously via ResizeObserver rather than only on `open`
  // change: a long region name can already be too tight for its space on
  // a narrow screen even with the chips closed (the bookmark button alone
  // takes the room), so the fade needs to catch that case too, not just
  // the extra squeeze from the Visited/Save chips opening.
  const bottomLeftRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLSpanElement>(null);
  const [squeezed, setSqueezed] = useState(false);
  useLayoutEffect(() => {
    const el = regionRef.current;
    if (!el) return;
    const measure = () => setSqueezed(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  function handleMarkVisited(e: React.MouseEvent) {
    e.stopPropagation();
    if (visited) {
      onToggleVisited();
      setOpen(false);
      return;
    }
    // Toggle right away so the chip's own checkmark turns green immediately
    // (via the .active class), then hold the chips open a beat longer so
    // that color change is actually visible before they collapse and the
    // real stamp takes over.
    onToggleVisited();
    setTimeout(() => {
      setJustStamped(true);
      setOpen(false);
      setTimeout(() => setJustStamped(false), 400);
    }, CONFIRM_MS);
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleFavorited();
    setOpen(false);
  }

  return (
    <article
      ref={ref}
      className={`card card-row${highlighted ? ' card-search-highlight' : ''}`}
      data-dest-id={dest.id}
      onClick={onOpenDetail}
      role="button"
      tabIndex={0}
    >
      <div className="card-top-row">
        <span className="card-rank">#{rank}</span>
        <div className="card-name">{dest.name}</div>
        <div className={`card-score score-${match.cls}`}>{score.toFixed(1)}</div>
      </div>
      <div className="card-bottom-row">
        <div ref={bottomLeftRef} className={`card-bottom-left${squeezed ? ' card-bottom-left-covered' : ''}`}>
          <span className="card-row-emoji">{dest.emoji}</span>
          <span ref={regionRef} className="card-region">{dest.region}</span>
        </div>
        <div className="card-bottom-right">
          {open ? (
            <>
              {/* Covers the whole viewport so any tap other than the two
                  chips below — elsewhere on this card, another card,
                  anywhere — just dismisses instead of opening the detail
                  sheet underneath. Same scrim pattern as the month dropdown. */}
              <div
                className="month-menu-scrim"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
              />
              <div className="card-action-chips" onClick={(e) => e.stopPropagation()}>
                <button type="button" className={`card-chip card-chip-visited${visited ? ' active' : ''}`} onClick={handleMarkVisited}>
                  <CheckIcon /> Visited
                </button>
                <button type="button" className={`card-chip card-chip-save${favorited ? ' active' : ''}`} onClick={handleSave}>
                  <BookmarkIcon filled={favorited} /> Save
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="card-stamp-zone">
                {visited && (
                  <div className="card-stamp-slot" style={{ top: offset.top, left: offset.left }}>
                    <StampBadge destinationId={dest.id} size={34} popping={justStamped} />
                  </div>
                )}
              </div>
              <button
                type="button"
                className="card-bookmark-btn"
                aria-label={favorited ? 'Saved — tap to change' : 'Save or mark visited'}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
              >
                <BookmarkIcon filled={favorited} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
});
