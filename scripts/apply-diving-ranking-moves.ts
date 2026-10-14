/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/apply-diving-ranking-moves.ts [--apply]
// Applies the diving ranking moves the owner approved on 12 Oct 2026. Each place's displayed monthly scores are scaled so the best
// month hits the new peak (equal months stay equal), the curve is refitted, and any month the curve cannot reproduce exactly is held
// by a score override. The old curves and overrides are saved first. Maldives and Galápagos: the 9.6 overrides put there by the 23 Sep
// decimalization pass on every 10 are removed from their best three months so a true 10 shows again.
import { readFileSync, writeFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const r1 = (x: number) => Math.round(x * 10) / 10;
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { scorePlace } = await import('../src/lib/db/queries/places');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const verdicts = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-brendansalant-pearce-Desktop-Claude-Code/7967b631-7de4-44fc-a69e-c242cec19f01/scratchpad/dive_verdicts.json', 'utf8')) as Record<string, [string, number | null, string]>;
  const SKIP = new Set(['borabora', 'maldives', 'galapagos', 'sicily', 'napa', 'tokyo-kyoto']); // rewrite, special fix, owner kept, owner kept, waiting on its N/A decision
  const target: Record<string, number> = {};
  for (const [id, [, t]] of Object.entries(verdicts)) if (t !== null && !SKIP.has(id)) target[id] = t;
  target.iceland = 6.9; target.sardinia = 7.2; target['upper-peninsula'] = 5.9;
  const rows = (await db.select().from(places)) as any[];
  const backup: Record<string, any> = {};
  const report: string[] = [];
  const special: Record<string, Record<number, number>> = { maldives: { 0: 9.5, 11: 9.7 }, galapagos: { 5: 9.5, 6: 9.7, 10: 9.6 } };
  const plan: Array<{ id: string; name: string; old: number[]; neu: number[]; curve: any; overrides: Record<string, number> }> = [];
  for (const row of rows) {
    const id = row.id;
    if (!(id in target) && !(id in special)) continue;
    const old: number[] = (scorePlace(row) as any).monthly.diving.map(r1);
    let neu: number[]; let curve: any = (row.sliderCurves as any).diving; let overrides: Record<string, number> = {};
    if (id in special) {
      // Keep the curve (it already holds the 10s); hold only the non-peak months with overrides.
      overrides = Object.fromEntries(Object.entries(special[id]).map(([k, v]) => [k, v]));
      const cv = parseSliderCurve(curve);
      neu = Array.from({ length: 12 }, (_, i) => (i in special[id] ? special[id][i] : r1(curveValue(i + 1, cv))));
    } else {
      const pk = Math.max(...old);
      const f = target[id] / pk;
      neu = old.map((x) => r1(x * f));
      const nowMax = Math.max(...neu);
      if (nowMax !== target[id]) neu = neu.map((x) => (x === nowMax ? target[id] : x));
      const fit = fitMonthlyToCurve(neu).curve;
      curve = fit;
      const cv = parseSliderCurve(fit);
      neu.forEach((v, i) => { if (Math.abs(r1(curveValue(i + 1, cv)) - v) > 0.04) overrides[String(i)] = v; });
    }
    plan.push({ id, name: row.name, old, neu, curve, overrides });
    backup[id] = { sliderCurve: (row.sliderCurves as any).diving, scoreOverrides: (row.scoreOverrides as any)?.diving ?? null };
    report.push(`${row.name.padEnd(36)} ${Math.max(...old).toFixed(1)} -> ${Math.max(...neu).toFixed(1)}   ${neu.join(' ')}`);
  }
  console.log(report.join('\n'));
  console.log(`\n${plan.length} places planned; ${Object.keys(target).length} targets, ${Object.keys(special).length} special`);
  const missing = Object.keys(target).filter((i) => !plan.find((p) => p.id === i));
  if (missing.length) console.log('NOT FOUND:', missing.join(', '));
  if (!apply) process.exit(0);
  writeFileSync('docs/backups/diving-ranking-moves-before-2026-10-12.json', JSON.stringify({ savedAt: new Date().toISOString(), note: 'diving curves and overrides before the 12 Oct 2026 ranking moves', places: backup }, null, 1));
  let bad = 0;
  for (const p of plan) {
    const [fresh] = await db.select().from(places).where(eq(places.id, p.id));
    const curves = { ...((fresh.sliderCurves as any) ?? {}), diving: p.curve };
    const allOv = { ...((fresh.scoreOverrides as any) ?? {}) };
    if (Object.keys(p.overrides).length) allOv.diving = p.overrides; else delete allOv.diving;
    const res = await applyAdminEdits([
      { entityType: 'destination', entityId: p.id, field: 'sliderCurves', value: curves, loadedUpdatedAt: fresh.updatedAt.toISOString() },
      { entityType: 'destination', entityId: p.id, field: 'scoreOverrides', value: allOv, loadedUpdatedAt: fresh.updatedAt.toISOString() },
    ], CLAUDE_ACTOR);
    if (res.errors.length || res.conflicts.length) { console.log('PROBLEM', p.id, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); bad++; continue; }
    const [after] = await db.select().from(places).where(eq(places.id, p.id));
    const shown: number[] = (scorePlace(after) as any).monthly.diving.map(r1);
    const off = shown.some((v, i) => Math.abs(v - p.neu[i]) > 0.05);
    if (off) { console.log('MISMATCH', p.id, shown.join(' '), 'wanted', p.neu.join(' ')); bad++; }
  }
  console.log(`applied; ${bad} problem(s)`);
  process.exit(0);
})();
