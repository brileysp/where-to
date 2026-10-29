// 26 Oct 2026: owner approved marking Northern Tanzania not applicable for All-inclusive Resorts (a safari lodge stay fails the approved definition,
// docs/all-inclusive-definition.md). Keeps a backup of what was cleared. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/mark-tanzania-allinclusive-na-oct26.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const ID = 'tanzania', KEY = 'allInclusive';
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const [row] = (await db.select().from(places).where(eq(places.id, ID))) as any[];
  const loaded = row.updatedAt.toISOString();
  const drop = <T,>(obj: Record<string, T> | null) => { const { [KEY]: _x, ...rest } = (obj ?? {}) as Record<string, T>; return rest; };
  if (apply) writeFileSync('docs/backups/tanzania-allinclusive-before-na-2026-10-26.json', JSON.stringify({ curve: row.sliderCurves?.[KEY] ?? null, overview: row.sliderOverview?.[KEY] ?? null, monthly: row.sliderMonthlyWeather?.[KEY] ?? null, overrides: row.scoreOverrides?.[KEY] ?? null, authored: (row.authoredCurves ?? []).includes(KEY) }, null, 1));
  const reason = { reason: 'Northern Tanzania\'s stays are safari lodges. They are priced all-inclusive, but the property does not fill the days: the stay is the game drives, so it fails the all-inclusive test.', source: 'manual' as const, by: CLAUDE_ACTOR.email, at: new Date().toISOString() };
  console.log(`${ID}: clearing ${KEY} curve ${row.sliderCurves?.[KEY] ? 'yes' : 'no'}, marking not applicable`);
  if (!apply) { console.log('dry run'); process.exit(0); }
  const patches = [
    { entityType: 'destination' as const, entityId: ID, field: 'naSliders', value: Array.from(new Set([...(row.naSliders as string[]), KEY])), loadedUpdatedAt: loaded },
    { entityType: 'destination' as const, entityId: ID, field: 'sliderCurves', value: drop(row.sliderCurves), loadedUpdatedAt: loaded },
    { entityType: 'destination' as const, entityId: ID, field: 'naReasons', value: { ...(row.naReasons ?? {}), [KEY]: reason }, loadedUpdatedAt: loaded },
  ];
  const res = await applyAdminEdits(patches as never, CLAUDE_ACTOR);
  console.log(res.errors.length || res.conflicts.length ? `PROBLEM ${JSON.stringify(res.errors)} ${JSON.stringify(res.conflicts)}` : 'done');
  process.exit(0);
})();
