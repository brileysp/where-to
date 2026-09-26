import { useLayoutEffect, useRef, useState } from 'react';
import type { RankedDestination } from '@/lib/scoring/rank';
import { DestinationCard } from './DestinationCard';
import { prefersReducedMotion } from './useResortDemo';

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
  onToggleVisited: (destId: string) => void;
  /** Changes exactly when "Hide visited" or "Show wishlist" is toggled —
   * see the forceResort comment below for why this exists. */
  filterKey: string;
}

export { RESULTS_PAGE_SIZE };

// Cards whose rank changed keep the design's "extra bold for a beat" cue on
// their #N and score instead of a separate badge (see .rank-flash in css).
const FLASH_MS = 650;
const TRAVEL_CAP = 600;

interface Layout {
  ids: string[];
  /** Card tops relative to the list, so page scrolling never reads as movement. */
  tops: Map<string, number>;
}

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
  onToggleVisited,
  filterKey,
}: Props) {
  const visible = ranked.slice(0, visibleCount);
  const remaining = ranked.length - visibleCount;

  // Cards that fall out of the rendered window on a re-sort are kept mounted
  // for a moment as "ghosts" so they can drop down the list. Derived while
  // rendering (React's sanctioned prop-change pattern) from the id lists
  // alone — filterKey rides along in the SAME state object (rather than a
  // separately-mutated ref) so the "did it just change" check stays correct
  // even if React invokes this render body more than once for one commit
  // (StrictMode's dev-only double-render): a raw ref write during render
  // isn't idempotent under that, and the very first version of this used
  // one — it flipped back to "unchanged" on the throwaway extra invocation,
  // which is why "Show wishlist" alone (no organic backfill to fall back
  // on) silently stopped animating while "Hide visited" still happened to.
  const idsKey = visible.map(({ d }) => d.id).join('|');
  const [seen, setSeen] = useState({ key: idsKey, entries: visible, filterKey });
  const [ghosts, setGhosts] = useState<{ entry: RankedDestination; rank: number }[]>([]);
  const filterJustChanged = seen.filterKey !== filterKey;
  if (seen.key !== idsKey || filterJustChanged) {
    const nowIds = new Set(visible.map(({ d }) => d.id));
    const prevIds = new Set(seen.entries.map(({ d }) => d.id));
    const leaving = seen.entries.filter(({ d }) => !nowIds.has(d.id));
    const entering = visible.filter(({ d }) => !prevIds.has(d.id));
    const prevShared = seen.entries.filter(({ d }) => nowIds.has(d.id));
    const nowShared = visible.filter(({ d }) => prevIds.has(d.id));
    const reordered = prevShared.some(({ d }, i) => d.id !== nowShared[i].d.id);
    // Entering + leaving together is a re-sort; entering alone is "show
    // more" and leaving alone is a filter — neither should animate, unless
    // a filter toggle just fired (see filterJustChanged above).
    const isResort = reordered || (leaving.length > 0 && entering.length > 0) || filterJustChanged;
    setGhosts(isResort ? leaving.map((entry) => ({ entry, rank: seen.entries.findIndex(({ d }) => d.id === entry.d.id) + 1 })) : []);
    setSeen({ key: idsKey, entries: visible, filterKey });
  }

  const listRef = useRef<HTMLDivElement>(null);
  const ghostEls = useRef<Map<string, HTMLElement>>(new Map());
  const ghostToken = useRef(0);
  const prevLayout = useRef<Layout | null>(null);
  const flipCounter = useRef(0);

  // Re-sort animation (design "2a"): when the order of cards that stay on
  // screen changes, each one is snapped back to where it was and then slides
  // to its new slot with a slight overshoot; cards travelling farther start a
  // touch later. Runs after every commit so the recorded tops never go stale;
  // a card entering or leaving (show more, filters) is not a re-sort.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const listTop = list.getBoundingClientRect().top;
    const ids = visible.map(({ d }) => d.id);
    const tops = new Map<string, number>();
    ids.forEach((id) => {
      const el = cardRefs.current.get(id);
      if (el) tops.set(id, el.getBoundingClientRect().top - listTop);
    });
    const prev = prevLayout.current;
    prevLayout.current = { ids, tops };
    if (!prev || prefersReducedMotion()) return;

    const nowSet = new Set(ids);
    const prevSet = new Set(prev.ids);
    const prevShared = prev.ids.filter((id) => nowSet.has(id));
    const nowShared = ids.filter((id) => prevSet.has(id));
    const entering = ids.filter((id) => !prevSet.has(id));
    const leaving = prev.ids.filter((id) => !nowSet.has(id));
    if (!prevShared.some((id, i) => id !== nowShared[i]) && !(entering.length > 0 && leaving.length > 0) && !filterJustChanged) return;
    const listHeight = list.getBoundingClientRect().height;

    const token = String(++flipCounter.current);
    const moving: { el: HTMLElement; rankDelta: number }[] = [];
    nowShared.forEach((id) => {
      const el = cardRefs.current.get(id);
      const from = prev.tops.get(id);
      const to = tops.get(id);
      if (!el || from == null || to == null) return;
      // Capped so a card that jumped many places reads as a clear ride, not
      // a blur across the whole page.
      const delta = Math.max(-TRAVEL_CAP, Math.min(TRAVEL_CAP, from - to));
      const rankDelta = prev.ids.indexOf(id) - ids.indexOf(id);
      if (Math.abs(delta) < 0.5 && rankDelta === 0) return;
      if (Math.abs(delta) >= 0.5) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${delta}px)`;
        el.style.zIndex = '5';
      }
      el.dataset.flip = token;
      moving.push({ el, rankDelta });
    });

    // Newcomers ride up from below the list, fading in.
    const arriving: HTMLElement[] = [];
    entering.forEach((id) => {
      const el = cardRefs.current.get(id);
      const to = tops.get(id);
      if (!el || to == null) return;
      const offset = Math.max(160, Math.min(TRAVEL_CAP, listHeight - to + 60));
      el.style.transition = 'none';
      el.style.transform = `translateY(${offset}px)`;
      el.style.opacity = '0';
      el.style.zIndex = '5';
      el.dataset.flip = token;
      arriving.push(el);
    });
    // Leavers (ghosts, rendered below) drop down the list and off the page.
    const ghostIds = [...ghostEls.current.keys()];
    ghostIds.forEach((id) => {
      const el = ghostEls.current.get(id);
      const from = prev.tops.get(id);
      if (!el || from == null) return;
      el.style.top = `${from}px`;
      el.style.transition = 'none';
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
      el.style.visibility = 'visible';
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        arriving.forEach((el) => {
          el.style.transition = 'transform 450ms cubic-bezier(0.28,1.2,0.4,1) 60ms, opacity 300ms ease 60ms';
          el.style.transform = '';
          el.style.opacity = '1';
        });
        ghostIds.forEach((id) => {
          const el = ghostEls.current.get(id);
          const from = prev.tops.get(id);
          if (!el || from == null) return;
          const drop = Math.max(160, Math.min(TRAVEL_CAP, listHeight - from + 60));
          el.style.transition = 'transform 450ms cubic-bezier(0.5,0,0.9,0.6), opacity 450ms ease-in';
          el.style.transform = `translateY(${drop}px)`;
          el.style.opacity = '0';
        });
        moving.forEach(({ el, rankDelta }) => {
          const delay = Math.min(Math.abs(rankDelta) * 18, 70);
          el.style.transition = `transform 400ms cubic-bezier(0.28,1.2,0.4,1) ${delay}ms`;
          el.style.transform = '';
          if (rankDelta !== 0) el.classList.add('rank-flash');
        });
      });
    });
    // Not cancelled by the next render (this effect runs after every one) —
    // instead each card only cleans up if no newer re-sort has claimed it.
    const ghostRun = ++ghostToken.current;
    setTimeout(() => {
      if (ghostToken.current === ghostRun) setGhosts([]);
      arriving.forEach((el) => {
        if (el.dataset.flip !== token) return;
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
        el.style.zIndex = '';
        delete el.dataset.flip;
      });
      moving.forEach(({ el }) => {
        if (el.dataset.flip !== token) return;
        el.style.transition = '';
        el.style.zIndex = '';
        el.classList.remove('rank-flash');
        delete el.dataset.flip;
      });
    }, 400 + 70 + FLASH_MS);
  });

  return (
    <>
      <div className="results-list" ref={listRef}>
        {ghosts.map(({ entry, rank }) => (
          <div
            key={`ghost-${entry.d.id}`}
            className="results-ghost"
            aria-hidden
            ref={(el) => {
              if (el) ghostEls.current.set(entry.d.id, el);
              else ghostEls.current.delete(entry.d.id);
            }}
          >
            <DestinationCard
              dest={entry.d}
              rank={rank}
              score={entry.s}
              highlighted={false}
              visited={!!visited[entry.d.id]}
              favorited={!!favorited[entry.d.id]}
              onOpenDetail={() => {}}
              onToggleFavorited={() => {}}
              onToggleVisited={() => {}}
            />
          </div>
        ))}
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
            onToggleVisited={() => onToggleVisited(d.id)}
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
