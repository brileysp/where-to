import type { RankedDestination } from '@/lib/scoring/rank';
import { DestinationCard } from './DestinationCard';

const RESULTS_PAGE_SIZE = 20;

interface Props {
  ranked: RankedDestination[];
  visibleCount: number;
  onShowMore: () => void;
  highlightedId: string | null;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  visited: Record<string, boolean>;
  favorited: Record<string, boolean>;
  onOpenDetail: (destId: string) => void;
  onToggleFavorited: (destId: string) => void;
}

export { RESULTS_PAGE_SIZE };

export function ResultsList({
  ranked,
  visibleCount,
  onShowMore,
  highlightedId,
  cardRefs,
  visited,
  favorited,
  onOpenDetail,
  onToggleFavorited,
}: Props) {
  const visible = ranked.slice(0, visibleCount);
  const remaining = ranked.length - visibleCount;

  return (
    <>
      <div className="results-list">
        {visible.map(({ d, s }, i) => (
          <DestinationCard
            key={d.id}
            ref={(el) => {
              if (el) cardRefs.current.set(d.id, el);
              else cardRefs.current.delete(d.id);
            }}
            dest={d}
            rank={i + 1}
            score={s}
            highlighted={highlightedId === d.id}
            visited={!!visited[d.id]}
            favorited={!!favorited[d.id]}
            onOpenDetail={() => onOpenDetail(d.id)}
            onToggleFavorited={() => onToggleFavorited(d.id)}
          />
        ))}
      </div>
      {remaining > 0 && (
        <button type="button" className="btn-secondary results-show-more" style={{ marginTop: 16 }} onClick={onShowMore}>
          Show {Math.min(remaining, RESULTS_PAGE_SIZE)} more ({remaining} left)
        </button>
      )}
    </>
  );
}
