// 24 Oct 2026: puts back the older diving text, scores and hand-set tweaks for Marrakech & Atlas and Tokyo & Kyoto, which the gap fill marked
// not applicable for being "too far". Owner rule: a place close enough to the ocean to have a surf or beach score is close enough to be considered for diving;
// not applicable is fine for murky water or no diving, but not for being too far. Source: docs/backups/gap-fill-before-2026-10-24.json.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/restore-diving-oct24.ts [--apply]
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const IDS = ['morocco', 'tokyo-kyoto'];
(async () => {
  const apply = process.argv.includes('--apply');
  const backup = JSON.parse(readFileSync('docs/backups/gap-fill-before-2026-10-24.json', 'utf8')) as Record<string, any>;
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  for (const id of IDS) {
    const b = backup[`${id}:diving`];
    const [row] = (await db.select().from(places).where(eq(places.id, id))) as any[];
    const loaded = row.updatedAt.toISOString();
    const withDiving = <T,>(obj: Record<string, T> | null, v: T | undefined): Record<string, T> => (v === undefined ? { ...(obj ?? {}) } : { ...(obj ?? {}), diving: v });
    const { diving: _r, ...restReasons } = (row.naReasons ?? {}) as Record<string, unknown>;
    console.log(`${id}: restoring ${b.blurbs?.length ?? 0} blurbs, curve ${b.curve ? 'yes' : 'no'}, overrides ${b.overrides ? Object.keys(b.overrides).length : 0}`);
    if (!apply) continue;
    const patches = [
      { entityType: 'destination' as const, entityId: id, field: 'naSliders', value: (row.naSliders as string[]).filter((k) => k !== 'diving'), loadedUpdatedAt: loaded },
      { entityType: 'destination' as const, entityId: id, field: 'sliderCurves', value: withDiving(row.sliderCurves, b.curve), loadedUpdatedAt: loaded },
      { entityType: 'destination' as const, entityId: id, field: 'sliderOverview', value: withDiving(row.sliderOverview, b.overview), loadedUpdatedAt: loaded },
      { entityType: 'destination' as const, entityId: id, field: 'sliderMonthlyWeather', value: withDiving(row.sliderMonthlyWeather, b.blurbs), loadedUpdatedAt: loaded },
      { entityType: 'destination' as const, entityId: id, field: 'naReasons', value: restReasons, loadedUpdatedAt: loaded },
    ];
    if (b.overrides) patches.push({ entityType: 'destination' as const, entityId: id, field: 'scoreOverrides', value: withDiving(row.scoreOverrides, b.overrides), loadedUpdatedAt: loaded });
    const res = await applyAdminEdits(patches as never, CLAUDE_ACTOR);
    console.log(id, res.errors.length || res.conflicts.length ? `PROBLEM ${JSON.stringify(res.errors)} ${JSON.stringify(res.conflicts)}` : 'restored');
  }
  if (!apply) console.log('dry run');
  process.exit(0);
})();
