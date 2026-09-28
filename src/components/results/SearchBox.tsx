'use client';

import { useEffect, useRef, useState } from 'react';
import { searchDestinations } from '@/lib/scoring/search';
import { scoreLabel } from '@/lib/scoring/rank';
import type { RankedDestination } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';

const SEARCH_RESULTS_CAP = 6;

export function SearchBox({
  destinations,
  ranked,
  onSelectResult,
  expanded,
}: {
  destinations: ScoredDestination[];
  ranked: RankedDestination[];
  onSelectResult: (destId: string) => void;
  /** Whether the bar is revealed — toggled by the header's search icon. */
  expanded: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // Once fully expanded the wrapper stops clipping, so the results dropdown
  // (in flow, below the input) can show; while animating it must clip.
  const [settled, setSettled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collapsing resets the bar right away (adjusting state during render is
  // React's sanctioned way to react to a prop change without an effect).
  const [prevExpanded, setPrevExpanded] = useState(expanded);
  if (expanded !== prevExpanded) {
    setPrevExpanded(expanded);
    setSettled(false);
    if (!expanded) setOpen(false);
  }

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [expanded]);

  const results = searchDestinations(destinations, query).slice(0, SEARCH_RESULTS_CAP);
  const rankOf = (id: string) => ranked.findIndex((r) => r.d.id === id);

  function select(destId: string) {
    setQuery('');
    setOpen(false);
    onSelectResult(destId);
  }

  return (
    <div className={`results-search-wrap${expanded ? (settled ? ' is-open' : ' is-opening') : ' is-collapsed'}`} aria-hidden={!expanded}
      onTransitionEnd={(e) => {
        if (expanded && e.target === e.currentTarget && e.propertyName === 'max-height') setSettled(true);
      }}
    >
      <div className="results-search-box">
        <span>🔍</span>
        <input
          ref={inputRef}
          value={query}
          placeholder="Search destinations…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              inputRef.current?.blur();
            }
          }}
        />
        {query && (
          <button type="button" className="results-search-clear" onClick={() => setQuery('')}>
            ✕
          </button>
        )}
      </div>
      {open && query.trim() && (
        <div className="results-search-dropdown">
          {results.length === 0 ? (
            <div className="search-dropdown-empty">No destinations match.</div>
          ) : (
            results.map((d) => {
              const idx = rankOf(d.id);
              const r = idx >= 0 ? ranked[idx] : null;
              const label = r ? scoreLabel(r.s) : null;
              return (
                <div
                  key={d.id}
                  className="search-dropdown-row"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(d.id);
                  }}
                >
                  <span>{d.emoji}</span>
                  <div>
                    <div className="search-dropdown-name">{d.name}</div>
                    <div className="search-dropdown-region">{d.region}</div>
                  </div>
                  {r && label && (
                    <span className={`search-dropdown-rank score-${label.cls}`}>
                      #{idx + 1} · {r.s.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
