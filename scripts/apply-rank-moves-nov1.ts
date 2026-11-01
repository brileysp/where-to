// 1 Nov 2026: applies the owner's rulings from the ranking smell test (artifact "Ranking Smell Test"): moves a place's peak for one interest to a new value.
// mode 'scale': every month is multiplied by new peak / old peak, so the curve keeps its shape. mode 'ten' (the few world-best 10s): the named best months are set to 10.0 and
// every other month is old x 0.97. The curve is refitted from the twelve numbers (same as the family saves) and the base score becomes the peak. Old curves and bases are
// written to docs/backups first. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-rank-moves-nov1.ts --moves=rank-moves-museums-nov1.json [--apply]
import { readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply'); const file = process.argv.find((a) => a.startsWith('--moves='))!.slice(8);
  const moves = JSON.parse(readFileSync(join(__dirname, 'data', file), 'utf8')) as Array<{ k: string; id: string; name: string; to: number; mode: 'scale' | 'ten'; tenMonths?: number[] }>;
  const { db } = await import('../src/lib/db/client'); const { places } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits'); const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply-actor');
  const { scorePlace } = await import('../src/lib/db/queries/places'); const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve'); const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const r1 = (v: number) => Math.round(v * 10) / 10; const backup: any[] = []; let saved = 0;
  for (const m of moves) {
    const [row] = await db.select().from(places).where(eq(places.id, m.id)); if (!row) { console.log('NO PLACE', m.id); continue; }
    const sc: any = scorePlace(row as never); const cur: number[] = (sc.scores ?? sc.monthly ?? {})[m.k]; const peak = Math.max(...cur);
    let next: number[];
    if (m.mode === 'ten') next = cur.map((v, i) => (m.tenMonths!.includes(i + 1) ? 10 : r1(v * 0.97)));
    else { const f = m.to / peak; next = cur.map((v) => Math.min(10, r1(v * f))); const mx = Math.max(...next); if (mx !== m.to) next = next.map((v) => (v === mx ? m.to : v)); }
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
  console.log(apply ? `saved ${saved} of ${moves.length}` : 'dry run');
  process.exit(0);
})();
