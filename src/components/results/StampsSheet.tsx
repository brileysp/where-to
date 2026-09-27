'use client';

import { useState } from 'react';
import { StampBadge } from './StampBadge';
import { CheckIcon } from './CheckIcon';
import { getContinent, type Continent } from '@/lib/scoring/continents';
import type { ScoredDestination } from '@/lib/scoring/types';

// Same beat as the tile/detail-sheet "Visited" chip: let the checkmark
// turn green before the real stamp takes its place.
const CONFIRM_MS = 260;

/**
 * One collection row. Its own component (not inlined in the list map)
 * so the confirm-then-stamp delay below can be local state per row
 * instead of a parent-level map of timers.
 */
function StampRow({
  dest,
  isVisited,
  onToggleVisited,
}: {
  dest: ScoredDestination;
  isVisited: boolean;
  onToggleVisited: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [popping, setPopping] = useState(false);

  function handleClick() {
    if (isVisited) {
      onToggleVisited();
      return;
    }
    setConfirming(true);
    setTimeout(() => {
      onToggleVisited();
      setConfirming(false);
      setPopping(true);
      setTimeout(() => setPopping(false), 400);
    }, CONFIRM_MS);
  }

  return (
    <div className="stamps-row">
      <button
        type="button"
        className="stamps-stamp-btn"
        onClick={handleClick}
        aria-label={isVisited ? `Mark ${dest.name} not visited` : `Mark ${dest.name} visited`}
      >
        {isVisited ? (
          <StampBadge destinationId={dest.id} size={34} popping={popping} />
        ) : (
          <span className={`stamp-ghost-circle${confirming ? ' confirmed' : ''}`}>
            <CheckIcon />
          </span>
        )}
      </button>
      <div className="stamps-row-name-wrap">
        <div className={`stamps-row-name${isVisited ? '' : ' stamps-row-name-ghost'}`}>{dest.name}</div>
        <div className="stamps-row-region">{dest.region}</div>
      </div>
    </div>
  );
}

/**
 * "My Stamps" — visited-tracking collection, grouped by continent (derived
 * from each destination's own country code, not a hand-authored field —
 * see getContinent). Each continent header carries its own "collected of
 * total" count against the FULL catalogue for that continent, independent
 * of the current visited-only/show-all filter, so it always reads as real
 * progress rather than a count of whatever happens to be on screen. The
 * world map is kept as an inert placeholder, matching the source design's
 * own scope — it's a stub there too, not a cut real feature.
 */
export function StampsSheet({
  destinations,
  visited,
  onToggleVisited,
  onClose,
}: {
  destinations: ScoredDestination[];
  visited: Record<string, boolean>;
  onToggleVisited: (id: string) => void;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const visitedCount = destinations.filter((d) => visited[d.id]).length;
  const totalCount = destinations.length;

  const list = (showAll ? destinations : destinations.filter((d) => visited[d.id]))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const continentTotals = new Map<Continent, number>();
  const continentVisited = new Map<Continent, number>();
  for (const d of destinations) {
    const c = getContinent(d.id);
    continentTotals.set(c, (continentTotals.get(c) ?? 0) + 1);
    if (visited[d.id]) continentVisited.set(c, (continentVisited.get(c) ?? 0) + 1);
  }

  const groups = new Map<Continent, ScoredDestination[]>();
  for (const d of list) {
    const c = getContinent(d.id);
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(d);
  }
  const continentOrder = [...groups.keys()].sort();

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet stamps-sheet" role="dialog" aria-label="My Stamps">
        <div className="detail-sheet-handle-wrap">
          <div className="detail-sheet-handle" />
        </div>
        <div className="detail-sheet-header">
          <div className="detail-sheet-title-wrap" style={{ flex: 1 }}>
            <div className="detail-sheet-name">My Stamps</div>
            <div className="detail-sheet-region">
              {visitedCount} of {totalCount} collected
            </div>
          </div>
          <button type="button" className="detail-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="detail-sheet-body">
          <div className="stamps-body-content">
            <div className="stamps-map-placeholder">
              WORLD MAP PLACEHOLDER
              <br />
              countries &amp; states colored in as visited
            </div>

            <div className="stamps-collection-head">
              <div className="detail-section-title stamps-collection-title">Collection</div>
              <button type="button" className="stamps-toggle-link" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show visited only' : 'Show all destinations'}
              </button>
            </div>

            {!showAll && visitedCount === 0 && (
              <p className="stamps-empty">
                No stamps yet — mark a destination visited, or tap &quot;Show all destinations&quot; to add your first ones.
              </p>
            )}

            <div className="stamps-list">
              {continentOrder.map((continent) => (
                <div key={continent}>
                  <div className="stamps-continent-header">
                    <span>{continent}</span>
                    <span className="stamps-continent-count">
                      {continentVisited.get(continent) ?? 0} of {continentTotals.get(continent) ?? 0}
                    </span>
                  </div>
                  {groups.get(continent)!.map((d) => (
                    <StampRow key={d.id} dest={d} isVisited={!!visited[d.id]} onToggleVisited={() => onToggleVisited(d.id)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
