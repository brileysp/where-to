// Compares the public page's new path (light list read + each place's text fetched separately) with the old full read, place by place.
// Any difference in any field of any place is printed. Also prints the sizes. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/check-list-vs-full.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const norm = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as object).sort(([a], [b]) => a.localeCompare(b))) : x));
(async () => {
  const { getAllScoredPlaces, getListScoredPlaces } = await import('../src/lib/db/queries/places');
  const { getListPlaceRows } = await import('../src/lib/db/queries/list-place-rows');
  const { getPlaceDetailText } = await import('../src/lib/db/queries/place-detail');
  const full = await getAllScoredPlaces();
  const list = await getListScoredPlaces();
  const listRows = await getListPlaceRows();
  const mb = (n: number) => (n / 1048576).toFixed(2);
  console.log(`places: full ${full.length}, list ${list.length}`);
  console.log(`list rows as read from the database: ${mb(JSON.stringify(listRows).length)} MB`);
  console.log(`public payload (old, with text): ${mb(JSON.stringify(full).length)} MB; (new list, no text): ${mb(JSON.stringify(list).length)} MB`);
  const byId = new Map(list.map((d) => [d.id, d]));
  let bad = 0, detailBytes = 0, maxDetail = 0;
  for (const f of full) {
    const l = byId.get(f.id);
    if (!l) { console.log('MISSING in list:', f.id); bad++; continue; }
    const d = await getPlaceDetailText(f.id);
    if (!d) { console.log('NO DETAIL:', f.id); bad++; continue; }
    const n = JSON.stringify(d).length; detailBytes += n; maxDetail = Math.max(maxDetail, n);
    // The public list leaves out `explanations` and `sliderCurves` on purpose (never read by the public page); everything else must match.
    const merged = { ...l, ...d, explanations: f.explanations, sliderCurves: f.sliderCurves };
    if (norm(merged) !== norm(f)) {
      bad++;
      const diffKeys = Object.keys({ ...f, ...merged }).filter((k) => norm((f as any)[k]) !== norm((merged as any)[k]));
      console.log('DIFFERENT:', f.id, diffKeys.join(', '));
    }
  }
  console.log(`detail text per place: average ${(detailBytes / full.length / 1024).toFixed(1)} KB, largest ${(maxDetail / 1024).toFixed(1)} KB`);
  console.log(bad === 0 ? `OK: all ${full.length} places are identical (scores, ranking inputs, text)` : `${bad} places differ`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
