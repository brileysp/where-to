'use client';

import { MonthChip } from './MonthChip';

interface Props {
  firstName: string | null;
  month: number;
  onChangeMonth: (month: number) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
}

const SEARCH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.3" y2="16.3" />
  </svg>
);

export function ResultsHeader({ firstName, month, onChangeMonth, searchOpen, onToggleSearch, titleRef }: Props) {
  return (
    <div className="results-header-row">
      <h1 ref={titleRef} className="results-title">
        <span>Top places for {firstName || 'you'} for</span>
        <MonthChip month={month} onChangeMonth={onChangeMonth} />
      </h1>
      <button
        type="button"
        className={`results-icon-btn${searchOpen ? ' on' : ''}`}
        aria-label={searchOpen ? 'Close search' : 'Search destinations'}
        aria-expanded={searchOpen}
        onClick={onToggleSearch}
      >
        {SEARCH_ICON}
      </button>
    </div>
  );
}
