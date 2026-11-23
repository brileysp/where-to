// 18 Nov 2026, step 2 of docs/place-naming-plan.md: checks that the place identity tables are complete and consistent. Exit code 1 when anything is wrong.
// Until step 4 moves reads over, the label must equal places.name exactly (two copies, one rule). Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/check-place-identity.ts
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  const { db } = await import('../src/lib/db/client'); const s = await import('../src/lib/db/schema'); const { KEY_PATTERN, SCOPE_LEVELS, slugify } = await import('../src/lib/places/identity');
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const places = (await getPrimaryPlaceRows()) as any[]; const ident = (await db.select().from(s.placeIdentity)) as any[]; const hist = (await db.select().from(s.placeLabelHistory)) as any[];
  const slugR = (await db.select().from(s.placeSlugRedirects)) as any[]; const idR = (await db.select().from(s.placeIdRedirects)) as any[]; const src = (await db.select().from(s.placeSourceKeys)) as any[];
  const keysFile = JSON.parse(readFileSync(join(__dirname, 'data/place-keys-nov18.json'), 'utf8')).keys as Record<string, string>;
  const bad: string[] = []; const byPlace = new Map(ident.map((i) => [i.placeId, i])); const keys = new Set(ident.map((i) => i.key)); const savedKeys = new Set(Object.values(keysFile));
  // Since step 3 (18 Nov 2026) places.id IS the key, so the identity row's place_id must equal its key.
  for (const p of places) { const i = byPlace.get(p.id); if (!i) { bad.push(`place ${p.id} has no identity row`); continue; } if (i.label !== p.name) bad.push(`${i.key}: label "${i.label}" differs from places.name "${p.name}"`); if (i.placeId !== i.key) bad.push(`${i.key}: place_id ${i.placeId} differs from the key`); if (!savedKeys.has(i.key)) bad.push(`${i.key}: not in the saved key assignment`); }
  if (ident.length !== places.length) bad.push(`${ident.length} identity rows for ${places.length} places`);
  for (const i of ident) { if (!KEY_PATTERN.test(i.key)) bad.push(`${i.key}: bad key format`); if (!(SCOPE_LEVELS as readonly string[]).includes(i.level)) bad.push(`${i.key}: bad level ${i.level}`); if (!i.slug || i.slug !== i.slug.toLowerCase()) bad.push(`${i.key}: bad slug`); if (!Array.isArray(i.anchors) || !i.anchors.length) bad.push(`${i.key}: no anchors`); }
  const sorted = [...ident].sort((a, b) => a.key.localeCompare(b.key)); sorted.forEach((i, n) => { if (i.key !== `p${String(n + 1).padStart(4, '0')}`) bad.push(`keys are not p0001..p${String(ident.length).padStart(4, '0')} without gaps (at ${i.key})`); });
  const allSlugs = new Map<string, string>(); for (const i of ident) allSlugs.set(i.slug, i.key); for (const r of slugR) { if (allSlugs.has(r.slug) && allSlugs.get(r.slug) !== r.placeKey) bad.push(`redirect ${r.slug} collides with the live slug of ${allSlugs.get(r.slug)}`); if (!keys.has(r.placeKey)) bad.push(`redirect ${r.slug} points at unknown key`); }
  for (const [oldId, k] of Object.entries(keysFile)) { if (!idR.find((r) => r.oldId === oldId && r.placeKey === k)) bad.push(`old id ${oldId} has no redirect to ${k}`); const slug = ident.find((i) => i.key === k)?.slug; if (oldId !== slug && !slugR.find((r) => r.slug === oldId && r.placeKey === k)) bad.push(`old id ${oldId} does not resolve as a slug`); }
  for (const k of keys) { const cur = hist.filter((h) => h.placeKey === k && h.isCurrent); const label = ident.find((i) => i.key === k).label; if (cur.length !== 1 || cur[0].label !== label) bad.push(`${k}: label history has no single current row equal to the label`); }
  for (const r of src) if (!keys.has(r.placeKey)) bad.push(`source key ${r.source}/${r.sourceKey} points at unknown key`);
  const { buildKeysFile } = await import('../src/lib/places/keys-file'); const kf = join(__dirname, '../src/lib/places/keys.generated.ts');
  if (readFileSync(kf, 'utf8') !== buildKeysFile({ identity: ident, slugRedirects: slugR, idRedirects: idR })) bad.push('src/lib/places/keys.generated.ts is out of date: run scripts/generate-place-keys.ts');
  const { syncRenamedPlacesFile } = await import('../src/lib/places/renamed-sync'); if ((await syncRenamedPlacesFile({ check: true })).changed) bad.push('docs/renamed-places.json does not match the label history: run scripts/sync-renamed-places.ts');
  { const { staleScopeRows } = await import('../src/lib/places/scope-stale'); const st = await staleScopeRows(); if (st.length) console.log(`Made for an older scope (listed, not an error): ${st.reduce((n, x) => n + x.count, 0)} rows across ${new Set(st.map((x) => x.key)).size} places; the Names & scope screen shows each place.`); }
  const draft = ident.filter((i) => i.scopeStatus === 'draft').length;
  console.log(`${ident.length} identity rows, ${hist.length} label rows, ${slugR.length} slug redirects, ${idR.length} id redirects, ${src.length} source keys. Scope confirmed by the owner: ${ident.length - draft}; still draft: ${draft}.`);
  if (bad.length) { console.log('PROBLEMS:\n  ' + [...new Set(bad)].join('\n  ')); process.exit(1); }
  console.log('Place identity is complete and consistent.'); process.exit(0);
})();
