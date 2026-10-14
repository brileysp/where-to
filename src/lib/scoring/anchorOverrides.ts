import { db } from '@/lib/db/client';
import { interestAnchorOverrides } from '@/lib/db/schema';
import { INTEREST_ANCHORS } from './anchors';

/**
 * Admin-edited anchors (what a 10 means, and the places allowed one) laid over the built-in list in anchors.ts.
 * The built-in values are remembered the first time, so deleting an override restores them. Applied in place, so every
 * reader of INTEREST_ANCHORS (the Gemini validator, the interest pages, the audits) sees the edit.
 */
const BUILT_IN = new Map<string, { definition: string; ten: string[] } | null>();
let lastLoad = 0;

export async function loadAnchorOverrides(force = false): Promise<void> {
  if (!force && Date.now() - lastLoad < 15_000) return;
  const rows = await db.select().from(interestAnchorOverrides);
  const byKey = new Map(rows.map((r) => [r.interestKey, r]));
  const keys = new Set([...Object.keys(INTEREST_ANCHORS), ...BUILT_IN.keys(), ...byKey.keys()]);
  for (const key of keys) {
    if (!BUILT_IN.has(key)) {
      const cur = INTEREST_ANCHORS[key];
      BUILT_IN.set(key, cur ? { definition: cur.definition, ten: [...cur.ten] } : null);
    }
    const base = BUILT_IN.get(key) ?? null;
    const o = byKey.get(key);
    const definition = o?.definition ?? base?.definition ?? '';
    const ten = o?.ten ?? base?.ten ?? [];
    if (!o && !base) { delete INTEREST_ANCHORS[key]; continue; }
    INTEREST_ANCHORS[key] = { definition, ten: [...ten] };
  }
  lastLoad = Date.now();
}

/** Forget the freshness window so the next load re-reads the table (after a save). */
export function invalidateAnchorOverrides(): void {
  lastLoad = 0;
}
