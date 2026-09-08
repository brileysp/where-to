import { forwardRef } from 'react';
import { matchLabel } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';
import { StampBadge } from './StampBadge';
import { HeartIcon } from './HeartIcon';

interface Props {
  dest: ScoredDestination;
  rank: number;
  score: number;
  highlighted: boolean;
  visited: boolean;
  favorited: boolean;
  onOpenDetail: () => void;
  onToggleFavorited: () => void;
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
 * on one line and emoji/region/stamp/favorite on the next. Everything
 * that used to live inline (year strip, badges, monthly blurb, interest
 * breakdown) lives one tap away in DestinationDetailSheet, reached by
 * clicking anywhere on the card. Rank, name, and score share one line so
 * the name gets the full card width up to wherever the score sits,
 * rather than losing space to a fixed-width meta cluster — rank is kept
 * small and gray precisely so it doesn't compete with the name or score
 * for attention despite sharing their line. The favorite button stops
 * propagation so it toggles without opening the detail sheet.
 */
export const DestinationCard = forwardRef<HTMLElement, Props>(function DestinationCard(
  { dest, rank, score, highlighted, visited, favorited, onOpenDetail, onToggleFavorited },
  ref,
) {
  const match = matchLabel(score);
  const offset = stampOffset(dest.id);

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
        <div className="card-bottom-left">
          <span className="card-row-emoji">{dest.emoji}</span>
          <span className="card-region">{dest.region}</span>
        </div>
        <div className="card-bottom-right">
          <div className="card-stamp-zone">
            {visited && (
              <div className="card-stamp-slot" style={{ top: offset.top, left: offset.left }}>
                <StampBadge destinationId={dest.id} size={34} />
              </div>
            )}
          </div>
          <button
            type="button"
            className="card-favorite-btn"
            aria-label={favorited ? 'Remove favorite' : 'Add favorite'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorited();
            }}
          >
            <HeartIcon filled={favorited} />
          </button>
        </div>
      </div>
    </article>
  );
});
