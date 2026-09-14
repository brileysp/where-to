'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { AdvisoryPanelCell, type TravelAdvisory } from './cells';
import { useUpdatedAtSync } from './useUpdatedAtSync';

export type { TravelAdvisory } from './cells';

export interface AdvisoryRow {
  id: string;
  name: string;
  emoji: string;
  continent: string;
  travelAdvisories: TravelAdvisory[];
  updatedAt: string; // ISO
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;

function isStale(lastReviewed: string): boolean {
  return (Date.now() - new Date(`${lastReviewed}T00:00:00`).getTime()) / MS_PER_MONTH > 6;
}

type Filter = 'active' | 'stale' | 'all';

export function AdvisoriesGrid({ initialRows }: { initialRows: AdvisoryRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<Filter>('active');

  useUpdatedAtSync('destination', (entityId, updatedAt) => {
    setRows((rs) => rs.map((r) => (r.id === entityId ? { ...r, updatedAt } : r)));
  });

  function patchRow(id: string, patch: Partial<AdvisoryRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const activeCount = rows.filter((r) => r.travelAdvisories.length > 0).length;
  const staleCount = rows.filter((r) => r.travelAdvisories.some((a) => isStale(a.lastReviewed))).length;

  const visibleRows = useMemo(() => {
    let filtered = rows;
    if (filter === 'active') filtered = rows.filter((r) => r.travelAdvisories.length > 0);
    if (filter === 'stale') filtered = rows.filter((r) => r.travelAdvisories.some((a) => isStale(a.lastReviewed)));
    return [...filtered].sort((a, b) => b.travelAdvisories.length - a.travelAdvisories.length);
  }, [rows, filter]);

  const columns: GridColumn<AdvisoryRow>[] = [
    {
      key: 'name',
      label: 'Place',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="cell-inner">
          <span style={{ fontSize: 15 }}>{r.emoji}</span>
          <Link href={`/admin/destinations/${r.id}/profile`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
            {r.name}
          </Link>
        </div>
      ),
    },
    { key: 'continent', label: 'Continent', sortable: true, sortValue: (r) => r.continent, render: (r) => <div className="cell-inner">{r.continent}</div> },
    {
      key: 'travelAdvisories',
      label: 'Advisories',
      render: (r) => (
        <AdvisoryPanelCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'travelAdvisories', fieldLabel: 'Advisories', loadedUpdatedAt: r.updatedAt }}
          value={r.travelAdvisories}
          setLocal={(v) => patchRow(r.id, { travelAdvisories: v })}
        />
      ),
    },
    {
      key: 'lastReviewed',
      label: 'Last reviewed',
      render: (r) =>
        r.travelAdvisories.length === 0 ? (
          <div className="cell-inner" style={{ color: 'var(--text-faint)' }}>
            —
          </div>
        ) : (
          <div className="cell-inner wrap" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            {r.travelAdvisories.map((a, i) => (
              <span key={i} style={{ fontSize: 11.5, color: isStale(a.lastReviewed) ? 'var(--warn)' : 'var(--text-dim)', fontWeight: isStale(a.lastReviewed) ? 700 : 400 }}>
                {new Date(`${a.lastReviewed}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                {isStale(a.lastReviewed) ? ' · re-check' : ''}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      sortValue: (r) => r.id,
      render: (r) => (
        <div className="cell-inner" style={{ fontFamily: 'var(--font-plex-mono, monospace)', color: 'var(--text-faint)', fontSize: 11 }}>
          {r.id}
        </div>
      ),
    },
  ];

  return (
    <AdminDataGrid
      rows={visibleRows}
      columns={columns}
      rowId={(r) => r.id}
      searchText={(r) => `${r.name} ${r.continent} ${r.id}`}
      searchPlaceholder="Search place, continent…"
      toolbarExtra={
        <div className="chip-toggle">
          <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')} type="button">
            Has advisory ({activeCount})
          </button>
          <button className={filter === 'stale' ? 'active' : ''} onClick={() => setFilter('stale')} type="button">
            Needs re-review ({staleCount})
          </button>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')} type="button">
            All {rows.length}
          </button>
        </div>
      }
      footerNote={`${rows.length} places (${filter} filter) · shown regardless of which interest slider a visitor has selected, never read by the scoring engine`}
    />
  );
}
