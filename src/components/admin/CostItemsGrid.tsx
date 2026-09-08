'use client';

import { Fragment, useMemo, useState } from 'react';
import { useFieldEdit } from './useFieldEdit';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { CopyForSheetsButton } from './CopyForSheetsButton';
import { costItemIcon } from '@/lib/scoring/costIcons';

export interface CostItem {
  label: string;
  price: number;
  unit: string;
  emoji: string | null;
}

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
  const header = ['Destination ID', 'Destination Name', 'Region', 'Icon', 'Item', 'Price (USD)', 'Unit / Note'].join('\t');
  const lines = destinations.flatMap((d) =>
    d.items.map((item) =>
      [d.id, d.name, d.region, item.emoji ?? costItemIcon(item.label), item.label, item.price, item.unit].join('\t'),
    ),
  );
  return [header, ...lines].join('\n');
}

export function CostItemsGrid({ initialDestinations }: { initialDestinations: CostDestination[] }) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [query, setQuery] = useState('');
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
    if (!q) return destinations;
    return destinations.filter(
      (d) => d.name.toLowerCase().includes(q) || d.continent.toLowerCase().includes(q) || d.items.some((i) => i.label.toLowerCase().includes(q)),
    );
  }, [destinations, q]);

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
      groups.get(c)!.sort((a, b) => {
        const aMin = a.items.length ? Math.min(...a.items.map((i) => i.price)) : Infinity;
        const bMin = b.items.length ? Math.min(...b.items.map((i) => i.price)) : Infinity;
        return aMin - bMin || a.name.localeCompare(b.name);
      });
    }
    return continents.map((c) => ({ continent: c, destinations: groups.get(c)! }));
  }, [filtered, continentDir]);

  function editItemField(dest: CostDestination, idx: number, field: keyof CostItem, rawValue: string) {
    const item = dest.items[idx];
    let newValue: string | number = rawValue;
    if (field === 'price') {
      const n = Number(rawValue);
      if (isNaN(n) || n < 0) return;
      newValue = n;
    }
    if (field === 'emoji' && !rawValue.trim()) return; // icon can't be blanked out entirely
    const oldValue = item[field];
    if (String(oldValue ?? '') === String(newValue)) return;

    const before = dest.items;
    const after = before.map((it, i) => (i === idx ? { ...it, [field]: newValue } : it));
    commit({
      entityType: 'destination',
      entityId: dest.id,
      entityLabel: dest.name,
      field: 'costItems',
      fieldLabel: `${item.label || '(untitled item)'} — ${field === 'emoji' ? 'icon' : field}`,
      loadedUpdatedAt: dest.updatedAt,
      oldValue,
      newValue,
      toPatchValue: () => after,
      setLocal: (val) => setItems(dest.id, val === newValue ? after : before),
    });
  }

  function addItem(dest: CostDestination) {
    const before = dest.items;
    const newItem: CostItem = { label: '', price: 0, unit: '', emoji: '🎫' };
    const after = [...before, newItem];
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
        <CopyForSheetsButton tsv={tsv} rowCount={tsvRowCount} />
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
                  <td colSpan={6} className="sticky-col">
                    {continent}
                  </td>
                </tr>
                {ds.map((dest) => (
                  <Fragment key={dest.id}>
                    <tr className="dest-subheader-row">
                      <td colSpan={5} className="sticky-col">
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
                      .map(({ item, idx }) => (
                        <tr key={`${dest.id}-${idx}`}>
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
