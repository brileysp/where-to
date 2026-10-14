// What the audit log stores for a place edit: only what changed, not two full copies of the whole place (13 KB each time, which made the log
// 84% of the database). Rules:
//  - a column that did not change is left out;
//  - a column that is a plain object keyed by interest (curves, monthly text, overviews...) stores only the keys that changed, wrapped as
//    { __sub: { key: value } }; a key that was removed or did not exist is null;
//  - any other changed column (a number, an array, a short list) is stored whole.
// "Restore this version" writes the `after` side back column by column; a wrapped column is merged into the live value, so restoring one
// entry never overwrites interests it did not touch (see mergeSub and restoreDestinationVersion).

type Row = Record<string, unknown>;
const isObject = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface SubDiff { __sub: Row }
export const isSubDiff = (v: unknown): v is SubDiff => isObject(v) && isObject(v.__sub) && Object.keys(v).length === 1;

/** The changed parts of one place edit, for the audit log. `id` is left out: the entry already names the place. */
export function auditDiff(before: unknown, after: unknown): { before: Row; after: Row } | null {
  if (!isObject(before) || !isObject(after)) return null;
  const b: Row = {};
  const a: Row = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (k === 'id' || same(before[k], after[k])) continue;
    if (isObject(before[k]) && isObject(after[k])) {
      const sb: Row = {};
      const sa: Row = {};
      for (const s of new Set([...Object.keys(before[k] as Row), ...Object.keys(after[k] as Row)])) {
        if (same((before[k] as Row)[s], (after[k] as Row)[s])) continue;
        sb[s] = (before[k] as Row)[s] ?? null;
        sa[s] = (after[k] as Row)[s] ?? null;
      }
      b[k] = { __sub: sb };
      a[k] = { __sub: sa };
    } else {
      b[k] = before[k] ?? null;
      a[k] = after[k] ?? null;
    }
  }
  return { before: b, after: a };
}

/** Applies a stored value to the live column value: a wrapped diff is merged in (null removes a key), anything else replaces it. */
export function mergeSub(current: unknown, stored: unknown): unknown {
  if (!isSubDiff(stored)) return stored;
  const merged: Row = isObject(current) ? { ...current } : {};
  for (const [k, v] of Object.entries(stored.__sub)) {
    if (v === null) delete merged[k];
    else merged[k] = v;
  }
  return merged;
}
