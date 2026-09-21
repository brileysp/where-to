// Per-item edit tracking for places.costItems (label/price/unit/emoji live
// alongside id + who/when/what metadata inside the same jsonb array, so no
// migration). Pure and shared: the server stamps authoritatively on save
// (apply-edits.ts), the admin grid runs the same function optimistically so
// its columns update before the save lands.
//
// Metadata is never trusted from the caller — a matched item's metadata is
// always carried over from the previously stored version and only replaced
// when its content actually changed, so a client can't forge or blank it.

export type EditorKind = 'human' | 'agent';

export interface StampedCostItem {
  label: string;
  price: number;
  unit: string;
  emoji?: string | null;
  id?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  editorKind?: EditorKind | null;
  lastChange?: string | null;
}

const money = (n: number) => `$${n}`;
const quoted = (s: string) => `"${s}"`;

export function describeCostItemChange(prev: StampedCostItem, next: StampedCostItem): string[] {
  const out: string[] = [];
  if (prev.label !== next.label) out.push(`label ${quoted(prev.label)} → ${quoted(next.label)}`);
  if (prev.price !== next.price) out.push(`price ${money(prev.price)} → ${money(next.price)}`);
  if ((prev.unit ?? '') !== (next.unit ?? '')) out.push(`unit ${quoted(prev.unit ?? '')} → ${quoted(next.unit ?? '')}`);
  if ((prev.emoji ?? null) !== (next.emoji ?? null)) out.push(`icon ${prev.emoji ?? '(default)'} → ${next.emoji ?? '(default)'}`);
  return out;
}

export function stampCostItems<T extends StampedCostItem>(
  oldItems: StampedCostItem[],
  newItems: T[],
  editor: { name: string; kind: EditorKind },
  at: Date,
): T[] {
  const matched: (StampedCostItem | undefined)[] = new Array(newItems.length).fill(undefined);
  const taken = new Set<number>();

  // 1. Stable id.
  newItems.forEach((n, i) => {
    if (!n.id) return;
    const j = oldItems.findIndex((o, oi) => !taken.has(oi) && o.id === n.id);
    if (j >= 0) { matched[i] = oldItems[j]; taken.add(j); }
  });
  // 2. Id-less incoming items (legacy rows, or audit-log snapshots): same
  // label, then same array position (a rename). The stored side may already
  // carry ids, so don't require it to be id-less.
  newItems.forEach((n, i) => {
    if (matched[i] || n.id) return;
    const j = oldItems.findIndex((o, oi) => !taken.has(oi) && o.label === n.label);
    if (j >= 0) { matched[i] = oldItems[j]; taken.add(j); }
  });
  newItems.forEach((n, i) => {
    if (matched[i] || n.id) return;
    if (oldItems[i] && !taken.has(i)) { matched[i] = oldItems[i]; taken.add(i); }
  });

  const stamp = { updatedAt: at.toISOString(), updatedBy: editor.name, editorKind: editor.kind };
  return newItems.map((n, i) => {
    const prev = matched[i];
    const id = prev?.id ?? n.id ?? globalThis.crypto.randomUUID();
    if (!prev) return { ...n, id, ...stamp, lastChange: 'Added' };
    const changes = describeCostItemChange(prev, n);
    if (changes.length) return { ...n, id, ...stamp, lastChange: changes.join('; ') };
    return {
      ...n,
      id,
      updatedAt: prev.updatedAt ?? null,
      updatedBy: prev.updatedBy ?? null,
      editorKind: prev.editorKind ?? null,
      lastChange: prev.lastChange ?? null,
    };
  });
}
