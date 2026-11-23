// 18 Nov 2026 (step 4 of docs/place-naming-plan.md): the pure rules for finding a place from whatever someone typed: its key (p0113), its current slug (myanmar), an old slug, or an
// id it had before the keys (bagan). No database here; src/lib/places/lookup.ts loads the tables and calls this.
import { KEY_PATTERN } from './identity';

export interface IdentityRow { key: string; label: string; slug: string }
export interface IdentityTables { identity: IdentityRow[]; slugRedirects: Array<{ slug: string; placeKey: string }>; idRedirects: Array<{ oldId: string; placeKey: string }> }
export type Resolved = IdentityRow & { how: 'key' | 'slug' | 'old-slug' | 'old-id' };

export function resolveFrom(t: IdentityTables, input: string): Resolved | null {
  const q = input.trim(); if (!q) return null;
  const byKey = new Map(t.identity.map((r) => [r.key, r])); const bySlug = new Map(t.identity.map((r) => [r.slug, r]));
  if (KEY_PATTERN.test(q) && byKey.has(q)) return { ...byKey.get(q)!, how: 'key' };
  const lower = q.toLowerCase();
  const s = bySlug.get(lower); if (s) return { ...s, how: 'slug' };
  const sr = t.slugRedirects.find((r) => r.slug === lower); if (sr && byKey.has(sr.placeKey)) return { ...byKey.get(sr.placeKey)!, how: 'old-slug' };
  const ir = t.idRedirects.find((r) => r.oldId === lower); if (ir && byKey.has(ir.placeKey)) return { ...byKey.get(ir.placeKey)!, how: 'old-id' };
  return null;
}

/** Resolves a list, and says which entries matched nothing so a script can stop instead of silently doing nothing. */
export function resolveAll(t: IdentityTables, inputs: string[]): { keys: string[]; unknown: string[] } {
  const keys: string[] = []; const unknown: string[] = [];
  for (const i of inputs) { const r = resolveFrom(t, i); if (r) keys.push(r.key); else unknown.push(i); }
  return { keys, unknown };
}

/** The next free key: one more than the highest used, never a reused number. */
export function nextKey(used: string[]): string {
  const n = used.reduce((m, k) => Math.max(m, KEY_PATTERN.test(k) ? Number(k.slice(1)) : 0), 0) + 1;
  if (n > 9999) throw new Error('Out of place keys');
  return `p${String(n).padStart(4, '0')}`;
}

/** A slug for a new place, made unique against every live slug, retired slug and old id (so it can never collide with a redirect). */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const t = new Set(taken); if (!base) throw new Error('A place needs a label');
  if (!t.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) if (!t.has(`${base}-${i}`)) return `${base}-${i}`;
  throw new Error('No free slug');
}
