'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { InlineTextCell, InlineOptionalTextCell, InlineNumberCell, LabeledSelectCell, TriStateCell } from './cells';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { SLIDER_GROUPS, INACTIVE_NOTES } from '@/lib/scoring/constants';

export interface InterestRow {
  key: string;
  label: string;
  group: string;
  emoji: string;
  /** Admin-set pill name; null = automatic. */
  shortName: string | null;
  /** What the pill says when shortName is blank. */
  autoShortName: string;
  updatedAt: string;
  /** Admin overrides of the code-defined list; null = use the built-in value. */
  labelOverride: string | null;
  groupOverride: string | null;
  hiddenOverride: boolean | null;
  tierOverride: string | null;
  orderOverride: number | null;
  /** The values in the code, for the placeholders and the explanations. */
  builtIn: { label: string; group: string; hidden: boolean; tier: string; position: number };
  /** Effective values after overrides. */
  hidden: boolean;
  tier: string;
  /** places with a written overview for this interest */
  written: number;
  /** places marked N/A for this interest */
  na: number;
  /** places in the catalog */
  total: number;
  /** completeness score, 0-100 */
  completeness: number;
  /** Most recent Gemini authoring pass: finished date (ISO) or null while in progress; undefined when none recorded. */
  lastPass?: { finishedAt: string | null; label: string };
}

const bandColor = (n: number) => (n < 50 ? 'var(--bad, #a8452a)' : n < 80 ? 'var(--warn, #a0731a)' : 'var(--good, #2b7d4f)');


export function InterestsGrid({ initialRows }: { initialRows: InterestRow[] }) {
  const [rows, setRows] = useState(initialRows);

  useUpdatedAtSync('interest', (entityId, updatedAt) => {
    setRows((rs) => rs.map((r) => (r.key === entityId ? { ...r, updatedAt } : r)));
  });
  const [domainFilter, setDomainFilter] = useState('');
  // Inactive (hidden) interests stay out of the list unless asked for, like every other admin screen that lists interests.
  const [showInactive, setShowInactive] = useState(false);
  const inactiveCount = rows.filter((r) => r.hidden).length;

  function patchRow(key: string, patch: Partial<InterestRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const visibleRows = useMemo(() => rows.filter((r) => (showInactive || !r.hidden) && (!domainFilter || r.group === domainFilter)), [rows, domainFilter, showInactive]);

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
    { key: 'label', label: 'Interest', sortable: true, sortValue: (r) => r.label, render: (r) => <div className="cell-inner"><Link href={`/admin/destinations/interests/${r.key}`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{r.label}</Link>{r.hidden && <span className="badge badge-moderate" title={INACTIVE_NOTES[r.key] ?? 'Inactive: hidden from travellers'}>Inactive</span>}{r.hidden && INACTIVE_NOTES[r.key] && <span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>{INACTIVE_NOTES[r.key]}</span>}</div> },
    {
      key: 'labelEdit',
      label: 'Name (edit)',
      render: (r) => (
        <InlineOptionalTextCell
          ctx={{ entityType: 'interest', entityId: r.key, entityLabel: r.label, field: 'label', fieldLabel: 'Interest name', loadedUpdatedAt: r.updatedAt }}
          value={r.labelOverride}
          setLocal={(v) => patchRow(r.key, { labelOverride: v, label: v ?? r.builtIn.label })}
          width={190}
          maxLength={60}
          placeholder={r.builtIn.label}
        />
      ),
    },
    {
      key: 'shortName',
      label: 'Pill name',
      sortable: true,
      sortValue: (r) => r.shortName ?? r.autoShortName,
      render: (r) => (
        <InlineOptionalTextCell
          ctx={{ entityType: 'interest', entityId: r.key, entityLabel: r.label, field: 'shortName', fieldLabel: 'Pill name', loadedUpdatedAt: r.updatedAt }}
          value={r.shortName}
          setLocal={(v) => patchRow(r.key, { shortName: v })}
          width={170}
          maxLength={30}
          placeholder={r.autoShortName}
        />
      ),
    },
    { key: 'key', label: 'Key', render: (r) => <div className="cell-inner" style={{ fontFamily: 'var(--font-plex-mono, monospace)', color: 'var(--text-faint)', fontSize: 11 }}>{r.key}</div> },
    {
      key: 'group',
      label: 'Domain',
      sortable: true,
      sortValue: (r) => r.group,
      render: (r) => (
        <LabeledSelectCell
          ctx={{ entityType: 'interest', entityId: r.key, entityLabel: r.label, field: 'groupName', fieldLabel: 'Domain', loadedUpdatedAt: r.updatedAt }}
          value={r.groupOverride}
          options={SLIDER_GROUPS.map((g) => ({ value: g, label: g }))}
          nullLabel={`Built-in: ${r.builtIn.group}`}
          setLocal={(v) => patchRow(r.key, { groupOverride: v, group: v ?? r.builtIn.group })}
          width={170}
        />
      ),
    },
    {
      key: 'hiddenEdit',
      label: 'Shown to travellers',
      sortable: true,
      sortValue: (r) => (r.hidden ? 1 : 0),
      render: (r) => (
        <TriStateCell
          ctx={{ entityType: 'interest', entityId: r.key, entityLabel: r.label, field: 'hidden', fieldLabel: 'Hidden from travellers', loadedUpdatedAt: r.updatedAt }}
          value={r.hiddenOverride === null ? null : !r.hiddenOverride}
          trueLabel="Shown"
          falseLabel="Inactive"
          nullLabel={`Built-in: ${r.builtIn.hidden ? 'inactive' : 'shown'}`}
          setLocal={(v) => patchRow(r.key, { hiddenOverride: v === null ? null : !v, hidden: v === null ? r.builtIn.hidden : !v })}
        />
      ),
    },
    {
      key: 'tier',
      label: 'Audience tier',
      sortable: true,
      sortValue: (r) => r.tier,
      render: (r) => (
        <LabeledSelectCell
          ctx={{ entityType: 'interest', entityId: r.key, entityLabel: r.label, field: 'audienceTier', fieldLabel: 'Audience tier', loadedUpdatedAt: r.updatedAt }}
          value={r.tierOverride}
          options={['iconic', 'popular', 'enthusiast', 'specialist'].map((t) => ({ value: t, label: t }))}
          nullLabel={`Built-in: ${r.builtIn.tier}`}
          setLocal={(v) => patchRow(r.key, { tierOverride: v, tier: v ?? r.builtIn.tier })}
          width={150}
        />
      ),
    },
    {
      key: 'order',
      label: 'Order',
      render: (r) => (
        <InlineNumberCell
          ctx={{ entityType: 'interest', entityId: r.key, entityLabel: r.label, field: 'sortOrder', fieldLabel: 'Position in the picker', loadedUpdatedAt: r.updatedAt }}
          value={r.orderOverride}
          setLocal={(v) => patchRow(r.key, { orderOverride: v })}
          width={70}
          step={1}
          min={1}
          max={500}
          placeholder={String(r.builtIn.position)}
        />
      ),
    },
    {
      key: 'completeness',
      label: 'Completeness',
      sortable: true,
      sortValue: (r) => r.completeness,
      render: (r) => (
        <div className="cell-inner" style={{ gap: 10 }} title="Content 50 · data columns 20 · scoring quality 10 · verification 10 · scope and rules 10. Open the interest page for what would raise it.">
          <span style={{ fontFamily: 'var(--font-plex-mono, monospace)', fontWeight: 700, color: bandColor(r.completeness), minWidth: 26, textAlign: 'right' }}>{r.completeness}</span>
          <div style={{ width: 110, height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${r.completeness}%`, height: '100%', background: bandColor(r.completeness) }} />
          </div>
        </div>
      ),
    },
    {
      key: 'written',
      label: 'Written overview',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.written,
      render: (r) => (
        <div className="cell-inner" style={{ justifyContent: 'flex-end' }}>
          <span style={{ fontFamily: 'var(--font-plex-mono, monospace)', fontSize: 11.5 }}>
            {r.written} / {r.total}
          </span>
        </div>
      ),
    },
    {
      key: 'lastPass',
      label: 'Last Gemini pass',
      sortable: true,
      sortValue: (r) => (r.lastPass ? (r.lastPass.finishedAt ?? '9999') : ''),
      render: (r) => (
        <div className="cell-inner" title={r.lastPass?.label ?? 'No Gemini authoring pass recorded'} style={{ fontSize: 12 }}>
          {!r.lastPass ? <span style={{ color: 'var(--text-faint)' }}>none</span> : r.lastPass.finishedAt ? new Date(r.lastPass.finishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : <span style={{ color: 'var(--warn)' }}>in progress</span>}
        </div>
      ),
    },
    {
      key: 'na',
      label: 'N/A places',
      sortable: true,
      align: 'right',
      sortValue: (r) => r.na,
      render: (r) => <div className="cell-inner" style={{ justifyContent: 'flex-end', fontFamily: 'var(--font-plex-mono, monospace)' }}>{r.na}</div>,
    },
    {
      key: 'page',
      label: 'Page',
      render: (r) => (
        <div className="cell-inner">
          <Link
            href={`/admin/destinations/interests/${r.key}`}
            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 6, padding: '3px 9px', fontSize: 12 }}
          >
            Open page →
          </Link>
        </div>
      ),
    },
  ];

  return (
    <AdminDataGrid
      rows={visibleRows}
      columns={columns}
      rowId={(r) => r.key}
      searchText={(r) => `${r.label} ${r.shortName ?? r.autoShortName} ${r.key}`}
      searchPlaceholder="Search interest…"
      stickyFirstColumn={false}
      footerNote={`${visibleRows.length} of ${rows.length} interests${!showInactive && inactiveCount ? ` · ${inactiveCount} inactive hidden` : ''} · same grid scales as more per-interest fields get added`}
      toolbarExtra={
        <>
          <label className="filter-label" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginRight: 10 }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive ({inactiveCount})
          </label>
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
