'use client';

import { useMemo, useState } from 'react';
import { AdminDataGrid, type GridColumn } from '../AdminDataGrid';
import type { InterestPageData, InterestPlaceRow, PlaceStatus, ReviewRow } from '@/lib/admin/interest-pages/types';
import type { InterestFactValue } from '@/lib/db/schema';
import { FACT_GROUP_LABELS, bestOdds, divingFormatCallouts, likelihoodRank, sightingsCount, visibleFactDefs, type FactDef } from '@/lib/admin/interest-pages/config';
import { FactCell, factToText } from './FactCell';
import { CompareView } from './CompareView';
import { NaReasonChip, type NaChange } from './NaReasonChip';
import Link from 'next/link';
import { NaToggle } from '../NaToggle';
import { OverviewCell, MonthlyCell, StagedButtons } from './InterestTextCells';
import { PLACE_TYPES, type PlaceType } from '@/lib/admin/interest-pages/place-types';

const STATUS_CHIP: Record<PlaceStatus, { label: string; tone: string }> = {
  live: { label: 'Live', tone: 'good' },
  staged: { label: 'Staged', tone: 'warn' },
  none: { label: 'No text', tone: 'dim' },
  na: { label: 'N/A', tone: 'dim' },
};
const HEAD_CLASS = { app: 'ip-data-head', info: 'ip-info-head', draw: 'ip-draw-head', new: 'ip-new-head' } as const;
const peakOf = (p: InterestPlaceRow) => (p.monthly.length ? Math.max(...p.monthly) : 0);

function Spark({ monthly }: { monthly: number[] }) {
  return <span className="ip-spark" title={monthly.join(', ')}>{monthly.map((v, i) => <i key={i} style={{ height: Math.max(2, (v / 10) * 18) }} />)}</span>;
}

export function DataSection({ data, places, reviews, onFact, onNa, onPlace }: { data: InterestPageData; places: InterestPlaceRow[]; reviews: ReviewRow[]; onNa: (placeId: string, change: NaChange) => void; onPlace: (placeId: string, patch: Partial<InterestPlaceRow>) => void; onFact: (placeId: string, key: string, v: InterestFactValue) => void }) {
  const [view, setView] = useState<'table' | 'compare'>('table');
  // 'active' (the default) is everything except places scored N/A; '' is All, including N/A.
  const [status, setStatus] = useState<'' | 'active' | PlaceStatus>('active');
  const defs = useMemo(() => visibleFactDefs(data.key), [data.key]);
  const [placeType, setPlaceType] = useState<'' | PlaceType>('');
  const lastReview = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reviews) if (r.placeId && (m.get(r.placeId) ?? '') < r.reviewedOn) m.set(r.placeId, r.reviewedOn);
    return m;
  }, [reviews]);

  const rows = useMemo(() => places.filter((p) => (!status || (status === 'active' ? p.status !== 'na' : p.status === status)) && (!placeType || p.placeType === placeType)), [places, status, placeType]);

  const columns: GridColumn<InterestPlaceRow>[] = [
    { key: 'name', label: 'Place', sortable: true, sortValue: (p) => p.name, render: (p) => <div className="cell-inner" style={{ fontWeight: 600 }}><Link href={`/admin/destinations/${p.id}/profile`} title="Open this place's month-by-month profile" style={{ color: 'inherit', textDecoration: 'none' }}>{p.name}</Link></div> },
    { key: 'region', label: 'Region', sortable: true, sortValue: (p) => p.region, render: (p) => <div className="cell-inner ip-muted">{p.region}</div> },
    { key: 'peak', label: 'Peak', sortable: true, align: 'right', sortValue: (p) => peakOf(p), render: (p) => <div className="cell-inner ip-mono" style={{ justifyContent: 'flex-end', fontWeight: 700 }}>{p.status === 'na' ? '—' : peakOf(p).toFixed(1)}</div> },
    { key: 'season', label: 'Season', render: (p) => <div className="cell-inner">{p.status === 'na' ? null : <Spark monthly={p.monthly} />}</div> },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (p) => p.status,
      render: (p) => (
        <div className="cell-inner" style={{ gap: 8, flexWrap: 'wrap' }}>
          {p.status === 'na' ? (
            <NaReasonChip interestKey={data.key} place={p} onChange={onNa} />
          ) : (
            <>
              <span className={`ip-chip ${STATUS_CHIP[p.status].tone}`}>{STATUS_CHIP[p.status].label}</span>
              <StagedButtons interestKey={data.key} place={p} onPlace={onPlace} />
              <NaToggle
                compact
                interestKey={data.key}
                interestLabel={data.label}
                placeId={p.id}
                placeName={p.name}
                isNa={false}
                onChanged={(isNa, reason) => { if (isNa) onNa(p.id, { kind: 'reason', info: { reason: reason ?? '', source: 'manual', by: 'you', at: new Date().toISOString() } }); }}
              />
            </>
          )}
        </div>
      ),
    },
    { key: 'overview', label: 'Overview', render: (p) => <OverviewCell interestKey={data.key} place={p} onPlace={onPlace} /> },
    { key: 'monthlyText', label: 'Monthly text', render: (p) => <MonthlyCell interestKey={data.key} place={p} onPlace={onPlace} /> },
    ...defs.flatMap<GridColumn<InterestPlaceRow>>((def, i) => {
      const extra: GridColumn<InterestPlaceRow>[] = data.key === 'diving' && def.key === 'accessStyle'
        ? [{
            key: 'formatCallout',
            label: 'Format callout (calculated)',
            sortable: true,
            headClass: 'ip-data-head',
            sortValue: (p) => divingFormatCallouts(p.facts).reasons.length,
            render: (p) => {
              const c = divingFormatCallouts(p.facts);
              if (!c.recorded) return <div className="cell-inner ip-faint">—</div>;
              if (c.reasons.length === 0) return <div className="cell-inner"><span className="ip-chip dim" title="Typical: the text does not mention the format">Typical</span></div>;
              return <div className="cell-inner" title="The overview calls these out in one short clause" style={{ whiteSpace: 'normal' }}>{c.reasons.join('; ')}</div>;
            },
          }]
        : def.type === 'likelihood' && defs.findIndex((d) => d.type === 'likelihood') === i
        ? [{
            key: 'sightings',
            label: 'Likely or better',
            sortable: true,
            align: 'right',
            headClass: 'ip-data-head',
            sortValue: (p) => sightingsCount(defs, p.facts).good,
            render: (p) => {
              const c = sightingsCount(defs, p.facts);
              return <div className="cell-inner ip-mono" style={{ justifyContent: 'flex-end', fontWeight: 700 }} title={`${c.good} of ${c.total} animals Guaranteed or Likely (${c.recorded} recorded)`}>{c.recorded === 0 ? '—' : `${c.good} of ${c.total}`}</div>;
            },
          }]
        : [];
      return [...extra, ...[def].map<GridColumn<InterestPlaceRow>>((def) => {
      const numeric = def.type === 'int' || def.type === 'rating';
      return {
        key: def.key,
        label: def.label,
        sortable: true,
        align: numeric ? 'right' : 'left',
        headClass: HEAD_CLASS[FACT_GROUP_LABELS[def.group].tone],
        cellClass: def.group === 'planning' ? 'ip-new-cell' : '',
        sortValue: (p) => {
          const v = p.facts[def.key];
          if (def.type === 'likelihood') return likelihoodRank(v);
          if (def.animals) return bestOdds(v);
          if (numeric) return typeof v === 'number' ? v : -1;
          return factToText(def, v).toLowerCase();
        },
        render: (p) => <FactCell key={`${p.id}:${def.key}:${factToText(def, p.facts[def.key])}`} interestKey={data.key} placeId={p.id} def={def} value={p.facts[def.key]} onSaved={onFact} />,
      };
    })];
    }),
    { key: 'reviewed', label: 'Last reviewed', sortable: true, sortValue: (p) => lastReview.get(p.id) ?? '', render: (p) => <div className="cell-inner ip-mono ip-faint">{lastReview.get(p.id) ?? '—'}</div> },
  ];

  // Filtered to N/A, the empty Peak and Season columns give way to the reason, so every reason can be read in one pass.
  const naReasonColumn: GridColumn<InterestPlaceRow> = {
    key: 'naReason',
    label: 'Why not applicable',
    sortable: true,
    sortValue: (p) => p.naReason?.reason ?? '',
    render: (p) => <div className="cell-inner ip-nareason-cell">{p.naReason?.reason ?? <span className="ip-faint">No reason recorded</span>}</div>,
  };
  const shownColumns = status === 'na' ? [columns[0], columns[1], naReasonColumn, ...columns.slice(4)] : columns;

  const groupsPresent = [...new Set(defs.map((d) => d.group))];

  return (
    <div className="ip-section">
      <div className="ip-toolbar">
        {defs.length > 0 && (
          <>
            <span className="ip-toollabel">View</span>
            <div className="ip-seg">
              <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>All places</button>
              <button className={view === 'compare' ? 'on' : ''} onClick={() => setView('compare')}>Compare two places</button>
            </div>
          </>
        )}
        {view === 'table' && defs.length > 0 && (
          <span className="ip-legend">
            <span className="ip-toollabel">Column colors</span>
            {groupsPresent.map((g) => {
              const meta = FACT_GROUP_LABELS[g];
              const color = meta.tone === 'app' ? 'var(--good)' : meta.tone === 'draw' ? 'var(--warn)' : meta.tone === 'info' ? 'var(--accent)' : 'var(--cat-1)';
              return <span key={g} style={{ color }}><i style={{ background: color }} />{meta.label}</span>;
            })}
          </span>
        )}
      </div>
      {defs.length === 0 && <div className="ip-note">Interest-specific columns for this interest have not been defined yet. For now the table shows place, region, peak, season, status and last review date.</div>}

      {view === 'table' ? (
        <div className="ip-card ip-gridcard" style={{ padding: 0 }}>
          <AdminDataGrid
            rows={rows}
            columns={shownColumns}
            rowId={(p) => p.id}
            searchText={(p) => `${p.name} ${p.region} ${p.placeType} ${defs.filter((d) => d.animals || d.key === 'headlineBirds' || d.key === 'headlineAnimals').map((d) => factToText(d, p.facts[d.key])).join(' ')}`}
            searchPlaceholder={data.key === 'birding' ? 'Search place, region or bird…' : 'Search place, region or animal…'}
            defaultSort={{ col: 'peak', dir: -1 }}
            footerNote={`${rows.length} of ${places.length} places`}
            toolbarExtra={
              <>
                <span className="filter-label">Status</span>
                <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value as '' | 'active' | PlaceStatus)}>
                  <option value="active">Active (not N/A)</option>
                  <option value="">All (includes N/A)</option>
                  <option value="live">Live</option>
                  <option value="staged">Staged, not live</option>
                  <option value="none">No text yet</option>
                  <option value="na">N/A</option>
                </select>
                <span className="filter-label">Place type</span>
                <select className="filter-select" value={placeType} onChange={(e) => setPlaceType(e.target.value as '' | PlaceType)}>
                  <option value="">All types</option>
                  {PLACE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            }
          />
        </div>
      ) : (
        <CompareView data={data} places={places} defs={defs as FactDef[]} />
      )}
    </div>
  );
}
