'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { MonthMultiSelectCell, CheckboxCell } from './cells';
import { useUpdatedAtSync } from './useUpdatedAtSync';

export interface SeasonalFlagsRow {
  id: string;
  name: string;
  emoji: string;
  continent: string;
  // Field names below match the Drizzle column property names exactly
  // (e.g. dryMonths, not dry) — applyAdminEdits uses `field` directly as
  // the .set() key, so this can't use ScoringDestination's shorter names.
  dryMonths: number[];
  wetMonths: number[];
  hotMonths: number[];
  coldMonths: number[];
  peakMonths: number[];
  lowMonths: number[];
  wildlifePeakMonths: number[];
  wildlifeClosedMonths: number[];
  birdingPeakMonths: number[];
  hikingBestMonths: number[];
  hikingWorstMonths: number[];
  inaccessibleMonths: number[];
  swimHazardMonths: number[];
  noSnowMonths: number[];
  shopClosures: boolean;
  updatedAt: string; // ISO
}

const MONTH_ARRAY_FIELDS: Array<{ key: keyof SeasonalFlagsRow & string; label: string; fieldLabel: string; hint?: string }> = [
  { key: 'dryMonths', label: 'Dry', fieldLabel: 'Dry months' },
  { key: 'wetMonths', label: 'Wet', fieldLabel: 'Wet months' },
  { key: 'hotMonths', label: 'Hot', fieldLabel: 'Hot months' },
  { key: 'coldMonths', label: 'Cold', fieldLabel: 'Cold months' },
  { key: 'peakMonths', label: 'Peak', fieldLabel: 'Peak (busy) months' },
  { key: 'lowMonths', label: 'Low', fieldLabel: 'Low (quiet) months' },
  { key: 'wildlifePeakMonths', label: 'Wildlife peak', fieldLabel: 'Wildlife peak months' },
  { key: 'wildlifeClosedMonths', label: 'Wildlife closed', fieldLabel: 'Wildlife closed months', hint: 'Reserve/park closed this month.' },
  { key: 'birdingPeakMonths', label: 'Birding peak', fieldLabel: 'Birding peak months' },
  { key: 'hikingBestMonths', label: 'Hiking best', fieldLabel: 'Hiking best months', hint: 'Overrides the dry/wet+hot+cold fallback for hiking-formula sliders.' },
  { key: 'hikingWorstMonths', label: 'Hiking worst', fieldLabel: 'Hiking worst months' },
  { key: 'inaccessibleMonths', label: 'Inaccessible', fieldLabel: 'Inaccessible months', hint: 'Hard floor — zeroes every slider this month.' },
  { key: 'swimHazardMonths', label: 'Swim hazard', fieldLabel: 'Swim hazard months' },
  { key: 'noSnowMonths', label: 'No snow', fieldLabel: 'No-snow months', hint: 'Hard floor for snowsports, independent of hot/dry flags.' },
];

export function SeasonalFlagsGrid({ initialRows }: { initialRows: SeasonalFlagsRow[] }) {
  const [rows, setRows] = useState(initialRows);

  useUpdatedAtSync('destination', (entityId, updatedAt) => {
    setRows((rs) => rs.map((r) => (r.id === entityId ? { ...r, updatedAt } : r)));
  });

  function patchRow(id: string, patch: Partial<SeasonalFlagsRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const columns: GridColumn<SeasonalFlagsRow>[] = [
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
    ...MONTH_ARRAY_FIELDS.map(
      ({ key, label, fieldLabel, hint }): GridColumn<SeasonalFlagsRow> => ({
        key,
        label,
        render: (r) => (
          <MonthMultiSelectCell
            ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: key, fieldLabel: hint ? `${fieldLabel} — ${hint}` : fieldLabel, loadedUpdatedAt: r.updatedAt }}
            value={r[key] as number[]}
            setLocal={(v) => patchRow(r.id, { [key]: v } as Partial<SeasonalFlagsRow>)}
          />
        ),
      }),
    ),
    {
      key: 'shopClosures',
      label: 'Shop closures',
      render: (r) => (
        <CheckboxCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'shopClosures', fieldLabel: 'Shop closures', loadedUpdatedAt: r.updatedAt }}
          value={r.shopClosures}
          setLocal={(v) => patchRow(r.id, { shopClosures: v })}
        />
      ),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      sortValue: (r) => r.updatedAt,
      render: (r) => <div className="cell-inner" style={{ color: 'var(--text-faint)' }}>{new Date(r.updatedAt).toLocaleDateString()}</div>,
    },
  ];

  return (
    <AdminDataGrid
      rows={rows}
      columns={columns}
      rowId={(r) => r.id}
      searchText={(r) => `${r.name} ${r.continent} ${r.id}`}
      searchPlaceholder="Search place…"
      footerNote={`${initialRows.length} places · month flags editable inline — a hard floor (inaccessible/noSnow) zeroes the relevant sliders that month regardless of any other flag`}
    />
  );
}
