'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface GridColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Required when sortable. Return a comparable primitive for this row. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
}

export interface AdminDataGridProps<T> {
  rows: T[];
  columns: GridColumn<T>[];
  rowId: (row: T) => string;
  /** Free text to match the search box against (already lowercased fields joined). */
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra toolbar content (filters, legends) rendered left of the built-in search hint. */
  toolbarExtra?: React.ReactNode;
  defaultSort?: { col: string; dir: 1 | -1 };
  stickyFirstColumn?: boolean;
  footerNote?: string;
  /**
   * Enables row virtualization — only rows scrolled into view (plus a small
   * overscan buffer) are mounted, instead of every row in `rows` regardless
   * of scroll position. Every row MUST render at exactly this height in px
   * with no wrapping content — safe for grids built entirely from
   * single-line `.cell-inner` cells (e.g. MatrixGrid, 10,600+ rows), NOT
   * safe for grids using BandCell (its chips can wrap to a second line,
   * which breaks the fixed-height assumption). Omit for anything with
   * variable-height rows; a few hundred rows don't need this anyway.
   */
  rowHeight?: number;
}

const VIRTUALIZE_OVERSCAN = 8;

export function AdminDataGrid<T>({
  rows,
  columns,
  rowId,
  searchText,
  searchPlaceholder = 'Search…',
  toolbarExtra,
  defaultSort,
  stickyFirstColumn = true,
  footerNote,
  rowHeight,
}: AdminDataGridProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ col: string | null; dir: 1 | -1 }>(defaultSort ? { col: defaultSort.col, dir: defaultSort.dir } : { col: null, dir: 1 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    if (!rowHeight) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    setViewportHeight(el.clientHeight);
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [rowHeight]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => searchText(r).toLowerCase().includes(q)) : rows;
  }, [rows, query, searchText]);

  const sorted = useMemo(() => {
    if (!sort.col) return filtered;
    const column = columns.find((c) => c.key === sort.col);
    if (!column?.sortValue) return filtered;
    const sv = column.sortValue;
    return [...filtered].sort((a, b) => {
      const av = sv(a);
      const bv = sv(b);
      if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * sort.dir;
      return ((av as number) - (bv as number)) * sort.dir;
    });
  }, [filtered, sort, columns]);

  const virtual = useMemo(() => {
    if (!rowHeight) return null;
    const total = sorted.length;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUALIZE_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + VIRTUALIZE_OVERSCAN * 2;
    const end = Math.min(total, start + visibleCount);
    return { start, end, topPad: start * rowHeight, bottomPad: (total - end) * rowHeight };
  }, [rowHeight, scrollTop, viewportHeight, sorted.length]);

  const visibleRows = virtual ? sorted.slice(virtual.start, virtual.end) : sorted;

  function toggleSort(col: string) {
    setSort((s) => (s.col === col ? { col, dir: (s.dir * -1) as 1 | -1 } : { col, dir: 1 }));
  }

  function sortArrow(col: string) {
    if (sort.col !== col) return <span className="sort-arrow">↕</span>;
    return <span className="sort-arrow active">{sort.dir === 1 ? '↑' : '↓'}</span>;
  }

  return (
    <div className="grid-wrap">
      <div className="toolbar">
        <div className="search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        {toolbarExtra}
      </div>
      <div className="grid-scroll" ref={scrollRef}>
        <table className="grid">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  className={`${col.sortable ? '' : 'no-sort'} ${i === 0 && stickyFirstColumn ? 'sticky-col' : ''}`.trim()}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  style={col.align ? { textAlign: col.align } : undefined}
                >
                  {col.label} {col.sortable && sortArrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {virtual && virtual.topPad > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length} style={{ height: virtual.topPad, padding: 0, border: 'none' }} />
              </tr>
            )}
            {visibleRows.map((row) => (
              <tr key={rowId(row)}>
                {columns.map((col, i) => (
                  <td key={col.key} className={i === 0 && stickyFirstColumn ? 'sticky-col' : ''}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {virtual && virtual.bottomPad > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length} style={{ height: virtual.bottomPad, padding: 0, border: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footerNote && (
        <div style={{ padding: '10px 16px', fontSize: '11.5px', color: 'var(--text-faint)' }}>
          {sorted.length} of {footerNote}
        </div>
      )}
    </div>
  );
}
