// 31 Oct 2026: fact-check corrections to the saved Museums & Art and Architecture texts (owner: "museums and architecture both need to be fact checked").
// Each fix replaces one exact sentence/phrase in the overview and the month texts of one cell (scripts/data/text-fixes-oct31.json: k, id, old, new).
// Also lowers the January-February score of Tasmania museums (the Mona Foma festival that lifted them ended in 2024) and the March score of Dubai museums
// (Art Dubai moved to April, and to May in 2026). Dry run unless --apply. Cells that are not saved yet are skipped (they are fixed in the results file instead).
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-text-fixes-oct31.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const tweakFile = process.argv.find((a) => a.startsWith('--tweaks='))?.slice(9);
const SCORE_TWEAKS: Array<{ k: string; id: string; set: Record<number, number> }> = tweakFile ? JSON.parse(readFileSync(join(__dirname, 'data', tweakFile), 'utf8')) : [
  { k: 'museumsArt', id: 'tasmania', set: { 1: 7.2, 2: 7.0 } },
  { k: 'museumsArt', id: 'dubai', set: { 3: 6.0, 4: 5.8 } },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const fixFile = process.argv.find((a) => a.startsWith('--fixes='))?.slice(8) ?? 'text-fixes-oct31.json';
  const fixes = JSON.parse(readFileSync(join(__dirname, 'data', fixFile), 'utf8')) as Array<{ k: string; id: string; old: string; new: string }>;
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply-actor');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const { scorePlace } = await import('../src/lib/db/queries/places');
  const cells = new Set(fixes.map((f) => `${f.k}|${f.id}`)); if (!process.argv.includes('--no-scores')) for (const t of SCORE_TWEAKS) cells.add(`${t.k}|${t.id}`);
  let changed = 0, skipped = 0, miss = 0;
  for (const key of cells) {
    const [k, id] = key.split('|');
    const [place] = await db.select().from(places).where(eq(places.id, id));
    const ov = ((place.sliderOverview as Record<string, string>) ?? {})[k];
    if (!ov) { skipped++; console.log('not saved yet, skipped:', key); continue; }
    let overview = ov; const months = [...(((place.sliderMonthlyWeather as Record<string, string[]>) ?? {})[k] ?? [])];
    for (const f of fixes.filter((x) => x.k === k && x.id === id)) {
      let n = 0;
      if (overview.includes(f.old)) { overview = overview.replace(f.old, f.new); n++; }
      for (let i = 0; i < months.length; i++) if (months[i].includes(f.old)) { months[i] = months[i].replace(f.old, f.new); n++; }
      if (!n) { miss++; console.log('  NOT FOUND:', key, f.old.slice(0, 60)); }
    }
    const loaded = place.updatedAt.toISOString();
    const patches: any[] = [
      { entityType: 'destination', entityId: id, field: 'sliderOverview', value: { ...(place.sliderOverview as Record<string, string>), [k]: overview }, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: id, field: 'sliderMonthlyWeather', value: { ...(place.sliderMonthlyWeather as Record<string, string[]>), [k]: months }, loadedUpdatedAt: loaded },
    ];
    const tw = process.argv.includes('--no-scores') ? undefined : SCORE_TWEAKS.find((t) => t.k === k && t.id === id);
    if (tw) {
      const sc: any = scorePlace(place as never); const cur: number[] = ((sc.monthly ?? sc.scores ?? {})[k] ?? []) as number[];
      const next = cur.map((v, i) => (tw.set[i + 1] !== undefined ? tw.set[i + 1] : Math.round(v * 10) / 10));
      const { curve } = fitMonthlyToCurve(next, { maxSteepness: 4, errorTolerance: 0.15 });
      const back = Array.from({ length: 12 }, (_, i) => curveValue(i + 1, parseSliderCurve(curve as never)));
      console.log(`  ${key} scores ${cur.map((v) => v.toFixed(1)).join(' ')} -> ${next.join(' ')} (fit error ${Math.max(...back.map((v, i) => Math.abs(v - next[i]))).toFixed(2)})`);
      patches.push({ entityType: 'destination', entityId: id, field: 'sliderCurves', value: { ...(place.sliderCurves as Record<string, unknown>), [k]: curve }, loadedUpdatedAt: loaded });
      patches.push({ entityType: 'destination', entityId: id, field: 'baseScores', value: { ...(place.baseScores as Record<string, number>), [k]: Math.max(...next) }, loadedUpdatedAt: loaded });
    }
    if (apply) {
      const res = await applyAdminEdits(patches as never, SYSTEM_ACTOR);
      if (res.errors.length || res.conflicts.length) console.log('PROBLEM', key, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); else changed++;
    } else changed++;
  }
  console.log(`${apply ? 'saved' : 'would change'} ${changed} cells; skipped (not saved yet) ${skipped}; fixes not found ${miss}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
