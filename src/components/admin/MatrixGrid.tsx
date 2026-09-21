'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminDataGrid, type GridColumn } from './AdminDataGrid';
import { JsonPanelCell, SourcesPanelCell, TextFieldPanelCell, SliderMonthlyWeatherCell, type SliderSource } from './cells';
import { useFieldEdit } from './useFieldEdit';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { VISIBLE_SLIDERS, SLIDER_GROUPS } from '@/lib/scoring/constants';
import type { SliderEvent } from '@/lib/scoring/types';
import { parseSliderCurve, rescaleCurve } from '@/lib/scoring/curve';

export interface MatrixRow {
  destId: string;
  destName: string;
  continent: string;
  sliderKey: string;
  sliderLabel: string;
  sliderIcon: string;
  group: string;
  base: number | null;
  min: number | null;
  max: number | null;
  tier: string | null;
  na: boolean;
  cap: number | null;
  events: SliderEvent[];
  styleTiers: Record<string, string>;
  sources: SliderSource[];
  overview: string;
  monthlyText: (string | null)[];
  updatedAt: string;
}

// Same palette as the approved mockup's DOMAIN_COLORS, for continuity.
const GROUP_COLORS: Record<string, string> = {
  'Nature & Wildlife': '#3a7d4f',
  'Sports & Recreation': '#3868a8',
  'Culture & Discovery': '#8a5a3a',
  'Relaxation & Leisure': '#a3548a',
  Value: '#5b6255',
};

const TIERS = ['none', 'casual', 'strong', 'signature'];

export function MatrixGrid({
  initialRows,
  initialBaseScoresByDest,
  initialSignatureTierByDest,
  initialNaSlidersByDest,
  initialSliderCapsByDest,
  initialSliderCurvesByDest,
  initialSliderEventsByDest,
  initialActivityStyleTiersByDest,
  initialSliderSourcesByDest,
  initialSliderOverviewByDest,
  initialSliderMonthlyWeatherByDest,
}: {
  initialRows: MatrixRow[];
  initialBaseScoresByDest: Record<string, Record<string, number>>;
  initialSignatureTierByDest: Record<string, Record<string, string>>;
  initialNaSlidersByDest: Record<string, string[]>;
  initialSliderCapsByDest: Record<string, Record<string, number>>;
  initialSliderCurvesByDest: Record<string, Record<string, unknown>>;
  initialSliderEventsByDest: Record<string, Record<string, SliderEvent[]>>;
  initialActivityStyleTiersByDest: Record<string, Record<string, Record<string, string>>>;
  initialSliderSourcesByDest: Record<string, Record<string, SliderSource[]>>;
  initialSliderOverviewByDest: Record<string, Record<string, string>>;
  initialSliderMonthlyWeatherByDest: Record<string, Record<string, (string | null)[]>>;
}) {
  const [rows, setRows] = useState(initialRows);

  useUpdatedAtSync('destination', (entityId, updatedAt) => {
    setRows((rs) => rs.map((r) => (r.destId === entityId ? { ...r, updatedAt } : r)));
  });
  const [baseScoresByDest, setBaseScoresByDest] = useState(initialBaseScoresByDest);
  const [signatureTierByDest, setSignatureTierByDest] = useState(initialSignatureTierByDest);
  const [naSlidersByDest, setNaSlidersByDest] = useState(initialNaSlidersByDest);
  const [sliderCapsByDest, setSliderCapsByDest] = useState(initialSliderCapsByDest);
  const [sliderCurvesByDest, setSliderCurvesByDest] = useState(initialSliderCurvesByDest);
  const [sliderEventsByDest, setSliderEventsByDest] = useState(initialSliderEventsByDest);
  const [activityStyleTiersByDest, setActivityStyleTiersByDest] = useState(initialActivityStyleTiersByDest);
  const [sliderSourcesByDest, setSliderSourcesByDest] = useState(initialSliderSourcesByDest);
  const [sliderOverviewByDest, setSliderOverviewByDest] = useState(initialSliderOverviewByDest);
  const [sliderMonthlyWeatherByDest, setSliderMonthlyWeatherByDest] = useState(initialSliderMonthlyWeatherByDest);
  const [selectedInterest, setSelectedInterest] = useState('all');
  const commit = useFieldEdit();

  function patchRow(destId: string, sliderKey: string, patch: Partial<MatrixRow>) {
    setRows((rs) => rs.map((r) => (r.destId === destId && r.sliderKey === sliderKey ? { ...r, ...patch } : r)));
  }

  const visibleRows = useMemo(
    () => (selectedInterest === 'all' ? rows : rows.filter((r) => r.sliderKey === selectedInterest)),
    [rows, selectedInterest],
  );

  /**
   * Min and Max are the curve's own extreme anchor values, so editing one
   * rescales every anchor and leaves the seasonal shape alone — lowering
   * Nova Scotia's wildlife ceiling from 10 to 7 keeps its Jul-Sep whale
   * season exactly where it is. See rescaleCurve in scoring/curve.ts.
   *
   * Read-only where there is no curve to reshape: an N/A slider, or one the
   * formula never produced a fit for. A flat curve is still editable — it
   * just moves as a block, since it has no shape to preserve.
   */
  /** Grayed "N/A" placeholder for a per-slider content cell (Events, Style
   * tiers, Sources, Overview, Monthly) on a row marked N/A — there's
   * nothing to author for an interest this destination doesn't have, so
   * these shouldn't invite a click with "Click to add…" the way an
   * unauthored-but-applicable cell does. */
  function naCell() {
    return <div className="cell-inner" style={{ color: 'var(--text-faint)' }}>N/A</div>;
  }

  function renderEnvelopeCell(r: MatrixRow, bound: 'min' | 'max') {
    const current = r[bound];
    const raw = sliderCurvesByDest[r.destId]?.[r.sliderKey];
    const dim = { justifyContent: 'flex-end', fontFamily: 'var(--font-plex-mono, monospace)', color: 'var(--text-dim)' } as const;
    if (r.na || current === null || raw === undefined) {
      return <div className="cell-inner" style={dim}>{r.na ? 'N/A' : current === null ? '—' : Math.round(current)}</div>;
    }
    return (
      <div className="cell-inner" style={{ justifyContent: 'flex-end' }}>
        <input
          type="number"
          min={0}
          max={10}
          step={0.5}
          className="cost-input num"
          style={{ width: 52, textAlign: 'right' }}
          defaultValue={Math.round(current)}
          key={`${r.destId}:${r.sliderKey}:${bound}:${current}`}
          onBlur={(e) => {
            const next = Math.max(0, Math.min(10, Number(e.target.value)));
            if (!Number.isFinite(next) || next === current) return;
            const lo = bound === 'min' ? next : r.min ?? 0;
            const hi = bound === 'max' ? next : r.max ?? 10;

            let rescaled;
            try {
              rescaled = rescaleCurve(parseSliderCurve(raw), lo, hi);
            } catch {
              // An unparseable stored curve should surface as a no-op here,
              // not as a thrown render — the audit scripts are where bad
              // curves get found and fixed.
              return;
            }

            const beforeCurves = sliderCurvesByDest[r.destId] ?? {};
            const afterCurves = { ...beforeCurves, [r.sliderKey]: rescaled };
            const values = rescaled.anchors.map((a) => a.value);
            const newMin = Math.min(...values);
            const newMax = Math.max(...values);

            commit({
              entityType: 'destination',
              entityId: r.destId,
              entityLabel: r.destName,
              field: 'sliderCurves',
              fieldLabel: `${r.sliderLabel} ${bound === 'min' ? 'floor' : 'peak'}`,
              loadedUpdatedAt: r.updatedAt,
              oldValue: current,
              newValue: next,
              toPatchValue: () => afterCurves,
              setLocal: (val) => {
                const applied = val === next;
                setSliderCurvesByDest((m) => ({ ...m, [r.destId]: applied ? afterCurves : beforeCurves }));
                patchRow(r.destId, r.sliderKey, applied ? { min: newMin, max: newMax } : { min: r.min, max: r.max });
              },
            });
          }}
        />
      </div>
    );
  }

  const columns: GridColumn<MatrixRow>[] = [
    {
      key: 'destName',
      label: 'Place',
      sortable: true,
      sortValue: (r) => r.destName,
      render: (r) => (
        <div className="cell-inner">
          <Link href={`/admin/destinations/${r.destId}/profile`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
            {r.destName}
          </Link>
        </div>
      ),
    },
    { key: 'continent', label: 'Continent', sortable: true, sortValue: (r) => r.continent, render: (r) => <div className="cell-inner">{r.continent}</div> },
    ...(selectedInterest === 'all'
      ? [
          {
            key: 'interest',
            label: 'Interest',
            sortable: true,
            sortValue: (r: MatrixRow) => r.sliderLabel,
            render: (r: MatrixRow) => (
              <div className="cell-inner interest-tag" style={{ fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: GROUP_COLORS[r.group] ?? 'var(--text-faint)', flexShrink: 0, display: 'inline-block' }} />
                {r.sliderIcon} {r.sliderLabel}
              </div>
            ),
          } as GridColumn<MatrixRow>,
        ]
      : []),
    {
      key: 'base',
      label: 'Base',
      align: 'right',
      sortable: true,
      sortValue: (r) => (r.na ? -1 : r.base ?? 0),
      render: (r) => {
        if (r.na) return <div className="cell-inner" style={{ justifyContent: 'flex-end', color: 'var(--text-faint)' }}>N/A</div>;
        return (
          <div className="cell-inner" style={{ justifyContent: 'flex-end' }}>
            <input
              type="number"
              min={0}
              max={10}
              className="cost-input num"
              style={{ width: 44, textAlign: 'right' }}
              defaultValue={r.base ?? 0}
              key={`${r.destId}:${r.sliderKey}:${r.base}`}
              onBlur={(e) => {
                const v = Math.max(0, Math.min(10, Math.round(Number(e.target.value))));
                const oldBase = r.base ?? 0;
                if (v === oldBase) return;
                const before = baseScoresByDest[r.destId] ?? {};
                const after = { ...before, [r.sliderKey]: v };
                commit({
                  entityType: 'destination',
                  entityId: r.destId,
                  entityLabel: r.destName,
                  field: 'baseScores',
                  fieldLabel: `${r.sliderLabel} base score`,
                  loadedUpdatedAt: r.updatedAt,
                  oldValue: oldBase,
                  newValue: v,
                  toPatchValue: () => after,
                  setLocal: (val) => {
                    setBaseScoresByDest((m) => ({ ...m, [r.destId]: val === v ? after : before }));
                    patchRow(r.destId, r.sliderKey, { base: val === v ? v : oldBase });
                  },
                });
              }}
            />
          </div>
        );
      },
    },
    { key: 'min', label: 'Min (year)', align: 'right', sortable: true, sortValue: (r) => r.min ?? -1, render: (r) => renderEnvelopeCell(r, 'min') },
    { key: 'max', label: 'Max (year)', align: 'right', sortable: true, sortValue: (r) => r.max ?? -1, render: (r) => renderEnvelopeCell(r, 'max') },
    {
      key: 'swing',
      label: 'Swing',
      align: 'right',
      sortable: true,
      sortValue: (r) => (r.min === null || r.max === null ? -1 : r.max - r.min),
      render: (r) => (
        <div className="cell-inner" style={{ justifyContent: 'flex-end', fontFamily: 'var(--font-plex-mono, monospace)', color: 'var(--text-dim)' }}>
          {r.min === null || r.max === null ? '—' : Math.round(r.max) - Math.round(r.min)}
        </div>
      ),
    },
    {
      key: 'tier',
      label: 'Tier',
      render: (r) => (
        <div className="cell-inner">
          <select
            className="cell-select"
            value={r.tier ?? 'none'}
            onChange={(e) => {
              const newTier = e.target.value;
              const oldTier = r.tier ?? 'none';
              if (newTier === oldTier) return;
              const before = signatureTierByDest[r.destId] ?? {};
              const after = { ...before, [r.sliderKey]: newTier };
              commit({
                entityType: 'destination',
                entityId: r.destId,
                entityLabel: r.destName,
                field: 'signatureTier',
                fieldLabel: `${r.sliderLabel} identity tier`,
                loadedUpdatedAt: r.updatedAt,
                oldValue: oldTier,
                newValue: newTier,
                toPatchValue: () => after,
                setLocal: (val) => {
                  setSignatureTierByDest((m) => ({ ...m, [r.destId]: val === newTier ? after : before }));
                  patchRow(r.destId, r.sliderKey, { tier: val === newTier ? newTier : oldTier });
                },
              });
            }}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: 'na',
      label: 'N/A',
      render: (r) => (
        <div className="cell-inner">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--text-faint)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={r.na}
              onChange={(e) => {
                const newNa = e.target.checked;
                const before = naSlidersByDest[r.destId] ?? [];
                const after = newNa ? [...before.filter((k) => k !== r.sliderKey), r.sliderKey] : before.filter((k) => k !== r.sliderKey);
                commit({
                  entityType: 'destination',
                  entityId: r.destId,
                  entityLabel: r.destName,
                  field: 'naSliders',
                  fieldLabel: `${r.sliderLabel} — marked N/A`,
                  loadedUpdatedAt: r.updatedAt,
                  oldValue: r.na,
                  newValue: newNa,
                  toLabel: (v) => (v ? 'N/A' : 'scored'),
                  toPatchValue: () => after,
                  setLocal: (val) => {
                    setNaSlidersByDest((m) => ({ ...m, [r.destId]: val === newNa ? after : before }));
                    patchRow(r.destId, r.sliderKey, { na: val === newNa ? newNa : r.na });
                  },
                });
              }}
            />
            N/A
          </label>
        </div>
      ),
    },
    {
      key: 'cap',
      label: 'Cap',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.cap ?? -1,
      render: (r) => (
        <div className="cell-inner" style={{ justifyContent: 'flex-end' }}>
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            placeholder="—"
            className="cost-input num"
            style={{ width: 44, textAlign: 'right' }}
            defaultValue={r.cap ?? ''}
            key={`${r.destId}:${r.sliderKey}:${r.cap}`}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const v = raw === '' ? null : Math.max(0, Math.min(10, Number(raw)));
              const oldCap = r.cap;
              if (v === oldCap) return;
              const before = sliderCapsByDest[r.destId] ?? {};
              const after = { ...before };
              if (v === null) delete after[r.sliderKey];
              else after[r.sliderKey] = v;
              commit({
                entityType: 'destination',
                entityId: r.destId,
                entityLabel: r.destName,
                field: 'sliderCaps',
                fieldLabel: `${r.sliderLabel} cap`,
                loadedUpdatedAt: r.updatedAt,
                oldValue: oldCap,
                newValue: v,
                toLabel: (val) => (val === null ? 'no cap' : String(val)),
                toPatchValue: () => after,
                setLocal: (val) => {
                  setSliderCapsByDest((m) => ({ ...m, [r.destId]: val === v ? after : before }));
                  patchRow(r.destId, r.sliderKey, { cap: val === v ? v : oldCap });
                },
              });
            }}
          />
        </div>
      ),
    },
    {
      key: 'events',
      label: 'Events',
      render: (r) => {
        if (r.na) return naCell();
        const mergedAfter = (v: SliderEvent[]) => {
          const before = sliderEventsByDest[r.destId] ?? {};
          const after = { ...before };
          if (v.length === 0) delete after[r.sliderKey];
          else after[r.sliderKey] = v;
          return after;
        };
        return (
          <JsonPanelCell
            ctx={{ entityType: 'destination', entityId: r.destId, entityLabel: r.destName, field: 'sliderEvents', fieldLabel: `${r.sliderLabel} events`, loadedUpdatedAt: r.updatedAt }}
            value={r.events}
            setLocal={(v) => {
              setSliderEventsByDest((m) => ({ ...m, [r.destId]: mergedAfter(v) }));
              patchRow(r.destId, r.sliderKey, { events: v });
            }}
            emptyValue={[]}
            summarize={(v) => (v.length ? `${v.length} event${v.length === 1 ? '' : 's'}` : '')}
            hint={'Array of { label, weight, months: {"6": 1} } — a rule-based seasonal bonus, on top of the base score. See docs/content/adding-destinations.md Part 3.'}
            toPatchValue={mergedAfter}
          />
        );
      },
    },
    {
      key: 'styleTiers',
      label: 'Style tiers',
      render: (r) => {
        if (r.na) return naCell();
        const mergedAfter = (v: Record<string, string>) => {
          const before = activityStyleTiersByDest[r.destId] ?? {};
          const after = { ...before };
          if (Object.keys(v).length === 0) delete after[r.sliderKey];
          else after[r.sliderKey] = v;
          return after;
        };
        return (
          <JsonPanelCell
            ctx={{ entityType: 'destination', entityId: r.destId, entityLabel: r.destName, field: 'activityStyleTiers', fieldLabel: `${r.sliderLabel} style tiers`, loadedUpdatedAt: r.updatedAt }}
            value={r.styleTiers}
            setLocal={(v) => {
              setActivityStyleTiersByDest((m) => ({ ...m, [r.destId]: mergedAfter(v) }));
              patchRow(r.destId, r.sliderKey, { styleTiers: v });
            }}
            emptyValue={{}}
            summarize={(v) => (Object.keys(v).length ? Object.keys(v).join(', ') : '')}
            hint={'Sparse sub-style quality within this slider, e.g. {"mountainBiking": "signature"} — tiers: signature/strong/casual/none.'}
            toPatchValue={mergedAfter}
          />
        );
      },
    },
    {
      key: 'overview',
      label: 'Overview',
      render: (r) => {
        if (r.na) return naCell();
        const mergedAfter = (v: string | null) => {
          const before = sliderOverviewByDest[r.destId] ?? {};
          const after = { ...before };
          if (!v) delete after[r.sliderKey];
          else after[r.sliderKey] = v;
          return after;
        };
        return (
          <TextFieldPanelCell
            ctx={{ entityType: 'destination', entityId: r.destId, entityLabel: r.destName, field: 'sliderOverview', fieldLabel: `${r.sliderLabel} overview`, loadedUpdatedAt: r.updatedAt }}
            value={r.overview || null}
            setLocal={(v) => {
              setSliderOverviewByDest((m) => ({ ...m, [r.destId]: mergedAfter(v) }));
              patchRow(r.destId, r.sliderKey, { overview: v ?? '' });
            }}
            hint={'The non-seasonal, one-paragraph summary shown for this interest at this destination — the "why" behind the scores, not tied to any one month.'}
            toPatchValue={mergedAfter}
          />
        );
      },
    },
    {
      key: 'monthlyText',
      label: 'Monthly',
      render: (r) => {
        if (r.na) return naCell();
        const mergedAfter = (v: (string | null)[]) => {
          const before = sliderMonthlyWeatherByDest[r.destId] ?? {};
          const after = { ...before };
          if (v.length === 0) delete after[r.sliderKey];
          else after[r.sliderKey] = v;
          return after;
        };
        return (
          <SliderMonthlyWeatherCell
            ctx={{ entityType: 'destination', entityId: r.destId, entityLabel: r.destName, field: 'sliderMonthlyWeather', fieldLabel: `${r.sliderLabel} monthly blurbs`, loadedUpdatedAt: r.updatedAt }}
            value={r.monthlyText ?? []}
            setLocal={(v) => {
              setSliderMonthlyWeatherByDest((m) => ({ ...m, [r.destId]: mergedAfter(v) }));
              patchRow(r.destId, r.sliderKey, { monthlyText: v });
            }}
            toPatchValue={mergedAfter}
          />
        );
      },
    },
    {
      key: 'sources',
      label: 'Sources',
      render: (r) => {
        if (r.na) return naCell();
        const mergedAfter = (v: SliderSource[]) => {
          const before = sliderSourcesByDest[r.destId] ?? {};
          const after = { ...before };
          if (v.length === 0) delete after[r.sliderKey];
          else after[r.sliderKey] = v;
          return after;
        };
        return (
          <SourcesPanelCell
            ctx={{ entityType: 'destination', entityId: r.destId, entityLabel: r.destName, field: 'sliderSources', fieldLabel: `${r.sliderLabel} sources`, loadedUpdatedAt: r.updatedAt }}
            value={r.sources}
            setLocal={(v) => {
              setSliderSourcesByDest((m) => ({ ...m, [r.destId]: mergedAfter(v) }));
              patchRow(r.destId, r.sliderKey, { sources: v });
            }}
            toPatchValue={mergedAfter}
          />
        );
      },
    },
  ];

  return (
    <AdminDataGrid
      rows={visibleRows}
      columns={columns}
      rowId={(r) => `${r.destId}:${r.sliderKey}`}
      searchText={(r) => `${r.destName} ${r.continent} ${r.sliderLabel}`}
      searchPlaceholder="Search place or interest…"
      stickyFirstColumn={false}
      rowHeight={34}
      footerNote={`${visibleRows.length} rows · Cap/Events/Style tiers editable inline — for a direct override of one month's final score instead, use the Place Profile screen`}
      toolbarExtra={
        <>
          <span className="filter-label">Interest</span>
          <select className="filter-select" value={selectedInterest} onChange={(e) => setSelectedInterest(e.target.value)}>
            <option value="all">All {VISIBLE_SLIDERS.length} interests</option>
            {SLIDER_GROUPS.map((group) => (
              <optgroup label={group} key={group}>
                {VISIBLE_SLIDERS.filter((s) => s.group === group).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.icon} {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </>
      }
    />
  );
}
