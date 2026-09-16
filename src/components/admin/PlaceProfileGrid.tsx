'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFieldEdit } from './useFieldEdit';
import { useUpdatedAtSync } from './useUpdatedAtSync';
import { scoreColor } from '@/lib/admin/scoreColor';

export interface ProfileCell {
  key: string;
  label: string;
  icon: string;
  group: string;
  na: boolean;
  base: number | null; // the authored value the monthly formula starts from
  monthly: number[]; // 12 entries, already reflects any existing override
  overrides: Record<number, number>; // sparse, which months are admin-overridden
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PlaceProfileGrid({
  destId,
  destName,
  destEmoji,
  region,
  continent,
  updatedAt: initialUpdatedAt,
  groups,
  cells,
  initialBaseScores,
}: {
  destId: string;
  destName: string;
  destEmoji: string;
  region: string;
  continent: string;
  updatedAt: string;
  groups: string[];
  cells: ProfileCell[];
  initialBaseScores: Record<string, number>;
}) {
  const [rows, setRows] = useState(cells);
  const [allOverrides, setAllOverrides] = useState<Record<string, Record<number, number>>>(
    Object.fromEntries(cells.map((c) => [c.key, { ...c.overrides }])),
  );
  const [baseScores, setBaseScores] = useState(initialBaseScores);
  const [editing, setEditing] = useState<string | null>(null); // `${sliderKey}:${monthIdx}`
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const commit = useFieldEdit();

  useUpdatedAtSync('destination', (entityId, newUpdatedAt) => {
    if (entityId === destId) setUpdatedAt(newUpdatedAt);
  });

  function patchCell(key: string, monthIdx: number, value: number, overridden: boolean) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const monthly = [...r.monthly];
        monthly[monthIdx] = value;
        const overrides = { ...r.overrides };
        if (overridden) overrides[monthIdx] = value;
        else delete overrides[monthIdx];
        return { ...r, monthly, overrides };
      }),
    );
  }

  function beginEdit(key: string, monthIdx: number, currentValue: number) {
    setEditing(`${key}:${monthIdx}`);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-profile-input="${key}:${monthIdx}"]`);
      if (input) {
        input.value = String(currentValue);
        input.focus();
        input.select();
      }
    }, 0);
  }

  function commitEdit(key: string, label: string, monthIdx: number, raw: string) {
    setEditing(null);
    const trimmed = raw.trim();
    const before = allOverrides[key] ?? {};
    const cell = rows.find((r) => r.key === key)!;
    const oldDisplay = cell.monthly[monthIdx];

    if (trimmed === '') {
      // Clear an override — falls back to the computed value on next reload.
      if (before[monthIdx] === undefined) return;
      const after = { ...before };
      delete after[monthIdx];
      commit<number | null>({
        entityType: 'destination',
        entityId: destId,
        entityLabel: destName,
        field: 'scoreOverrides',
        fieldLabel: `${label} — ${MONTH_SHORT[monthIdx]} override`,
        loadedUpdatedAt: updatedAt,
        oldValue: oldDisplay,
        newValue: null,
        toLabel: (v) => (v === null ? '(computed)' : String(v)),
        toPatchValue: () => ({ ...allOverrides, [key]: after }),
        setLocal: () => {
          setAllOverrides((m) => ({ ...m, [key]: after }));
          patchCell(key, monthIdx, oldDisplay, false);
        },
      });
      return;
    }

    const v = Number(trimmed);
    if (isNaN(v) || v < 0 || v > 10) return;
    const rounded = Math.round(v);
    if (rounded === oldDisplay && before[monthIdx] !== undefined) return;
    const after = { ...before, [monthIdx]: rounded };
    commit({
      entityType: 'destination',
      entityId: destId,
      entityLabel: destName,
      field: 'scoreOverrides',
      fieldLabel: `${label} — ${MONTH_SHORT[monthIdx]} override`,
      loadedUpdatedAt: updatedAt,
      oldValue: oldDisplay,
      newValue: rounded,
      toPatchValue: () => ({ ...allOverrides, [key]: after }),
      setLocal: (val) => {
        const applying = val === rounded;
        setAllOverrides((m) => ({ ...m, [key]: applying ? after : before }));
        patchCell(key, monthIdx, applying ? rounded : oldDisplay, applying);
      },
    });
  }

  function patchBase(key: string, value: number) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, base: value } : r)));
  }

  function commitBase(key: string, label: string, oldValue: number | null, raw: string) {
    const trimmed = raw.trim();
    const v = trimmed === '' ? 0 : Number(trimmed);
    if (isNaN(v)) return;
    const rounded = Math.max(0, Math.min(10, Math.round(v * 2) / 2));
    if (rounded === (oldValue ?? 0)) return;
    const before = baseScores;
    const after = { ...before, [key]: rounded };
    commit({
      entityType: 'destination',
      entityId: destId,
      entityLabel: destName,
      field: 'baseScores',
      fieldLabel: `${label} base score`,
      loadedUpdatedAt: updatedAt,
      oldValue: oldValue ?? 0,
      newValue: rounded,
      toPatchValue: () => after,
      setLocal: (val) => {
        const applying = val === rounded;
        setBaseScores(applying ? after : before);
        patchBase(key, applying ? rounded : oldValue ?? 0);
      },
    });
  }

  return (
    <div className="grid-wrap">
      <div className="toolbar">
        <Link href="/admin/destinations" className="btn">
          ← Back
        </Link>
        <span style={{ fontSize: 18 }}>{destEmoji}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{destName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {region} · {continent}
          </div>
        </div>
        <div className="divider" />
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          0 <span style={{ display: 'inline-block', width: 90, height: 9, borderRadius: 3, border: '1px solid var(--border)', background: 'linear-gradient(90deg,#ffffff,#bfe0c8,#3a7d4f)', verticalAlign: 'middle', margin: '0 4px' }} /> 10
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>✎ = manually overridden</span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Click any cell to set an exact value · empty input clears the override</span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Editing Base changes the formula input — reload the page to see its effect on the months</span>
      </div>
      <div className="grid-scroll">
        <table className="grid profile-grid">
          <thead>
            <tr>
              <th className="sticky-col no-sort" style={{ minWidth: 220, textAlign: 'left' }}>
                Interest
              </th>
              <th className="no-sort" style={{ textAlign: 'center', minWidth: 50 }}>
                Base
              </th>
              {MONTH_SHORT.map((m) => (
                <th key={m} className="no-sort" style={{ textAlign: 'center', minWidth: 40 }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              rows
                .filter((r) => r.group === group)
                .map((r) => (
                  <tr key={r.key}>
                    <td className="sticky-col">
                      <div className="cell-inner interest-tag">
                        {r.icon} {r.label}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="cell-inner" style={{ justifyContent: 'center' }}>
                        {r.na ? (
                          <span style={{ color: 'var(--text-faint)' }}>—</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.5}
                            className="cost-input num"
                            style={{ width: 40, textAlign: 'center', fontWeight: 700 }}
                            defaultValue={r.base ?? 0}
                            key={`${r.key}:${r.base}`}
                            onBlur={(e) => commitBase(r.key, r.label, r.base, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                          />
                        )}
                      </div>
                    </td>
                    {MONTH_SHORT.map((_, idx) => {
                      if (r.na) {
                        return (
                          <td key={idx} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                            <div className="cell-inner" style={{ justifyContent: 'center' }}>
                              —
                            </div>
                          </td>
                        );
                      }
                      const cellId = `${r.key}:${idx}`;
                      const isEditing = editing === cellId;
                      const value = r.monthly[idx];
                      // Curve-interpolated months (anything between two
                      // authored anchors) can land on a fractional value —
                      // e.g. 4.3333333333333 — that's real precision the
                      // formula uses internally, but the screen should
                      // always show the nearest whole number.
                      const displayValue = Math.round(value);
                      const overridden = r.overrides[idx] !== undefined;
                      const bg = scoreColor(value);
                      return (
                        <td
                          key={idx}
                          style={{ background: bg ?? undefined, textAlign: 'center', cursor: 'pointer' }}
                          onClick={() => !isEditing && beginEdit(r.key, idx, displayValue)}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              data-profile-input={cellId}
                              style={{ width: 34, textAlign: 'center', fontWeight: 700 }}
                              className="cost-input num"
                              defaultValue={displayValue}
                              onBlur={(e) => commitEdit(r.key, r.label, idx, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditing(null);
                              }}
                            />
                          ) : (
                            <div className="cell-inner" style={{ justifyContent: 'center', fontWeight: 700, color: bg ? '#17190f' : 'var(--text)' }}>
                              {displayValue}
                              {overridden && <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.75 }}>✎</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
