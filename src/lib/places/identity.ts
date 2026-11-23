// 18 Nov 2026 (steps 1 and 2 of docs/place-naming-plan.md): the pure rules for a place's identity. A place has an unchanging KEY (p0012, assigned once, never reused),
// an editable LABEL (what the traveler sees), a SLUG (a readable, editable alias for addresses and scripts) and a SCOPE (what area it covers). Nothing here reads the
// database; scripts/fill-place-identity.ts and scripts/check-place-identity.ts use it.

export const KEY_PATTERN = /^p\d{4}$/;
export const SCOPE_LEVELS = ['city', 'area', 'region', 'country', 'multi_country'] as const;
export type ScopeLevel = (typeof SCOPE_LEVELS)[number];

/** The key for the nth place (1-based): p0001, p0002 ... Keys are plain labels for a row; they carry no meaning and are never reused. */
export function keyForNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 9999) throw new Error(`No key for number ${n}`);
  return `p${String(n).padStart(4, '0')}`;
}

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** A readable alias made from a label: "Nice & the French Riviera" becomes nice-and-the-french-riviera. */
export function slugify(label: string): string {
  return fold(label).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Sort key for the one-time alphabetical numbering: accents folded, case ignored, "The " ignored is NOT applied (labels are used as written). */
export function alphaSortKey(label: string): string {
  return fold(label).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The first assignment of keys: alphabetical by today's label. Ties (never expected) break by the old id, so the result is the same every time. Existing assignments are never changed. */
export function assignKeys(places: Array<{ id: string; label: string }>, existing: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { ...existing };
  const used = new Set(Object.values(existing));
  let n = used.size ? Math.max(...[...used].map((k) => Number(k.slice(1)))) : 0;
  const fresh = places.filter((p) => !(p.id in existing)).sort((a, b) => alphaSortKey(a.label).localeCompare(alphaSortKey(b.label)) || a.id.localeCompare(b.id));
  for (const p of fresh) { n += 1; const k = keyForNumber(n); if (used.has(k)) throw new Error(`Key ${k} would be reused`); out[p.id] = k; used.add(k); }
  return out;
}

/** The older label in a renamed-places entry: "Myanmar (was Bagan)" gives "Bagan"; null when the text has no "(was ...)". */
export function parseWasLabel(text: string): string | null {
  const m = text.match(/\(was ([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

/** Draft scope anchors from a label: "Zermatt & the Swiss Alps" gives ["Zermatt", "the Swiss Alps"]; a single name gives itself. A draft only; the owner confirms or corrects it. */
export function draftAnchors(label: string): string[] {
  const parts = label.split(/\s+&\s+|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [label];
}

/** Draft scope level from the stored place type. */
export function draftLevel(placeType: string | null | undefined): ScopeLevel {
  switch (placeType) {
    case 'country': return 'country';
    case 'region': case 'state_province': return 'region';
    case 'city': return 'city';
    default: return 'area'; // island, national_park, coastal_area, wilderness_area
  }
}

/** A slug is lowercase letters and digits joined by single hyphens. */
export function isValidSlug(slug: string): boolean { return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug); }

/** Anchors typed one per line (or separated by semicolons) in the admin form: trimmed, blanks and repeats dropped. */
export function parseAnchors(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\n;]+/)) { const a = raw.trim(); if (a && !out.some((x) => x.toLowerCase() === a.toLowerCase())) out.push(a); }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The date a label was retired, in words: "18 Nov 2026". */
export function dateNote(d: Date): string { return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
