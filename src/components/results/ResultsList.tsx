import type { RankedDestination, SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import { DestinationCard } from './DestinationCard';

const RESULTS_PAGE_SIZE = 20;

interface Props {
  ranked: RankedDestination[];
  visibleCount: number;
  onShowMore: () => void;
  weights: Record<string, number>;
  month: number;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  breakdownExpanded: Set<string>;
  cardPreviewMonth: Record<string, number>;
  onToggleYearBar: (destId: string, m: number) => void;
  onToggleBreakdown: (destId: string) => void;
  highlightedId: string | null;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
}

export { RESULTS_PAGE_SIZE };

export function ResultsList({
  ranked,
  visibleCount,
  onShowMore,
  weights,
  month,
  bands,
  selectedStyles,
  breakdownExpanded,
  cardPreviewMonth,
  onToggleYearBar,
  onToggleBreakdown,
  highlightedId,
  cardRefs,
}: Props) {
  const visible = ranked.slice(0, visibleCount);
  const remaining = ranked.length - visibleCount;

  return (
    <>
      <div className="results-list">
        {visible.map(({ d, s }, i) => {
          const previewMonth = cardPreviewMonth[d.id] || month;
          return (
            <DestinationCard
              key={d.id}
              ref={(el) => {
                if (el) cardRefs.current.set(d.id, el);
                else cardRefs.current.delete(d.id);
              }}
              dest={d}
              rank={i + 1}
              score={s}
              month={month}
              weights={weights}
              bands={bands}
              selectedStyles={selectedStyles}
              isBreakdownExpanded={breakdownExpanded.has(d.id)}
              previewMonth={previewMonth}
              onYearBarClick={(m) => onToggleYearBar(d.id, m)}
              onToggleBreakdown={() => onToggleBreakdown(d.id)}
              highlighted={highlightedId === d.id}
            />
          );
        })}
      </div>
      {remaining > 0 && (
        <button type="button" className="btn-secondary results-show-more" style={{ marginTop: 16 }} onClick={onShowMore}>
          Show {Math.min(remaining, RESULTS_PAGE_SIZE)} more ({remaining} left)
        </button>
      )}
    </>
  );
}
