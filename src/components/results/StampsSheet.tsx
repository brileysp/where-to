'use client';

import { useState } from 'react';
import { StampBadge } from './StampBadge';
import type { ScoredDestination } from '@/lib/scoring/types';

/**
 * "My Stamps" — visited-tracking collection. Continent grouping from the
 * design is dropped (no `continent` field exists on a destination yet);
 * one flat, alphabetically-sorted list instead. The world map is kept as
 * an inert placeholder, matching the source design's own scope — it's a
 * stub there too, not a cut real feature.
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

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-label="My Stamps">
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
              {list.map((d) => {
                const isVisited = !!visited[d.id];
                return (
                  <div className="stamps-row" key={d.id}>
                    <button
                      type="button"
                      className={`stamps-check${isVisited ? ' checked' : ''}`}
                      onClick={() => onToggleVisited(d.id)}
                      aria-label={isVisited ? `Mark ${d.name} not visited` : `Mark ${d.name} visited`}
                    >
                      {isVisited ? '✓' : ''}
                    </button>
                    <div className="stamps-row-name-wrap">
                      <div className={`stamps-row-name${isVisited ? '' : ' stamps-row-name-ghost'}`}>{d.name}</div>
                      <div className="stamps-row-region">{d.region}</div>
                    </div>
                    <StampBadge destinationId={d.id} size={34} ghost={!isVisited} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
