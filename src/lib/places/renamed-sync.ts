// 18 Nov 2026 (step 6 of docs/place-naming-plan.md): docs/renamed-places.json used to be a list I kept by hand, so the "no old name in a text" check only knew the places on it. It is now BUILT from
// the label history (place_label_history): every label a place has retired is a word that must not stand for the place in a text. The `allow` part (an old name the owner chose to keep, with her
// reason) is the only hand-kept part and is preserved. Scripts call syncRenamedPlacesFile() before they check text; scripts/check-place-identity.ts fails when the file is out of date.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface HistoryRow { placeKey: string; label: string; isCurrent: boolean; createdAt?: Date | string | number }
export interface RenamedDoc { _note?: string; ids: Record<string, string>; earlier?: Record<string, string[]>; allow?: unknown }

const NOTE = 'Built from the label history (place_label_history) by src/lib/places/renamed-sync.ts: every label a place has retired is an old name that must not stand for the place in a text. Edit names on the admin Names & scope screen, not here. Only "allow" is kept by hand (an old name the owner chose to keep, with her reason). gemini-author-batch.ts refuses to send a renamed place to Gemini unless docs/<interest>-facts.json has a non-empty scope sheet for it (override: --allow-unscoped-renamed).';

export function buildRenamedDoc(currentLabels: Record<string, string>, history: HistoryRow[], existing: Partial<RenamedDoc> = {}): RenamedDoc {
  const ids: Record<string, string> = {}; const earlier: Record<string, string[]> = {};
  const at = (h: HistoryRow) => (h.createdAt ? new Date(h.createdAt).getTime() : 0);
  for (const key of Object.keys(currentLabels).sort()) {
    const cur = currentLabels[key];
    const retired = history.filter((h) => h.placeKey === key && !h.isCurrent && h.label.toLowerCase() !== cur.toLowerCase()).sort((a, b) => at(b) - at(a));
    const distinct = [...new Set(retired.map((h) => h.label))];
    if (!distinct.length) continue;
    ids[key] = `${cur} (was ${distinct[0]})`;
    if (distinct.length > 1) earlier[key] = distinct.slice(1);
  }
  const doc: RenamedDoc = { _note: NOTE, ids };
  if (Object.keys(earlier).length) doc.earlier = earlier;
  if (existing.allow) doc.allow = existing.allow;
  return doc;
}

const FILE = join(__dirname, '..', '..', '..', 'docs', 'renamed-places.json');
const serialize = (d: RenamedDoc) => JSON.stringify(d, null, 1) + '\n';

/** Reads the label history and rewrites docs/renamed-places.json when it differs. Returns whether it changed. Scripts only (it reads the database). */
export async function syncRenamedPlacesFile(opts: { check?: boolean; file?: string } = {}): Promise<{ changed: boolean }> {
  const { db } = await import('@/lib/db/client'); const { placeIdentity, placeLabelHistory } = await import('@/lib/db/schema');
  const ident = (await db.select({ key: placeIdentity.key, label: placeIdentity.label }).from(placeIdentity)) as Array<{ key: string; label: string }>;
  const hist = (await db.select().from(placeLabelHistory)) as HistoryRow[];
  const file = opts.file ?? FILE; const existing: Partial<RenamedDoc> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const next = serialize(buildRenamedDoc(Object.fromEntries(ident.map((i) => [i.key, i.label])), hist, existing));
  const same = existsSync(file) && readFileSync(file, 'utf8') === next;
  if (!same && !opts.check) writeFileSync(file, next);
  return { changed: !same };
}
