'use client';

import { useMemo, useState } from 'react';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { InlineTextCell } from './cells';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { SLIDER_GROUPS } from '@/lib/scoring/constants';

export interface InterestRow {
  key: string;
  label: string;
  group: string;
  emoji: string;
  updatedAt: string;
}

const GROUP_COLORS: Record<string, string> = {
  'Nature & Wildlife': '#3a7d4f',
  'Sports & Recreation': '#3868a8',
  'Culture & Discovery': '#8a5a3a',
  'Relaxation & Leisure': '#a3548a',
  Value: '#5b6255',
};

export function InterestsGrid({ initialRows }: { initialRows: InterestRow[] }) {
  const [rows, setRows] = useState(initialRows);

  useUpdatedAtSync('interest', (entityId, updatedAt) => {
    setRows((rs) => rs.map((r) => (r.key === entityId ? { ...r, updatedAt } : r)));
  });
  const [domainFilter, setDomainFilter] = useState('');

  function patchRow(key: string, patch: Partial<InterestRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const visibleRows = useMemo(() => (domainFilter ? rows.filter((r) => r.group === domainFilter) : rows), [rows, domainFilter]);

  const columns: GridColumn<InterestRow>[] = [
    {
      key: 'emoji',
      label: 'Emoji',
      render: (r) => (
        <InlineTextCell
          ctx={{ entityType: 'interest', entityId: r.key, entityLabel: r.label, field: 'emoji', fieldLabel: 'Interest emoji', loadedUpdatedAt: r.updatedAt }}
          value={r.emoji}
          setLocal={(v) => patchRow(r.key, { emoji: v })}
          width={40}
          align="center"
          maxLength={6}
        />
      ),
    },
    { key: 'label', label: 'Interest', sortable: true, sortValue: (r) => r.label, render: (r) => <div className="cell-inner" style={{ fontWeight: 600 }}>{r.label}</div> },
    { key: 'key', label: 'Key', render: (r) => <div className="cell-inner" style={{ fontFamily: 'var(--font-plex-mono, monospace)', color: 'var(--text-faint)', fontSize: 11 }}>{r.key}</div> },
    {
      key: 'group',
      label: 'Domain',
      sortable: true,
      sortValue: (r) => r.group,
      render: (r) => (
        <div className="cell-inner interest-tag">
          <span style={{ width: 8, height: 8, borderRadius: 3, background: GROUP_COLORS[r.group] ?? 'var(--text-faint)', flexShrink: 0, display: 'inline-block' }} />
          {r.group}
        </div>
      ),
    },
  ];

  return (
    <AdminDataGrid
      rows={visibleRows}
      columns={columns}
      rowId={(r) => r.key}
      searchText={(r) => `${r.label} ${r.key}`}
      searchPlaceholder="Search interest…"
      stickyFirstColumn={false}
      footerNote={`${visibleRows.length} of ${rows.length} interests · same grid scales as more per-interest fields get added`}
      toolbarExtra={
        <>
          <span className="filter-label">Domain</span>
          <select className="filter-select" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
            <option value="">All domains</option>
            {SLIDER_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </>
      }
    />
  );
}
