'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { InlineTextCell, InlineOptionalTextCell, InlineNumberCell, LabeledSelectCell, CheckboxCell, InlineSelectCell, SeverityCell, BandCell, SettingTagsCell, TextFieldPanelCell, MonthlyWeatherCell, JsonPanelCell, type BandOption } from './cells';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { BAND_DIMENSIONS, SLIDERS } from '@/lib/scoring/constants';
import { GATE_MIN_WEIGHT } from '@/lib/scoring/gating';

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
  priceSwing: string | null;
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
  settingTags: string[];
  audienceBands: string[];
  gated: boolean;
  gatedInterests: string[];
  isPrimaryDestination: boolean;
  isPublished: boolean;
  parentPlaceId: string | null;
  summary: string | null;
  countryCode: string | null;
  continentSaved: string | null;
  regionLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  stampDesign: Record<string, unknown> | null;
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

// The interests a specialist place can be gated for: every interest a traveller can see and weight.
const GATE_INTEREST_OPTIONS: BandOption[] = SLIDERS.filter((s) => !s.hidden).map((s) => ({ key: s.key, label: `${s.icon} ${s.label}`, short: s.label }));

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

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];

export function PlacesGrid({ initialRows, showRetired }: { initialRows: PlaceRow[]; showRetired: boolean }) {
  const [rows, setRows] = useState(initialRows);

  useUpdatedAtSync('destination', (entityId, updatedAt) => {
    setRows((rs) => rs.map((r) => (r.id === entityId ? { ...r, updatedAt } : r)));
  });

  function patchRow(id: string, patch: Partial<PlaceRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const parentOptions = [...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ value: r.id, label: r.name }));

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
          {!r.isPrimaryDestination && <span className="badge badge-moderate" title="Taken out of the rankings. Turn Primary back on to restore it.">Retired</span>}
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
      key: 'nameEdit',
      label: 'Name (edit)',
      render: (r) => (
        <InlineTextCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'name', fieldLabel: 'Place name', loadedUpdatedAt: r.updatedAt }}
          value={r.name}
          setLocal={(v) => patchRow(r.id, { name: v })}
          width={190}
          maxLength={120}
        />
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
      key: 'settingTags',
      label: 'Place type',
      sortable: true,
      sortValue: (r) => r.settingTags[0] ?? '',
      render: (r) => (
        <SettingTagsCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'settingTags', fieldLabel: 'Place type', loadedUpdatedAt: r.updatedAt }}
          value={r.settingTags}
          setLocal={(v) => patchRow(r.id, { settingTags: v })}
        />
      ),
    },
    {
      key: 'placeType',
      label: 'Hierarchy type',
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
      label: 'Peak crowd intensity',
      sortable: true,
      sortValue: (r) => r.peakIntensity ?? '',
      render: (r) => (
        <InlineSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'peakIntensity', fieldLabel: 'Peak crowd intensity', loadedUpdatedAt: r.updatedAt }}
          value={r.peakIntensity}
          options={['mild', 'moderate', 'extreme']}
          setLocal={(v) => patchRow(r.id, { peakIntensity: v })}
        />
      ),
    },
    {
      key: 'priceSwing',
      label: 'Seasonal price swing',
      sortable: true,
      sortValue: (r) => r.priceSwing ?? '',
      render: (r) => (
        <InlineSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'priceSwing', fieldLabel: 'Seasonal price swing', loadedUpdatedAt: r.updatedAt }}
          value={r.priceSwing}
          options={['mild', 'moderate', 'extreme']}
          setLocal={(v) => patchRow(r.id, { priceSwing: v })}
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
      key: 'gated',
      label: 'Gated',
      sortable: true,
      sortValue: (r) => (r.gated ? 'Y' : ''),
      render: (r) => (
        <InlineSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'gated', fieldLabel: 'Gated', loadedUpdatedAt: r.updatedAt }}
          value={r.gated ? 'Y' : null}
          options={['Y']}
          setLocal={(v) => patchRow(r.id, { gated: v === 'Y' })}
          toPatchValue={(v) => v === 'Y'}
        />
      ),
    },
    {
      key: 'gatedInterests',
      label: 'Gated for',
      sortable: true,
      sortValue: (r) => r.gatedInterests.join(','),
      render: (r) => (
        <BandCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'gatedInterests', fieldLabel: `Gated for (shows once a traveller weights one of these ${GATE_MIN_WEIGHT}+)`, loadedUpdatedAt: r.updatedAt }}
          value={r.gatedInterests}
          options={GATE_INTEREST_OPTIONS}
          tall
          setLocal={(v) => patchRow(r.id, { gatedInterests: v })}
        />
      ),
    },
    {
      key: 'isPrimaryDestination',
      label: 'Primary (ranked)',
      sortable: true,
      sortValue: (r) => (r.isPrimaryDestination ? 'Y' : ''),
      render: (r) => (
        <CheckboxCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'isPrimaryDestination', fieldLabel: 'Primary destination (ranked, shown in the admin grids)', loadedUpdatedAt: r.updatedAt }}
          value={r.isPrimaryDestination}
          setLocal={(v) => patchRow(r.id, { isPrimaryDestination: v })}
        />
      ),
    },
    {
      key: 'isPublished',
      label: 'Published',
      sortable: true,
      sortValue: (r) => (r.isPublished ? 'Y' : ''),
      render: (r) => (
        <CheckboxCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'isPublished', fieldLabel: 'Published (shown to travellers)', loadedUpdatedAt: r.updatedAt }}
          value={r.isPublished}
          setLocal={(v) => patchRow(r.id, { isPublished: v })}
        />
      ),
    },
    {
      key: 'parentPlaceId',
      label: 'Parent place',
      render: (r) => (
        <LabeledSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'parentPlaceId', fieldLabel: 'Parent place', loadedUpdatedAt: r.updatedAt }}
          value={r.parentPlaceId}
          options={parentOptions.filter((o) => o.value !== r.id)}
          setLocal={(v) => patchRow(r.id, { parentPlaceId: v })}
          width={150}
        />
      ),
    },
    {
      key: 'summary',
      label: 'Summary line',
      render: (r) => (
        <TextFieldPanelCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'summary', fieldLabel: 'Summary line', loadedUpdatedAt: r.updatedAt }}
          value={r.summary}
          setLocal={(v) => patchRow(r.id, { summary: v })}
          hint="One or two sentences that sum the place up (up to 600 characters). Blank clears it."
        />
      ),
    },
    {
      key: 'countryCode',
      label: 'Country code',
      render: (r) => (
        <InlineOptionalTextCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'countryCode', fieldLabel: 'Country code', loadedUpdatedAt: r.updatedAt }}
          value={r.countryCode}
          setLocal={(v) => patchRow(r.id, { countryCode: v })}
          width={70}
          maxLength={3}
          placeholder="FRA"
        />
      ),
    },
    {
      key: 'continentSaved',
      label: 'Continent (edit)',
      render: (r) => (
        <LabeledSelectCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'continent', fieldLabel: 'Continent', loadedUpdatedAt: r.updatedAt }}
          value={r.continentSaved}
          options={CONTINENTS.map((c) => ({ value: c, label: c }))}
          setLocal={(v) => patchRow(r.id, { continentSaved: v, continent: v ?? r.continent })}
          width={130}
        />
      ),
    },
    {
      key: 'regionLabel',
      label: 'Region label',
      render: (r) => (
        <InlineOptionalTextCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'regionLabel', fieldLabel: 'Region label', loadedUpdatedAt: r.updatedAt }}
          value={r.regionLabel}
          setLocal={(v) => patchRow(r.id, { regionLabel: v })}
          width={150}
          maxLength={120}
        />
      ),
    },
    {
      key: 'latitude',
      label: 'Latitude',
      render: (r) => (
        <InlineNumberCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'latitude', fieldLabel: 'Latitude', loadedUpdatedAt: r.updatedAt }}
          value={r.latitude}
          setLocal={(v) => patchRow(r.id, { latitude: v })}
          min={-90}
          max={90}
          step={0.0001}
          placeholder="-90 to 90"
        />
      ),
    },
    {
      key: 'longitude',
      label: 'Longitude',
      render: (r) => (
        <InlineNumberCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'longitude', fieldLabel: 'Longitude', loadedUpdatedAt: r.updatedAt }}
          value={r.longitude}
          setLocal={(v) => patchRow(r.id, { longitude: v })}
          min={-180}
          max={180}
          step={0.0001}
          placeholder="-180 to 180"
        />
      ),
    },
    {
      key: 'stampDesign',
      label: 'Stamp design',
      render: (r) => (
        <JsonPanelCell
          ctx={{ entityType: 'destination', entityId: r.id, entityLabel: r.name, field: 'stampDesign', fieldLabel: 'Stamp design', loadedUpdatedAt: r.updatedAt }}
          value={r.stampDesign}
          setLocal={(v) => patchRow(r.id, { stampDesign: v })}
          emptyValue={null}
          summarize={(v) => (v && Object.keys(v).length ? `${Object.keys(v).length} setting${Object.keys(v).length === 1 ? '' : 's'}` : '')}
          hint="The passport stamp's shape, color and style as a JSON object. Leave empty to use the automatic design."
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
      footerNote={`${initialRows.length} places${showRetired ? ' (including retired)' : ''} · almost every column is editable inline`}
      toolbarExtra={
        <span style={{ display: 'inline-flex', gap: 14, alignItems: 'center', fontSize: 12 }}>
          <Link href={showRetired ? '/admin/destinations' : '/admin/destinations?retired=1'}>{showRetired ? 'Hide retired places' : 'Show retired places'}</Link>
          <Link href="/admin/destinations/new">+ New place, retire or merge</Link>
        </span>
      }
    />
  );
}
