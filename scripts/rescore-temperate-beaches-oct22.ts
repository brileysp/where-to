// 22 Oct 2026: re-scores the monthly Beaches & Swimming curves of temperate-water places from sea (or lake) temperature, because the old curves were
// far too high outside summer (the Dalmatian Coast scored 6.0 in January and 8.2 in March to May while its sea is a cold 54 to 60 F).
// Method: for each place, a typical year of water temperature (a smooth curve from its coldest month to its warmest, warmest in August in the north
// and February in the south); a swimming comfort factor from the temperature (about 60 F = 15%, 66 F = 42%, 70 F = 70%, 74 F = 95%, 76 F or more = 100%), taken
// relative to the place's own warmest month so the place keeps its peak; and a small floor for places where sunbathing still works in mild air.
// The place keeps its current peak (its best month). Old curves are saved to docs/backups/beach-curves-temperate-2026-10-22.json.
// A DRY RUN unless --apply. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/rescore-temperate-beaches-oct22.ts [--apply] [--out=file.json]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

/** id: [coldest month F, warmest month F, hemisphere, floor share of the peak that mild air alone gives]. */
export const WATER: Record<string, [number, number, 'N' | 'S', number]> = {
  // Mediterranean and Black Sea
  mallorca: [57, 77, 'N', 0.2], sardinia: [57, 78, 'N', 0.2], sicily: [59, 79, 'N', 0.2], puglia: [56, 77, 'N', 0.15], croatia: [54, 76, 'N', 0.12],
  santorini: [60, 76, 'N', 0.15], amalfi: [57, 77, 'N', 0.12], 'nice-riviera': [55, 76, 'N', 0.15], provence: [54, 74, 'N', 0.12], barcelona: [56, 77, 'N', 0.15],
  athens: [59, 78, 'N', 0.15], tuscany: [54, 76, 'N', 0.1], rome: [55, 77, 'N', 0.1], venice: [47, 77, 'N', 0.08], istanbul: [50, 73, 'N', 0.1], andalucia: [60, 72, 'N', 0.2],
  // Atlantic islands and coasts of southern Europe
  canaries: [64, 73, 'N', 0.55], madeira: [64, 72, 'N', 0.4], azores: [62, 71, 'N', 0.25], algarve: [59, 69, 'N', 0.3], lisbon: [58, 68, 'N', 0.2],
  'douro-valley-porto': [57, 65, 'N', 0.1], 'basque-country': [55, 66, 'N', 0.1], bordeaux: [54, 68, 'N', 0.1],
  // British Isles
  cornwall: [50, 63, 'N', 0.15], snowdonia: [49, 60, 'N', 0.1], ireland: [49, 60, 'N', 0.1], 'belfast-giants-causeway': [48, 58, 'N', 0.1], 'scottish-highlands-skye': [47, 57, 'N', 0.1],
  edinburgh: [44, 57, 'N', 0.1], 'st-andrews-fife': [44, 56, 'N', 0.1],
  // Northern Europe and the cities with lakes, canals and river lidos
  amsterdam: [41, 66, 'N', 0.08], copenhagen: [36, 66, 'N', 0.08], berlin: [36, 72, 'N', 0.05], vienna: [37, 75, 'N', 0.05], paris: [40, 70, 'N', 0.05], 'bavaria-munich': [36, 72, 'N', 0.05],
  // North America
  'cape-cod-islands': [40, 70, 'N', 0.1], nyc: [38, 74, 'N', 0.08], 'hudson-valley': [35, 75, 'N', 0.05], chicago: [33, 72, 'N', 0.05], vermont: [34, 72, 'N', 0.05],
  'charleston-savannah': [52, 82, 'N', 0.15], acadia: [40, 58, 'N', 0.1], 'nova-scotia': [38, 65, 'N', 0.1], 'upper-peninsula': [36, 60, 'N', 0.05], whistler: [44, 65, 'N', 0.08], 'texas-hill-country': [52, 85, 'N', 0.1],
  // Southern hemisphere
  sydney: [63, 74, 'S', 0.3], tasmania: [52, 64, 'S', 0.1], 'north-island': [58, 70, 'S', 0.2], 'marlborough-abel-tasman': [53, 65, 'S', 0.1], 'cape-town': [56, 68, 'S', 0.2],
  // Asia
  hokkaido: [36, 70, 'N', 0.05],
};

const G: Array<[number, number]> = [[50, 0.04], [56, 0.08], [60, 0.15], [62, 0.22], [64, 0.32], [66, 0.42], [68, 0.55], [70, 0.7], [72, 0.85], [74, 0.95], [76, 1]];
const comfort = (f: number): number => {
  if (f <= G[0][0]) return G[0][1];
  for (let i = 1; i < G.length; i++) if (f <= G[i][0]) { const [x0, y0] = G[i - 1]; const [x1, y1] = G[i]; return y0 + ((y1 - y0) * (f - x0)) / (x1 - x0); }
  return 1;
};
/** Water temperature for month m (1 to 12): a smooth curve between the coldest and warmest months. */
export const waterF = (cold: number, warm: number, hem: 'N' | 'S', m: number): number => {
  const peakMonth = hem === 'N' ? 8.3 : 2.3;
  return (cold + warm) / 2 + ((warm - cold) / 2) * Math.cos((2 * Math.PI * (m - peakMonth)) / 12);
};
export function rescored(id: string, peak: number): number[] {
  const [cold, warm, hem, floor] = WATER[id];
  const best = Math.max(...Array.from({ length: 12 }, (_, i) => comfort(waterF(cold, warm, hem, i + 1))));
  return Array.from({ length: 12 }, (_, i) => {
    const rel = comfort(waterF(cold, warm, hem, i + 1)) / best;
    return Math.round(Math.max(floor, rel) * peak * 10) / 10;
  });
}

(async () => {
  const apply = process.argv.includes('--apply');
  const out = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { getListScoredPlaces } = await import('../src/lib/db/queries/places');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { parseSliderCurve } = await import('../src/lib/scoring/curve');
  const rows = await db.select().from(places);
  const scored: any[] = await getListScoredPlaces();
  const report: Array<{ id: string; name: string; before: number[]; after: number[] }> = [];
  const backup: Record<string, unknown> = {};
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  for (const id of Object.keys(WATER)) {
    const r = rows.find((x) => x.id === id); const p = scored.find((x) => x.id === id);
    if (!r || !p) throw new Error(`no place ${id}`);
    if ((r.naSliders ?? []).includes('beachesSwimming')) { console.log(`${id}: beaches off, skipped`); continue; }
    const before: number[] = p.monthly.beachesSwimming;
    const peak = Math.max(...before);
    const after = rescored(id, peak);
    const curve = parseSliderCurve({ anchors: after.map((value, i) => ({ month: i + 1, value, steepness: 1 })) });
    backup[id] = (r.sliderCurves as Record<string, unknown>).beachesSwimming ?? null;
    patches.push({ entityType: 'destination', entityId: id, field: 'sliderCurves', value: { ...(r.sliderCurves as Record<string, unknown>), beachesSwimming: curve }, loadedUpdatedAt: r.updatedAt.toISOString() });
    report.push({ id, name: r.name, before: before.map((v) => Math.round(v * 10) / 10), after });
  }
  for (const x of report) console.log(x.id.padEnd(24), 'before', x.before.map((v) => v.toFixed(1).padStart(4)).join(' '), '\n'.padEnd(26) + 'after ', x.after.map((v) => v.toFixed(1).padStart(4)).join(' '));
  if (out) writeFileSync(out, JSON.stringify(report));
  console.log(report.length, 'places');
  if (!apply) { console.log('dry run'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'beach-curves-temperate-2026-10-22.json'), JSON.stringify(backup, null, 1));
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
