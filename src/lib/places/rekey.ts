// 18 Nov 2026 (step 3 of docs/place-naming-plan.md): rewrites old place ids to keys inside JSON data. Pure and exact: a key, or a whole string value, is rewritten only when it IS an
// old id; a string is rewritten when it is two parts joined by "|", ":" or "__" and one part is an old id (for example "acadia:hiking", "scenicLandscapes|bagan",
// "scenicLandscapes__bagan"). Free text that merely contains an id ("Bagan is hot", "napa valley") is never touched.
export type KeyMap = Record<string, string>;
const SEPS = ['|', ':', '__'] as const;
const has = (m: KeyMap, k: string) => Object.prototype.hasOwnProperty.call(m, k);
const WORDISH = /^[A-Za-z0-9][\w-]*$/;

export interface RekeyStats { keys: number; values: number; composites: number }

export function rekeyString(s: string, map: KeyMap, stats?: RekeyStats, asKey = false): string {
  if (has(map, s)) { if (stats) { if (asKey) stats.keys += 1; else stats.values += 1; } return map[s]; }
  for (const sep of SEPS) {
    const i = s.indexOf(sep); if (i <= 0 || s.indexOf(sep, i + sep.length) !== -1) continue; // exactly one separator
    const a = s.slice(0, i); const b = s.slice(i + sep.length);
    if (has(map, b) && WORDISH.test(a) && !has(map, a)) { if (stats) stats.composites += 1; return `${a}${sep}${map[b]}`; }
    if (has(map, a) && WORDISH.test(b) && !has(map, b)) { if (stats) stats.composites += 1; return `${map[a]}${sep}${b}`; }
  }
  return s;
}

/** `valuesOnly` leaves object keys alone, for files whose keys are another source's names (the hotel panel keys) and only some values are place ids. */
export function rekeyJson<T>(v: T, map: KeyMap, stats?: RekeyStats, opts: { valuesOnly?: boolean } = {}): T {
  if (typeof v === 'string') return rekeyString(v, map, stats) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => rekeyJson(x, map, stats, opts)) as unknown as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const nk = opts.valuesOnly ? k : rekeyString(k, map, stats, true);
      if (nk in out) throw new Error(`Two keys became "${nk}"`);
      out[nk] = rekeyJson(x, map, stats, opts);
    }
    return out as T;
  }
  return v;
}
