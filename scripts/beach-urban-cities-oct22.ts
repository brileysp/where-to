// 22 Oct 2026: Beaches & Swimming now includes city beaches and urban swimming (owner, 22 Oct), so three inland cities with a real urban swimming
// scene get Beaches switched on: Paris (Paris Plages, the canal basins, the new Seine bathing sites), Berlin (lakes, the Badeschiff and the Spree;
// restored from the 22 Oct backup) and Vienna (Alte Donau and the Danube Island). A DRY RUN unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/beach-urban-cities-oct22.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type A = [number, number, number];
const NEW: Record<string, { why: string; anchors: A[] }> = {
  paris: { why: 'Paris Plages (mid-July to late August), the canal basins and the Seine bathing sites', anchors: [[1, 0.5, 1], [5, 1, 2], [6, 2, 2], [7, 3.5, 2], [8, 3.5, 1], [9, 1.5, 2], [10, 0.5, 2]] },
  vienna: { why: 'Alte Donau, the Danube Island and the river lidos', anchors: [[1, 0.5, 1], [5, 1.5, 2], [6, 3, 2], [7, 4, 1], [8, 4, 1], [9, 2, 2], [10, 0.5, 2]] },
};
const KEY = 'beachesSwimming';
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { parseSliderCurve } = await import('../src/lib/scoring/curve');
  const backup = JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'backups', 'beaches-inland-removed-2026-10-22.json'), 'utf8')) as Record<string, { overview: string | null; monthly: unknown; curve: unknown }>;
  const rows = await db.select().from(places);
  const by = new Map(rows.map((r) => [r.id, r]));
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const P = (r: (typeof rows)[number], field: string, value: unknown) => patches.push({ entityType: 'destination', entityId: r.id, field, value, loadedUpdatedAt: r.updatedAt.toISOString() });
  for (const id of ['paris', 'berlin', 'vienna']) {
    const r = by.get(id); if (!r) throw new Error(`no place ${id}`);
    if (!(r.naSliders ?? []).includes(KEY)) { console.log(`${id}: already on, skipped`); continue; }
    const reasons = { ...((r.naReasons as Record<string, unknown>) ?? {}) }; delete reasons[KEY];
    P(r, 'naSliders', (r.naSliders ?? []).filter((k) => k !== KEY));
    P(r, 'naReasons', reasons);
    if (id === 'berlin') {
      const b = backup.berlin;
      P(r, 'sliderCurves', { ...(r.sliderCurves as Record<string, unknown>), [KEY]: b.curve });
      P(r, 'sliderOverview', { ...((r.sliderOverview as Record<string, string>) ?? {}), [KEY]: b.overview });
      P(r, 'sliderMonthlyWeather', { ...((r.sliderMonthlyWeather as Record<string, unknown>) ?? {}), [KEY]: b.monthly });
      console.log('RESTORE berlin from the 22 Oct backup (curve, overview, monthly text)');
    } else {
      const e = NEW[id];
      P(r, 'sliderCurves', { ...(r.sliderCurves as Record<string, unknown>), [KEY]: parseSliderCurve({ anchors: e.anchors.map(([month, value, steepness]) => ({ month, value, steepness })) }) });
      console.log(`ADD ${id}: ${e.why}`);
    }
  }
  console.log(patches.length, 'patches');
  if (!apply) { console.log('dry run'); process.exit(0); }
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
