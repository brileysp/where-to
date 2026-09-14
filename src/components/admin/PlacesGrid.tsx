'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { InlineTextCell, InlineSelectCell, SeverityCell, BandCell, TextFieldPanelCell, MonthlyWeatherCell, JsonPanelCell, type BandOption } from './cells';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { BAND_DIMENSIONS } from '@/lib/scoring/constants';

export interface PlaceRow {
  id: string;
  name: string;
  emoji: string;
  region: string;
  continent: string;
  overview: string | null; // mockup's "About" column
  about: string; // mockup's "Seasons overview" column
  monthlyWeather: (string | null)[] | null;
  peakIntensity: string | null;
  hotSeverity: string | null;
  coldSeverity: string | null;
  wetSeverity: string | null;
  crowdBaseline: string | null;
  costMin: string | null;
  costMax: string | null;
  costOverview: string | null;
  climate: string;
  budgetBands: string[];
  vibeBands: string[];
  physicalBands: string[];
  placeType: string | null;
  audienceBands: string[];
  searchAliases: string[];
  specialSeasons: Array<{ months: number[]; text: string }>;
  travelAdvisories: Array<{ category: string; severity: string; text: string; lastReviewed: string }>;
  updatedAt: string; // ISO
}

const CLIMATES = ['tropical', 'desert', 'mediterranean', 'temperate', 'highland', 'polar'];
const COST_TIERS = ['$', '$$', '$$$', '$$$$', '$$$$$'];
// Place migration Phase 0 taxonomy (docs/final-architecture-plan.md) —
// deliberately not a pg enum yet, since the 10-value set is unconfirmed
// (see the doc comment on schema.ts's `placeType` column). Kept here
// rather than a shared constants module since this admin grid is the
// only place in the app that reads/writes it today.
const PLACE_TYPES = [
  'country', 'region', 'state_province', 'island', 'city',
  'neighborhood', 'national_park', 'wilderness_area', 'coastal_area', 'day_trip',
];
// See the doc comment on schema.ts's `audienceBands` column — one tier
// per destination, describing how broad an audience it appeals to.
const AUDIENCE_TIERS = ['iconic', 'popular', 'enthusiast', 'specialist'];

const SHORT_LABELS: Record<string, string> = {
  secluded: 'Secluded', easygoing: 'Easygoing', lively: 'Lively', highenergy: 'High-Energy',
  easy: 'Easy', moderate: 'Moderate', active: 'Active', challenging: 'Challenging',
  basic: 'Basic', comfortable: 'Comfortable', highend: 'High-End', luxury: 'Luxury',
};
const budgetDim = BAND_DIMENSIONS.find((d) => d.key === 'budget')!;
const vibeDim = BAND_DIMENSIONS.find((d) => d.key === 'vibe')!;
const physicalDim = BAND_DIMENSIONS.find((d) => d.key === 'physical')!;
const BUDGET_OPTIONS: BandOption[] = budgetDim.bands.map((b) => ({ key: b.key, label: b.label, short: SHORT_LABELS[b.key] ?? b.label }));
const VIBE_OPTIONS: BandOption[] = vibeDim.bands.map((b) => ({ key: b.key, label: b.label, short: SHORT_LABELS[b.key] ?? b.label }));
const PHYSICAL_OPTIONS: BandOption[] = physicalDim.bands.map((b) => ({ key: b.key, label: b.label, short: SHORT_LABELS[b.key] ?? b.label }));

export function PlacesGrid({ initialRows }: { initialRows: PlaceRow[] }) {
  const [rows, setRows] = useState(initialRows);

  useUpdatedAtSync('destination', (entityId, updatedAt) => {
    setRows((rs) => rs.map((r) => (r.id === entityId ? { ...r, updatedAt } : r)));
  });

  function patchRow(id: string, patch: Partial<PlaceRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const columns: GridColumn<PlaceRow>[] = [
    {
      key: 'name',
      label: 'Place',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="cell-inner">
          <span style={{ fontSize: 15 }}>{r.emoji}</span>
          <Link href={`/admin/destinations/${r.id}/profile`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }} title="Open full month × interest profile">
            {r.name}
          </Link>
          {r.travelAdvisories.length > 0 && (
            <Link
              href="/admin/destinations/advisories"
              className="adv-flag"
              title={`${r.travelAdvisories.length} active advisor${r.travelAdvisories.length === 1 ? 'y' : 'ies'} — click to view`}
            >
              !
            </Link>
          )}
        </div>
      ),
    },
    {
      key: 'emoji',
      label: 'Emoji',
      render: (r) => (
        <InlineTextCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'emoji', fieldLabel: 'Place emoji', loadedUpdatedAt: r.updatedAt }}
          value={r.emoji}
          setLocal={(v) => patchRow(r.id, { emoji: v })}
          width={40}
          align="center"
          maxLength={6}
        />
      ),
    },
    {
      key: 'region',
      label: 'Region',
      render: (r) => (
        <InlineTextCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'region', fieldLabel: 'Region', loadedUpdatedAt: r.updatedAt }}
          value={r.region}
          setLocal={(v) => patchRow(r.id, { region: v })}
          width={140}
        />
      ),
    },
    { key: 'continent', label: 'Continent', sortable: true, sortValue: (r) => r.continent, render: (r) => <div className="cell-inner">{r.continent}</div> },
    {
      key: 'placeType',
      label: 'Place type',
      sortable: true,
      sortValue: (r) => r.placeType ?? '',
      render: (r) => (
        <InlineSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'placeType', fieldLabel: 'Place type', loadedUpdatedAt: r.updatedAt }}
          value={r.placeType}
          options={PLACE_TYPES}
          setLocal={(v) => patchRow(r.id, { placeType: v })}
        />
      ),
    },
    { key: 'id', label: 'ID', sortable: true, sortValue: (r) => r.id, render: (r) => <div className="cell-inner" style={{ fontFamily: 'var(--font-plex-mono, monospace)', color: 'var(--text-faint)', fontSize: 11 }}>{r.id}</div> },
    {
      key: 'overview',
      label: 'About',
      render: (r) => (
        <TextFieldPanelCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'overview', fieldLabel: 'About', loadedUpdatedAt: r.updatedAt }}
          value={r.overview}
          setLocal={(v) => patchRow(r.id, { overview: v })}
          hint="The short identity/'why go here' line shown near the top of the destination page."
        />
      ),
    },
    {
      key: 'about',
      label: 'Seasons overview',
      render: (r) => (
        <TextFieldPanelCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'about', fieldLabel: 'Seasons overview', loadedUpdatedAt: r.updatedAt }}
          value={r.about}
          setLocal={(v) => patchRow(r.id, { about: v ?? '' })}
          hint="A short general summary of the seasonal pattern — distinct from the month-by-month detail in Seasons detail."
        />
      ),
    },
    {
      key: 'monthlyWeather',
      label: 'Seasons detail',
      render: (r) => (
        <MonthlyWeatherCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'monthlyWeather', fieldLabel: 'Seasons detail', loadedUpdatedAt: r.updatedAt }}
          value={r.monthlyWeather}
          setLocal={(v) => patchRow(r.id, { monthlyWeather: v })}
        />
      ),
    },
    {
      key: 'peakIntensity',
      label: 'Peak intensity',
      sortable: true,
      sortValue: (r) => r.peakIntensity ?? '',
      render: (r) => (
        <InlineSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'peakIntensity', fieldLabel: 'Peak intensity', loadedUpdatedAt: r.updatedAt }}
          value={r.peakIntensity}
          options={['mild', 'moderate', 'extreme']}
          setLocal={(v) => patchRow(r.id, { peakIntensity: v })}
        />
      ),
    },
    {
      key: 'hotSeverity',
      label: 'Hot',
      sortable: true,
      sortValue: (r) => r.hotSeverity ?? '',
      render: (r) => (
        <SeverityCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'hotSeverity', fieldLabel: 'Hot severity', loadedUpdatedAt: r.updatedAt }}
          value={r.hotSeverity}
          setLocal={(v) => patchRow(r.id, { hotSeverity: v })}
        />
      ),
    },
    {
      key: 'coldSeverity',
      label: 'Cold',
      sortable: true,
      sortValue: (r) => r.coldSeverity ?? '',
      render: (r) => (
        <SeverityCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'coldSeverity', fieldLabel: 'Cold severity', loadedUpdatedAt: r.updatedAt }}
          value={r.coldSeverity}
          setLocal={(v) => patchRow(r.id, { coldSeverity: v })}
        />
      ),
    },
    {
      key: 'wetSeverity',
      label: 'Wet',
      sortable: true,
      sortValue: (r) => r.wetSeverity ?? '',
      render: (r) => (
        <SeverityCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'wetSeverity', fieldLabel: 'Wet severity', loadedUpdatedAt: r.updatedAt }}
          value={r.wetSeverity}
          setLocal={(v) => patchRow(r.id, { wetSeverity: v })}
        />
      ),
    },
    {
      key: 'crowdBaseline',
      label: 'Crowd baseline',
      sortable: true,
      sortValue: (r) => r.crowdBaseline ?? '',
      render: (r) => (
        <InlineSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'crowdBaseline', fieldLabel: 'Crowd baseline', loadedUpdatedAt: r.updatedAt }}
          value={r.crowdBaseline}
          options={['low', 'high']}
          setLocal={(v) => patchRow(r.id, { crowdBaseline: v })}
        />
      ),
    },
    {
      key: 'costRange',
      label: 'Cost range',
      sortable: true,
      sortValue: (r) => r.costMin ?? '',
      render: (r) => (
        <div className="cell-inner" style={{ gap: 4 }}>
          <InlineSelectCell
            ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'costMin', fieldLabel: 'Cost floor', loadedUpdatedAt: r.updatedAt }}
            value={r.costMin}
            options={COST_TIERS}
            setLocal={(v) => patchRow(r.id, { costMin: v })}
          />
          <span>–</span>
          <InlineSelectCell
            ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'costMax', fieldLabel: 'Cost ceiling', loadedUpdatedAt: r.updatedAt }}
            value={r.costMax}
            options={COST_TIERS}
            setLocal={(v) => patchRow(r.id, { costMax: v })}
          />
        </div>
      ),
    },
    {
      key: 'costOverview',
      label: 'Cost overview',
      render: (r) => (
        <TextFieldPanelCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'costOverview', fieldLabel: 'Cost overview', loadedUpdatedAt: r.updatedAt }}
          value={r.costOverview}
          setLocal={(v) => patchRow(r.id, { costOverview: v })}
          hint="Shown on the Costs tab as the short lead-in above itemized prices."
        />
      ),
    },
    {
      key: 'climate',
      label: 'Climate',
      sortable: true,
      sortValue: (r) => r.climate,
      render: (r) => (
        <InlineSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'climate', fieldLabel: 'Climate', loadedUpdatedAt: r.updatedAt }}
          value={r.climate}
          options={CLIMATES}
          nullable={false}
          setLocal={(v) => patchRow(r.id, { climate: v ?? r.climate })}
        />
      ),
    },
    {
      key: 'budgetBands',
      label: 'Budget & Comfort',
      render: (r) => (
        <BandCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'budgetBands', fieldLabel: 'Budget & Comfort', loadedUpdatedAt: r.updatedAt }}
          value={r.budgetBands}
          options={BUDGET_OPTIONS}
          setLocal={(v) => patchRow(r.id, { budgetBands: v })}
        />
      ),
    },
    {
      key: 'vibeBands',
      label: 'Social Vibe',
      render: (r) => (
        <BandCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'vibeBands', fieldLabel: 'Social Vibe', loadedUpdatedAt: r.updatedAt }}
          value={r.vibeBands}
          options={VIBE_OPTIONS}
          setLocal={(v) => patchRow(r.id, { vibeBands: v })}
        />
      ),
    },
    {
      key: 'physicalBands',
      label: 'Physical Demands',
      render: (r) => (
        <BandCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'physicalBands', fieldLabel: 'Physical Demands', loadedUpdatedAt: r.updatedAt }}
          value={r.physicalBands}
          options={PHYSICAL_OPTIONS}
          setLocal={(v) => patchRow(r.id, { physicalBands: v })}
        />
      ),
    },
    {
      key: 'audienceBands',
      label: 'Audience',
      sortable: true,
      sortValue: (r) => r.audienceBands[0] ?? '',
      render: (r) => (
        <InlineSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'audienceBands', fieldLabel: 'Audience', loadedUpdatedAt: r.updatedAt }}
          value={r.audienceBands[0] ?? null}
          options={AUDIENCE_TIERS}
          setLocal={(v) => patchRow(r.id, { audienceBands: v ? [v] : [] })}
          toPatchValue={(v) => (v ? [v] : [])}
        />
      ),
    },
    {
      key: 'searchAliases',
      label: 'Search aliases',
      render: (r) => (
        <TextFieldPanelCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'searchAliases', fieldLabel: 'Search aliases', loadedUpdatedAt: r.updatedAt }}
          value={r.searchAliases.length ? r.searchAliases.join(', ') : null}
          setLocal={(v) => patchRow(r.id, { searchAliases: v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [] })}
          toPatchValue={(v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])}
          hint="Comma-separated alternate names/spellings a search should also match, e.g. &quot;Ayers Rock, Uluru-Kata Tjuta&quot;."
        />
      ),
    },
    {
      key: 'specialSeasons',
      label: 'Special seasons',
      render: (r) => (
        <JsonPanelCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'specialSeasons', fieldLabel: 'Special seasons', loadedUpdatedAt: r.updatedAt }}
          value={r.specialSeasons}
          setLocal={(v) => patchRow(r.id, { specialSeasons: v })}
          emptyValue={[]}
          summarize={(v) => (v.length ? `${v.length} season${v.length === 1 ? '' : 's'}` : '')}
          hint={'Array of { months: number[], text: string } — the "why now" callout shown under the year strip, e.g. [{"months": [12], "text": "Aurora season peaks"}].'}
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
      searchText={(r) => `${r.name} ${r.region} ${r.continent} ${r.id}`}
      searchPlaceholder="Search place, region, continent…"
      footerNote={`${initialRows.length} places · id/climate/severity/bands editable inline`}
    />
  );
}
