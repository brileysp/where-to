// 30 Oct 2026: switches on the 43 place-interest pairs the owner ruled "Switch on" in the N/A review (batch A doubts list). For each pair this removes the N/A mark and
// its reason, sets the place's score for the interest (peak = base score), authors the 12-month curve from the best months in scripts/data/switch-on-spec.json, and
// records the source page in the place's sources. Scores and seasons are judged from the map counts and the page named; the columns are filled separately.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/switch-on-oct30.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type Spec = { k: string; pid: string; peak: number; best: number[]; floor: number; note: string; src: Array<{ url: string; label: string }> };
const RAMP_MONTHS = 3;
function monthly(s: Spec): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const d = Math.min(...s.best.map((b) => Math.min(Math.abs(m - b), 12 - Math.abs(m - b))));
    if (d === 0) return s.peak;
    const t = Math.min(1, d / RAMP_MONTHS) ** 0.8;
    return Math.round((s.peak - (s.peak - s.floor) * t) * 10) / 10;
  });
}
(async () => {
  const apply = process.argv.includes('--apply');
  const specs = JSON.parse(readFileSync(join(__dirname, 'data', 'switch-on-spec.json'), 'utf8')) as Spec[];
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const byPlace = new Map<string, Spec[]>();
  for (const s of specs) byPlace.set(s.pid, [...(byPlace.get(s.pid) ?? []), s]);
  let cells = 0;
  for (const [pid, list] of byPlace) {
    const [row] = await db.select().from(places).where(eq(places.id, pid));
    if (!row) { console.log('unknown place', pid); continue; }
    let na = [...row.naSliders], reasons = { ...((row.naReasons ?? {}) as Record<string, unknown>) };
    const base = { ...(row.baseScores as Record<string, number>) }, curves = { ...(row.sliderCurves as Record<string, unknown>) };
    const authored = new Set(row.authoredCurves ?? []);
    const sources = { ...((row.sliderSources ?? {}) as Record<string, Array<{ url: string; label?: string; note?: string; addedAt: string }>>) };
    for (const s of list) {
      if (!na.includes(s.k)) { console.log(`${pid}/${s.k}: not N/A, skipped`); continue; }
      const mv = monthly(s);
      const fit = fitMonthlyToCurve(mv, { maxSteepness: 4, errorTolerance: 0.5 });
      na = na.filter((k) => k !== s.k); delete reasons[s.k];
      base[s.k] = s.peak; curves[s.k] = fit.curve; authored.add(s.k);
      const at = new Date().toISOString().slice(0, 10);
      sources[s.k] = [...(sources[s.k] ?? []), ...s.src.map((x, i) => ({ url: x.url, label: x.label, note: i === 0 ? s.note : undefined, addedAt: at }))];
      console.log(`${s.k.padEnd(20)} ${pid.padEnd(26)} score ${s.peak}  [${mv.join(', ')}]`);
      cells++;
    }
    if (!apply) continue;
    const loaded = row.updatedAt.toISOString();
    const res = await applyAdminEdits([
      { entityType: 'destination', entityId: pid, field: 'naSliders', value: na, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: pid, field: 'naReasons', value: reasons, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: pid, field: 'baseScores', value: base, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: pid, field: 'sliderCurves', value: curves, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: pid, field: 'authoredCurves', value: [...authored], loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: pid, field: 'sliderSources', value: sources, loadedUpdatedAt: loaded },
    ], CLAUDE_ACTOR);
    if (res.errors.length || res.conflicts.length) console.log('PROBLEM', pid, JSON.stringify(res.errors), JSON.stringify(res.conflicts));
  }
  console.log(`${apply ? 'switched on' : 'would switch on'} ${cells} cells on ${byPlace.size} places`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
