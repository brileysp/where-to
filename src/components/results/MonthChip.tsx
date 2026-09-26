'use client';

import { useState } from 'react';
import { MONTH_NAMES } from '@/lib/scoring/constants';

/**
 * The orange month pill + dropdown — shared by the results header (which sets the app-level
 * search month) and the destination detail sheet (which only previews a month inside that card).
 * The caret says it opens a menu.
 */
export function MonthChip({ month, onChangeMonth }: { month: number; onChangeMonth: (month: number) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="month-chip-wrap">
      <button type="button" className="month-chip" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {MONTH_NAMES[month - 1]}
        <svg className="month-chip-caret" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="month-menu-scrim" onClick={() => setOpen(false)} />
          <div className="month-menu" role="listbox" aria-label="Month">
            {MONTH_NAMES.map((name, i) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={i + 1 === month}
                className={`month-menu-option${i + 1 === month ? ' active' : ''}`}
                onClick={() => {
                  setOpen(false);
                  if (i + 1 !== month) onChangeMonth(i + 1);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
