// 18 Nov 2026, step 2 of docs/place-naming-plan.md: fills the place identity tables (keys, labels, slugs, label history, old-id redirects, source keys, DRAFT scope).
// INSERT ONLY: it never changes or deletes a row, and never reassigns a key. Dry run by default; --apply writes everything in one all-or-nothing transaction.
// The key assignment (alphabetical by today's label, set once, never reused) is saved in scripts/data/place-keys-nov18.json; later runs read it and only add keys for new places.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fill-place-identity.ts [--apply]
import { readFileSync, writeFileSync, existsSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const ROOT = join(__dirname, '..'); const KEYS_FILE = join(ROOT, 'scripts/data/place-keys-nov18.json');
const AGODA_CITIES: Array<[string, string, string]> = [['bagan', '16597', 'Bagan'], ['beijing', '1569', 'Beijing'], ['borneo', '5070', 'Kota Kinabalu'], ['bangkok', '9395', 'Bangkok'], ['bali', '17193', 'Bali'], ['hokkaido', '3435', 'Niseko (SONEKA)'], ['hokkaido', '105656', 'Niseko (SnowRia)']];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { places, placeIdentity, placeLabelHistory, placeSlugRedirects, placeIdRedirects, placeSourceKeys } = await import('../src/lib/db/schema');
  const { assignKeys, slugify, parseWasLabel, draftAnchors, draftLevel } = await import('../src/lib/places/identity');
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const rows = (await getPrimaryPlaceRows()) as any[]; const byId = new Map(rows.map((r) => [r.id, r]));
  const renamed = JSON.parse(readFileSync(join(ROOT, 'docs/renamed-places.json'), 'utf8')).ids as Record<string, string>;
  const panelMap = JSON.parse(readFileSync(join(ROOT, 'scripts/data/hotel-place-map-nov15.json'), 'utf8')) as Record<string, { placeId: string; file: string; quotedOn: string; searchTerm: string }>;
  const existing: Record<string, string> = existsSync(KEYS_FILE) ? JSON.parse(readFileSync(KEYS_FILE, 'utf8')).keys : {};
  const keys = assignKeys(rows.map((r) => ({ id: r.id, label: r.name })), existing);
  const problems: string[] = []; const slugs = new Map<string, string>(); // slug or redirect -> key
  const claim = (s: string, key: string, what: string) => { const o = slugs.get(s); if (o && o !== key) problems.push(`${what} "${s}" is wanted by both ${o} and ${key}`); else slugs.set(s, key); };
  const identity: any[] = []; const history: any[] = []; const slugRows: any[] = []; const idRows: any[] = [];
  for (const r of rows) {
    const key = keys[r.id]; const label: string = r.name; const slug = slugify(label); const was = renamed[r.id] ? parseWasLabel(renamed[r.id]) : null;
    claim(slug, key, 'slug');
    const anchors = was ? draftAnchors(was) : draftAnchors(label);
    identity.push({ key, placeId: r.id, label, slug, level: draftLevel(r.placeType), scopeVersion: renamed[r.id] ? 2 : 1, anchors, scopeStatus: 'draft',
      scopeNote: renamed[r.id] ? `Widened or re-scoped before 14 Oct 2026 (exact date not recorded) from "${was}". DRAFT: the anchors listed are what the old scope covered, which is also where the hotel and other samples were taken; add the other areas it now covers.` : '' });
    history.push({ placeKey: key, label, isCurrent: true, retiredNote: '', reason: 'label when keys were introduced (18 Nov 2026)' });
    if (was) history.push({ placeKey: key, label: was, isCurrent: false, retiredNote: 'Oct 2026', reason: 'renamed when the scope was widened or re-scoped (docs/renamed-places.json)' });
    idRows.push({ oldId: r.id, placeKey: key, note: 'id before the keys were introduced (18 Nov 2026)' });
    if (r.id !== slug) { claim(r.id, key, 'old id'); slugRows.push({ slug: r.id, placeKey: key, kind: 'old_id' }); }
    if (was) { const ws = slugify(was); if (ws !== slug && ws !== r.id) { claim(ws, key, 'old slug'); slugRows.push({ slug: ws, placeKey: key, kind: 'old_slug' }); } }
  }
  const src: any[] = []; const seen = new Set<string>();
  const add = (source: string, sourceKey: string, placeId: string, note: string) => { const k = keys[placeId]; if (!k) { problems.push(`source key ${source}/${sourceKey} points at unknown place ${placeId}`); return; } const id = `${source}|${sourceKey}`; if (seen.has(id)) { const o = src.find((x) => x.source === source && x.sourceKey === sourceKey); if (o.placeKey !== k) problems.push(`source key ${id} maps to two places (${o.placeKey}, ${k})`); return; } seen.add(id); src.push({ source, sourceKey, placeKey: k, note }); };
  for (const [panelKey, v] of Object.entries(panelMap)) { add('hotel-panel-file', panelKey, v.placeId, `${v.file}, quoted ${v.quotedOn}`); add('booking.com-search', v.searchTerm, v.placeId, `search term used for ${v.file}`); }
  for (const [pid, city, note] of AGODA_CITIES) add('agoda-city', city, pid, `${note}; Agoda city id used 17 Nov 2026`);
  if (problems.length) { console.log('PROBLEMS (nothing written):\n  ' + problems.join('\n  ')); process.exit(1); }
  const have = (await db.select().from(placeIdentity)) as any[];
  console.log(`${rows.length} places; ${identity.length} identity rows, ${history.length} label rows (${history.filter((h) => !h.isCurrent).length} retired), ${slugRows.length} slug redirects, ${idRows.length} id redirects, ${src.length} source keys. Already in the table: ${have.length}.`);
  if (have.length) { console.log('The identity table already has rows; this script only inserts into an empty table. Run scripts/check-place-identity.ts to compare.'); process.exit(have.length === rows.length ? 0 : 1); }
  if (!apply) { console.log('Dry run: nothing written. First five:', identity.slice(0, 5).map((i) => `${i.key} ${i.label} (${i.slug})`).join('; ')); process.exit(0); }
  await db.transaction(async (tx) => {
    await tx.insert(placeIdentity).values(identity); await tx.insert(placeLabelHistory).values(history); await tx.insert(placeIdRedirects).values(idRows);
    if (slugRows.length) await tx.insert(placeSlugRedirects).values(slugRows); if (src.length) await tx.insert(placeSourceKeys).values(src);
  });
  if (!existsSync(KEYS_FILE)) writeFileSync(KEYS_FILE, JSON.stringify({ assignedOn: '2026-11-18', rule: 'alphabetical by label at that date, accents folded, case ignored; never reassigned or reused', keys }, null, 1) + '\n');
  console.log('Written in one transaction. Keys saved to scripts/data/place-keys-nov18.json.'); process.exit(0);
})();
