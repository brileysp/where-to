// 1 Nov 2026: applies the owner's rulings from the ranking smell test (artifact "Ranking Smell Test"): moves a place's peak for one interest to a new value.
// mode 'scale': every month is multiplied by new peak / old peak, so the curve keeps its shape. mode 'ten' (the few world-best 10s): the named best months are set to 10.0 and
// every other month is old x 0.97. The curve is refitted from the twelve numbers (same as the family saves) and the base score becomes the peak. Old curves and bases are
// written to docs/backups first. Dry run unless --apply.
// 13 Nov 2026: the moved scores are evened (each last digit .0-.9 about 10%, together with the scores already live) before they are fitted and saved; the approved peaks are protected and never move.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-rank-moves-nov1.ts --moves=rank-moves-museums-nov1.json [--apply]
import { existsSync, readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply'); const file = process.argv.find((a) => a.startsWith('--moves='))!.slice(8);
  const moves = JSON.parse(readFileSync(join(__dirname, 'data', file), 'utf8')) as Array<{ k: string; id: string; name: string; to: number; mode: 'scale' | 'ten'; tenMonths?: number[]; floor?: number }>;
  const { db } = await import('../src/lib/db/client'); const { places } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits'); const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply-actor');
  const { scorePlace } = await import('../src/lib/db/queries/places'); const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve'); const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const r1 = (v: number) => Math.round(v * 10) / 10; const backup: any[] = []; let saved = 0;
  const { balanceAgainstLive, describeDigits } = await import('../src/lib/gemini/even-tenths'); const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { liveSeries } = await import('../src/lib/authoring/live-series');
  const liveRows = (await getPrimaryPlaceRows()) as any[]; const evened = new Map<string, number[]>();
  { const pre: Record<string, Record<string, number[]>> = {};
    for (const m of moves) { const row = liveRows.find((x: any) => x.id === m.id); if (!row) continue; const cur: number[] = ((scorePlace(row as never) as any).monthly ?? {})[m.k]; if (!cur) continue; const peak = Math.max(...cur);
      let nx: number[]; if (m.mode === 'ten') nx = cur.map((v, i) => (m.tenMonths!.includes(i + 1) ? 10 : r1(v * 0.97))); else { const f = m.to / peak; nx = cur.map((v) => Math.min(10, r1(v * f))); const mx = Math.max(...nx); if (mx !== m.to) nx = nx.map((v) => (v === mx ? m.to : v)); }
      if (m.floor !== undefined) { const lo = Math.min(...nx), hi = Math.max(...nx); if (m.floor > lo && hi > lo) nx = nx.map((v) => r1(m.floor! + ((v - lo) * (hi - m.floor!)) / (hi - lo))); }
      (pre[m.k] ??= {})[m.id] = nx; }
    for (const [k, byId] of Object.entries(pre)) { const bal = balanceAgainstLive(byId, liveSeries(liveRows, k, new Set(Object.keys(byId))), { maxMove: 3, protectPeak: true }); console.log(`${k}: ${describeDigits(bal.combinedAfter)}`); for (const [id, v] of Object.entries(bal.series)) evened.set(`${k}|${id}`, v); } }
  for (const m of moves) {
    const [row] = await db.select().from(places).where(eq(places.id, m.id)); if (!row) { console.log('NO PLACE', m.id); continue; }
    const sc: any = scorePlace(row as never); const cur: number[] = (sc.scores ?? sc.monthly ?? {})[m.k]; const peak = Math.max(...cur);
    let next: number[];
    if (m.mode === 'ten') next = cur.map((v, i) => (m.tenMonths!.includes(i + 1) ? 10 : r1(v * 0.97)));
    else { const f = m.to / peak; next = cur.map((v) => Math.min(10, r1(v * f))); const mx = Math.max(...next); if (mx !== m.to) next = next.map((v) => (v === mx ? m.to : v)); }
    if (m.floor !== undefined) { const lo = Math.min(...next), hi = Math.max(...next); if (m.floor > lo && hi > lo) next = next.map((v) => r1(m.floor! + ((v - lo) * (hi - m.floor!)) / (hi - lo))); } // 2 Nov 2026: optional floor keeps the lowest month at a set value (curve compressed to fit)
    next = evened.get(`${m.k}|${m.id}`) ?? next;
    const { curve } = fitMonthlyToCurve(next, { maxSteepness: 4, errorTolerance: 0.15 });
    const back = Array.from({ length: 12 }, (_, i) => curveValue(i + 1, parseSliderCurve(curve as never))); const err = Math.max(...back.map((v, i) => Math.abs(v - next[i])));
    console.log(`${m.k.slice(0, 4)} ${m.name.padEnd(30)} ${peak.toFixed(1)} -> ${Math.max(...next).toFixed(1)}  low ${Math.min(...cur).toFixed(1)} -> ${Math.min(...next).toFixed(1)}  fit ${err.toFixed(2)}`);
    backup.push({ k: m.k, id: m.id, before: cur.map(r1), curve: (row.sliderCurves as any)?.[m.k], base: (row.baseScores as any)?.[m.k] });
    if (apply) {
      const loaded = row.updatedAt.toISOString();
      const res = await applyAdminEdits([
        { entityType: 'destination', entityId: m.id, field: 'sliderCurves', value: { ...(row.sliderCurves as Record<string, unknown>), [m.k]: curve }, loadedUpdatedAt: loaded },
        { entityType: 'destination', entityId: m.id, field: 'baseScores', value: { ...(row.baseScores as Record<string, number>), [m.k]: Math.max(...next) }, loadedUpdatedAt: loaded },
      ] as never, SYSTEM_ACTOR);
      if (res.errors.length || res.conflicts.length) console.log('PROBLEM', m.id, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); else saved++;
    }
  }
  if (apply) writeFileSync(join(__dirname, '..', 'docs', 'backups', file.replace('.json', '') + '-before.json'), JSON.stringify(backup));
  // keep scripts/data/finish/<interest>/proposals.json in step with the app (scale moves only), so finish-interest.ts does not see these peaks as unsaved
  if (apply) for (const k of new Set(moves.map((m) => m.k))) {
    const fp = join(__dirname, 'data', 'finish', k, 'proposals.json'); if (!existsSync(fp)) continue;
    const doc = JSON.parse(readFileSync(fp, 'utf8')) as { cells: any[] }; let changed = 0;
    for (const m of moves.filter((x) => x.k === k && x.mode === 'scale')) { const c = doc.cells.find((x) => x.k === k && x.id === m.id); if (!c) continue; const f = m.to / Math.max(...c.proposed); let next: number[] = c.proposed.map((v: number) => Math.min(10, r1(v * f))); const mx = Math.max(...next); if (mx !== m.to) next = next.map((v) => (v === mx ? m.to : v)); c.proposed = next; changed++; }
    writeFileSync(fp, JSON.stringify(doc)); console.log(`${k}: updated ${changed} score sets in scripts/data/finish/${k}/proposals.json`);
  }
  console.log(apply ? `saved ${saved} of ${moves.length}` : 'dry run');
  process.exit(0);
})();
