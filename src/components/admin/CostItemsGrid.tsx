'use client';

import { Fragment, useMemo, useState } from 'react';
import { useFieldEdit } from './useFieldEdit';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { CopyForSheetsButton } from './CopyForSheetsButton';
import { costItemIcon } from '@/lib/scoring/costIcons';
import { stampCostItems, type EditorKind } from '@/lib/admin/cost-item-stamp';

export interface CostItem {
  label: string;
  price: number;
  unit: string;
  emoji: string | null;
  // Edit tracking (see cost-item-stamp.ts). Null updatedBy = never edited since tracking began.
  id?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  editorKind?: EditorKind | null;
  lastChange?: string | null;
  category?: 'lodging' | 'food' | 'transport' | 'activity' | 'other' | null;
  priceMax?: number | null;
  season?: 'year' | 'peak' | 'offPeak' | null;
  currency?: string | null;
  sourceUrl?: string | null;
  checkedOn?: string | null;
}

const CATEGORY_OPTIONS = [['lodging', 'Lodging'], ['food', 'Food'], ['transport', 'Transport'], ['activity', 'Activity'], ['other', 'Other']] as const;
const SEASON_OPTIONS = [['year', 'All year'], ['peak', 'Peak season'], ['offPeak', 'Off season']] as const;
const todayISO = () => new Date().toISOString().slice(0, 10);

const YOU = { name: 'You', kind: 'human' as EditorKind };
const fmtWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const faint = { fontSize: 11.5, color: 'var(--text-faint)' } as const;

export interface CostDestination {
  id: string;
  name: string;
  emoji: string;
  region: string;
  continent: string;
  items: CostItem[];
  updatedAt: string;
}

function toTsv(destinations: CostDestination[]): string {
  const header = ['Destination ID', 'Destination Name', 'Region', 'Icon', 'Item', 'Price (USD)', 'Unit / Note', 'Category', 'Top of range', 'Season', 'Currency', 'Source link', 'Verified on'].join('\t');
  const lines = destinations.flatMap((d) =>
    d.items.map((item) =>
      [d.id, d.name, d.region, item.emoji ?? costItemIcon(item.label), item.label, item.price, item.unit, item.category ?? '', item.priceMax ?? '', item.season ?? '', item.currency ?? '', item.sourceUrl ?? '', item.checkedOn ?? ''].join('\t'),
    ),
  );
  return [header, ...lines].join('\n');
}

export function CostItemsGrid({ initialDestinations }: { initialDestinations: CostDestination[] }) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [query, setQuery] = useState('');
  const [onlyNotHuman, setOnlyNotHuman] = useState(false);
  const [continentDir, setContinentDir] = useState<1 | -1>(1);
  const commit = useFieldEdit();

  useUpdatedAtSync('destination', (entityId, updatedAt) => {
    setDestinations((ds) => ds.map((d) => (d.id === entityId ? { ...d, updatedAt } : d)));
  });

  function setItems(destId: string, items: CostItem[]) {
    setDestinations((ds) => ds.map((d) => (d.id === destId ? { ...d, items } : d)));
  }

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = onlyNotHuman ? destinations.filter((d) => d.items.some((i) => i.editorKind !== 'human')) : destinations;
    if (!q) return base;
    return base.filter(
      (d) => d.name.toLowerCase().includes(q) || d.continent.toLowerCase().includes(q) || d.items.some((i) => i.label.toLowerCase().includes(q)),
    );
  }, [destinations, q, onlyNotHuman]);

  const tsv = useMemo(() => toTsv(filtered), [filtered]);
  const tsvRowCount = useMemo(() => filtered.reduce((n, d) => n + d.items.length, 0), [filtered]);

  const continentGroups = useMemo(() => {
    const groups = new Map<string, CostDestination[]>();
    for (const d of filtered) {
      const list = groups.get(d.continent) ?? [];
      list.push(d);
      groups.set(d.continent, list);
    }
    const continents = [...groups.keys()].sort((a, b) => a.localeCompare(b) * continentDir);
    for (const c of continents) {
      groups.get(c)!.sort((a, b) => a.name.localeCompare(b.name));
    }
    return continents.map((c) => ({ continent: c, destinations: groups.get(c)! }));
  }, [filtered, continentDir]);

  function editItemField(dest: CostDestination, idx: number, field: keyof CostItem, rawValue: string) {
    const item = dest.items[idx];
    let newValue: string | number | null = rawValue;
    if (field === 'price') {
      const n = Number(rawValue);
      if (isNaN(n) || n < 0) return;
      newValue = n;
    }
    if (field === 'priceMax') {
      if (rawValue.trim() === '') newValue = null;
      else {
        const n = Number(rawValue);
        if (isNaN(n) || n < 0) return;
        newValue = n;
      }
    }
    if (field === 'category' || field === 'season' || field === 'sourceUrl' || field === 'checkedOn' || field === 'currency') newValue = rawValue.trim() === '' ? null : rawValue.trim();
    if (field === 'currency' && newValue && !/^[A-Za-z]{3}$/.test(String(newValue))) return;
    if (field === 'currency' && newValue) newValue = String(newValue).toUpperCase();
    if (field === 'emoji' && !rawValue.trim()) return; // icon can't be blanked out entirely
    const oldValue = item[field];
    if (String(oldValue ?? '') === String(newValue ?? '')) return;

    const before = dest.items;
    const after = stampCostItems(before, before.map((it, i) => (i === idx ? { ...it, [field]: newValue } : it)), YOU, new Date());
    commit({
      entityType: 'destination',
      entityId: dest.id,
      entityLabel: dest.name,
      field: 'costItems',
      fieldLabel: `${item.label || '(untitled item)'} — ${field === 'emoji' ? 'icon' : field === 'priceMax' ? 'top of range' : field === 'sourceUrl' ? 'source link' : field === 'checkedOn' ? 'verified on' : field}`,
      loadedUpdatedAt: dest.updatedAt,
      oldValue: oldValue ?? null,
      newValue,
      toPatchValue: () => after,
      setLocal: (val) => setItems(dest.id, val === newValue ? after : before),
    });
  }

  function addItem(dest: CostDestination) {
    const before = dest.items;
    const newItem: CostItem = { label: '', price: 0, unit: '', emoji: '🎫' };
    const after = stampCostItems(before, [...before, newItem], YOU, new Date());
    commit({
      entityType: 'destination',
      entityId: dest.id,
      entityLabel: dest.name,
      field: 'costItems',
      fieldLabel: 'Added new cost item',
      loadedUpdatedAt: dest.updatedAt,
      oldValue: '—',
      newValue: '(untitled, $0)',
      toPatchValue: () => after,
      setLocal: (val) => setItems(dest.id, val === '(untitled, $0)' ? after : before),
    });
    setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-cost-label="${dest.id}:${before.length}"]`)?.focus();
    }, 0);
  }

  function deleteItem(dest: CostDestination, idx: number) {
    const item = dest.items[idx];
    if (!window.confirm(`Remove "${item.label || '(untitled item)'}" for ${dest.name}? This can still be undone from the Pending tray before saving.`)) return;
    const before = dest.items;
    const after = before.filter((_, i) => i !== idx);
    commit({
      entityType: 'destination',
      entityId: dest.id,
      entityLabel: dest.name,
      field: 'costItems',
      fieldLabel: `Removed "${item.label || '(untitled item)'}"`,
      loadedUpdatedAt: dest.updatedAt,
      oldValue: 'existed',
      newValue: 'removed',
      toPatchValue: () => after,
      setLocal: (val) => setItems(dest.id, val === 'removed' ? after : before),
    });
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
            placeholder="Search place or item…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyNotHuman} onChange={(e) => setOnlyNotHuman(e.target.checked)} />
          Never edited by a human
        </label>
        <CopyForSheetsButton tsv={tsv} rowCount={tsvRowCount} />
        <a
          className="filter-select"
          style={{ textDecoration: 'none', display: 'inline-block' }}
          href={`/admin/destinations/cost-items/export${onlyNotHuman ? '?onlyNotHuman=1' : ''}`}
        >
          ⬇ Export CSV{onlyNotHuman ? ' (needs review)' : ''}
        </a>
        <span>
          Grouped by continent, then by place · click ➕ next to a place to add its next cost item, sorted low → high automatically ·
          click Continent to reorder
        </span>
      </div>
      <div className="grid-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky-col no-sort" style={{ width: 44 }}>
                Icon
              </th>
              <th className="no-sort">Item</th>
              <th className="no-sort" style={{ textAlign: 'right' }}>
                Price (USD)
              </th>
              <th className="no-sort">Unit</th>
              <th className="no-sort">Category</th>
              <th className="no-sort" style={{ textAlign: 'right' }} title="Leave blank unless the price is a range">Top of range</th>
              <th className="no-sort">Season</th>
              <th className="no-sort" title="Three-letter code; blank means USD">Currency</th>
              <th className="no-sort">Source link</th>
              <th className="no-sort">Verified</th>
              <th className="no-sort">Last updated</th>
              <th className="no-sort">By</th>
              <th className="no-sort">What changed</th>
              <th onClick={() => setContinentDir((d) => (d === 1 ? -1 : 1))}>
                Continent <span className={`sort-arrow active`}>{continentDir === 1 ? '↑' : '↓'}</span>
              </th>
              <th className="no-sort" style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {continentGroups.map(({ continent, destinations: ds }) => (
              <Fragment key={continent}>
                <tr className="region-row">
                  <td colSpan={15} className="sticky-col">
                    {continent}
                  </td>
                </tr>
                {ds.map((dest) => (
                  <Fragment key={dest.id}>
                    <tr className="dest-subheader-row">
                      <td colSpan={14} className="sticky-col">
                        {dest.emoji} <b>{dest.name}</b>{' '}
                        <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
                          — {dest.items.length} item{dest.items.length === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td>
                        <button className="icon-btn" style={{ color: 'var(--accent)', fontSize: 15, border: 'none', background: 'none', cursor: 'pointer' }} title={`Add a cost item for ${dest.name}`} onClick={() => addItem(dest)}>
                          ➕
                        </button>
                      </td>
                    </tr>
                    {[...dest.items]
                      .map((item, idx) => ({ item, idx }))
                      .sort((a, b) => {
                        // A just-added, still-unlabeled item always starts at
                        // $0, which would otherwise sort it to the top and
                        // shift every real item down a row right as the user
                        // goes to click something else — pin drafts to a
                        // fixed spot instead, so adding one never moves any
                        // already-sorted item's position underneath a click.
                        const aDraft = !a.item.label.trim();
                        const bDraft = !b.item.label.trim();
                        if (aDraft !== bDraft) return aDraft ? -1 : 1;
                        if (aDraft && bDraft) return a.idx - b.idx;
                        return a.item.price - b.item.price;
                      })
                      .filter(({ item }) => !onlyNotHuman || item.editorKind !== 'human')
                      .map(({ item, idx }) => (
                        // Inputs are uncontrolled (defaultValue), so a row keyed only by
                        // index keeps its old text after a delete shifts everything up —
                        // the screen would show the deleted row and hide the wrong one.
                        // Including the count remounts the rows whenever one is added or removed.
                        <tr key={`${dest.id}-${dest.items.length}-${idx}`}>
                          <td className="sticky-col">
                            <div className="cell-inner">
                              <input
                                className="cost-input"
                                style={{ textAlign: 'center', fontSize: 15, width: 40 }}
                                maxLength={6}
                                defaultValue={item.emoji ?? costItemIcon(item.label)}
                                onBlur={(e) => editItemField(dest, idx, 'emoji', e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner">
                              <input
                                className={`cost-input${item.label.trim() ? '' : ' invalid'}`}
                                placeholder="Item name — required before this can be saved"
                                data-cost-label={`${dest.id}:${idx}`}
                                defaultValue={item.label}
                                onBlur={(e) => editItemField(dest, idx, 'label', e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                className="cost-input num"
                                defaultValue={item.price}
                                onBlur={(e) => editItemField(dest, idx, 'price', e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner">
                              <input
                                className="cost-input"
                                placeholder="blank if it's a one-off, not per-something"
                                defaultValue={item.unit}
                                onBlur={(e) => editItemField(dest, idx, 'unit', e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner">
                              <select className="cell-select" value={item.category ?? ''} onChange={(e) => editItemField(dest, idx, 'category', e.target.value)}>
                                <option value="">—</option>
                                {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner">
                              <input type="number" min={0} step={1} className="cost-input num" placeholder="—" defaultValue={item.priceMax ?? ''} onBlur={(e) => editItemField(dest, idx, 'priceMax', e.target.value)} />
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner">
                              <select className="cell-select" value={item.season ?? ''} onChange={(e) => editItemField(dest, idx, 'season', e.target.value)}>
                                <option value="">—</option>
                                {SEASON_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner">
                              <input className="cost-input" maxLength={3} placeholder="USD" style={{ width: 52, textTransform: 'uppercase' }} defaultValue={item.currency ?? ''} onBlur={(e) => editItemField(dest, idx, 'currency', e.target.value)} />
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner">
                              <input className="cost-input" placeholder="https://…" defaultValue={item.sourceUrl ?? ''} onBlur={(e) => editItemField(dest, idx, 'sourceUrl', e.target.value)} />
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner" style={{ gap: 6, whiteSpace: 'nowrap' }}>
                              {item.checkedOn ? <span style={{ fontSize: 11.5, color: 'var(--good)' }}>✓ {item.checkedOn}</span> : <span style={faint}>Not verified</span>}
                              <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: 11 }} title="Records today's date as the day you checked this price" onClick={() => editItemField(dest, idx, 'checkedOn', todayISO())}>
                                {item.checkedOn ? 'Re-verify' : 'Mark verified'}
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner" style={{ ...faint, whiteSpace: 'nowrap' }}>{item.updatedAt ? fmtWhen(item.updatedAt) : '—'}</div>
                          </td>
                          <td>
                            <div className="cell-inner" style={item.updatedBy ? { fontSize: 11.5, whiteSpace: 'nowrap' } : { ...faint, fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                              {item.updatedBy ? `${item.editorKind === 'agent' ? '🤖 ' : ''}${item.updatedBy}` : 'Never edited'}
                            </div>
                          </td>
                          <td>
                            <div className="cell-inner" style={faint}>{item.lastChange ?? ''}</div>
                          </td>
                          <td>
                            <div className="cell-inner" />
                          </td>
                          <td>
                            <div className="cell-inner">
                              <button className="icon-btn" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-faint)' }} title="Remove this item" onClick={() => deleteItem(dest, idx)}>
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--text-faint)' }}>
        {destinations.reduce((n, d) => n + d.items.length, 0)} cost items across {destinations.length} places
      </div>
    </div>
  );
}
