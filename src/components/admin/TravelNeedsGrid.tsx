'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import './interest-page/interest-page.css';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { FactCell, factToText } from './interest-page/FactCell';
import { FACT_GROUP_LABELS, type FactGroup } from '@/lib/admin/interest-pages/config';
import { TRAVEL_FACTS, TRAVEL_KEY } from '@/lib/admin/travel-needs/config';
import { SETTING_TAGS } from '@/lib/places/setting-tags';
import type { InterestFactValue } from '@/lib/db/schema';
import type { TravelNeedsRow } from '@/lib/db/queries/travel-needs';

const HEAD_CLASS = { app: 'ip-data-head', info: 'ip-info-head', draw: 'ip-draw-head', new: 'ip-new-head' } as const;
const SCORED = TRAVEL_FACTS.filter((d) => !d.optional);
const tagLabel = (slug: string) => { const t = SETTING_TAGS.find((x) => x.slug === slug); return t ? `${t.emoji} ${t.label}` : slug; };

/**
 * Traveler needs (10 Nov 2026): one row per place, one column per thing onboarding asks a traveler about (kids by age, how you travel, language, dietary needs, mobility).
 * Edits save through the same fact editor as the interest pages, under the pseudo-interest key "_travel".
 */
export function TravelNeedsGrid({ initialRows }: { initialRows: TravelNeedsRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [group, setGroup] = useState<'' | FactGroup>('');
  const [setting, setSetting] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const groups = useMemo(() => [...new Set(TRAVEL_FACTS.filter((d) => d.group !== 'practical').map((d) => d.group))], []);

  function onSaved(placeId: string, key: string, v: InterestFactValue) {
    setRows((rs) => rs.map((r) => (r.id === placeId ? { ...r, facts: { ...r.facts, [key]: v } } : r)));
  }
  const filled = (r: TravelNeedsRow) => SCORED.filter((d) => r.facts[d.key] !== undefined && r.facts[d.key] !== null && r.facts[d.key] !== '').length;

  const defs = TRAVEL_FACTS.filter((d) => !group || d.group === group || d.key === 'evidence');
  const shown = rows.filter((r) => (!setting || r.settingTags.includes(setting)) && (!onlyGaps || filled(r) < SCORED.length));

  const columns: GridColumn<TravelNeedsRow>[] = [
    { key: 'name', label: 'Place', sortable: true, sortValue: (p) => p.name, render: (p) => <div className="cell-inner" style={{ fontWeight: 600 }}><Link href={`/admin/destinations/${p.id}/profile`} title="Open this place">{p.name}</Link></div> },
    { key: 'type', label: 'Setting', sortable: true, sortValue: (p) => p.settingTags[0] ?? '', render: (p) => <div className="cell-inner ip-muted" title={p.settingTags.map(tagLabel).join(', ')}>{p.settingTags.length ? p.settingTags.map((t, i) => (i === 0 ? <b key={t}>{tagLabel(t)}</b> : <span key={t}>, {tagLabel(t)}</span>)) : '—'}</div> },
    { key: 'filled', label: 'Filled', sortable: true, align: 'right', sortValue: (p) => filled(p), render: (p) => <div className="cell-inner ip-mono" style={{ justifyContent: 'flex-end' }}>{filled(p)}/{SCORED.length}</div> },
    ...defs.map((def): GridColumn<TravelNeedsRow> => ({
      key: def.key,
      label: def.label,
      sortable: def.type === 'rating',
      sortValue: (p) => (typeof p.facts[def.key] === 'number' ? (p.facts[def.key] as number) : -1),
      headClass: HEAD_CLASS[FACT_GROUP_LABELS[def.group].tone],
      render: (p) => <FactCell key={`${p.id}:${def.key}:${factToText(def, p.facts[def.key])}`} interestKey={TRAVEL_KEY} placeId={p.id} def={def} value={p.facts[def.key]} onSaved={onSaved} />,
    })),
  ];

  const total = rows.length * SCORED.length;
  const done = rows.reduce((n, r) => n + filled(r), 0);

  return (
    <div className="ip-section">
      <div className="ip-note">
        Traveler needs: the things the onboarding asks a traveler about (traveling with kids and their ages, how they like to travel, language, dietary needs and mobility), rated for every place on the same 0 to 10 scale as the interest columns. These are about the place as a whole, not one interest. {done} of {total} cells filled. Hover a column heading for what the numbers mean.
      </div>
      <div className="ip-card ip-gridcard" style={{ padding: 0 }}>
        <AdminDataGrid
          rows={shown}
          columns={columns}
          rowId={(p) => p.id}
          searchText={(p) => `${p.name} ${p.region} ${p.settingTags.map(tagLabel).join(' ')}`.toLowerCase()}
          searchPlaceholder="Search place or region…"
          defaultSort={{ col: 'name', dir: 1 }}
          footerNote={`${shown.length} of ${rows.length} places`}
          toolbarExtra={
            <>
              <span className="filter-label">Show</span>
              <select className="filter-select" value={group} onChange={(e) => setGroup(e.target.value as '' | FactGroup)}>
                <option value="">All columns</option>
                {groups.map((g) => <option key={g} value={g}>{FACT_GROUP_LABELS[g].label}</option>)}
              </select>
              <span className="filter-label">Setting</span>
              <select className="filter-select" value={setting} onChange={(e) => setSetting(e.target.value)}>
                <option value="">All settings</option>
                {SETTING_TAGS.map((t) => <option key={t.slug} value={t.slug}>{t.emoji} {t.label}</option>)}
              </select>
              <label className="filter-label" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} />Places with gaps only</label>
            </>
          }
        />
      </div>
    </div>
  );
}
