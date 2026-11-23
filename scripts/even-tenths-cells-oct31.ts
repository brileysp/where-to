// 31 Oct 2026 (owner approved the one-off in the Gemini plan): evens out the last digit of the month scores of the cells switched on and scored by hand on 31 Oct
// (the specs in scripts/data/switch-on-spec.json, switch-on-spec-oct31.json and switch-on-spec-score32-oct31.json). Owner rule: no more x.0 and x.5 than any other digit,
// no strings of the same round value. Uses the catalog even-tenths method on just these cells, refits each curve from the nudged months, sets the base score to the new peak.
// Months move by at most 0.3. Dry run unless --apply; --apply saves the old curves and base scores to docs/backups first.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/even-tenths-cells-oct31.ts [--apply]
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const r1 = (x: number) => Math.round(x * 10) / 10;
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { evenTenthsCatalog, countDigits } = await import('../src/lib/gemini/even-tenths');
  const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const specs: Array<{ k: string; pid: string }> = [];
  for (const f of ['switch-on-spec.json', 'switch-on-spec-oct31.json', 'switch-on-spec-score32-oct31.json']) specs.push(...JSON.parse(readFileSync(join(__dirname, 'data', f), 'utf8')));
  const rows = await db.select().from(places);
  const series: Record<string, number[]> = {};
  for (const s of specs) {
    const r = rows.find((x) => x.id === s.pid); const c = (r?.sliderCurves as Record<string, unknown> | undefined)?.[s.k];
    if (!r || !c || r.naSliders.includes(s.k)) continue;
    series[`${s.k}|${s.pid}`] = Array.from({ length: 12 }, (_, i) => r1(curveValue(i + 1, parseSliderCurve(c as never))));
  }
  const ids = Object.keys(series);
  const pct = (c: number[]) => { const n = c.reduce((a, b) => a + b, 0) || 1; return c.map((x) => String(Math.round((100 * x) / n)).padStart(2) + '%').join(' '); };
  const before = countDigits(Object.values(series));
  const target = evenTenthsCatalog(series, new Set(), { maxMove: 3 });
  const after = countDigits(Object.values(target));
  let changed = 0, big = 0, maxd = 0;
  for (const id of ids) { let ch = false; target[id].forEach((v, i) => { const d = Math.abs(v - series[id][i]); if (d > 0) { ch = true; maxd = Math.max(maxd, d); if (d > 0.31) big++; } }); if (ch) changed++; }
  console.log(`${ids.length} cells; digits .0 to .9 before: ${pct(before)}`);
  console.log(`                    after:  ${pct(after)}`);
  console.log(`${changed} cells would change, largest move ${maxd.toFixed(2)}, moves over 0.3: ${big}`);
  if (!apply) { console.log('dry run'); process.exit(0); }
  mkdirSync(join(__dirname, '..', 'docs', 'backups'), { recursive: true });
  const backup: Record<string, unknown> = {};
  let done = 0, problems = 0;
  for (const id of ids) {
    const [k, pid] = id.split('|');
    if (target[id].every((v, i) => v === series[id][i])) continue;
    const r = (await db.select().from(places).where(eq(places.id, pid)))[0];
    const fit = fitMonthlyToCurve(target[id], { maxSteepness: 4, errorTolerance: 0.5 });
    backup[id] = { baseScore: (r.baseScores as Record<string, number>)[k], curve: (r.sliderCurves as Record<string, unknown>)[k] };
    const base = { ...(r.baseScores as Record<string, number>), [k]: Math.max(...target[id]) };
    const curves = { ...(r.sliderCurves as Record<string, unknown>), [k]: fit.curve };
    const loaded = r.updatedAt.toISOString();
    const res = await applyAdminEdits([
      { entityType: 'destination', entityId: pid, field: 'baseScores', value: base, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: pid, field: 'sliderCurves', value: curves, loadedUpdatedAt: loaded },
    ], CLAUDE_ACTOR);
    if (res.errors.length || res.conflicts.length) { problems++; console.log('PROBLEM', id, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); } else done++;
  }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'switch-on-cells-before-even-tenths-2026-10-31.json'), JSON.stringify({ savedAt: new Date().toISOString(), cells: backup }));
  console.log(`wrote ${done} cells, ${problems} problems; backup saved`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
