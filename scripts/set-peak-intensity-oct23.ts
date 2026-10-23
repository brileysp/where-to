// 23 Oct 2026 (owner): sets every place's peak crowd intensity from the owner's own ranking of all 200 places (1 = most crowded at its peak), cut into
// extreme (1-25), high (26-52), moderate (53-127) and mild (128-200) once the fourth level 'high' was added the same day (the first run used extreme 1-52). The ranking is kept in scripts/data/crowd-intensity-ranking-oct23.json in case a finer scale is wanted later.
// Old values are saved to docs/backups. A DRY RUN unless --apply. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/set-peak-intensity-oct23.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'crowd-intensity-ranking-oct23.json'), 'utf8')) as Array<{ rank: number; id: string; tier: string }>;
  if (data.length !== 200) throw new Error(`expected 200 places, got ${data.length}`);
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = await db.select().from(places);
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const backup: Record<string, string | null> = {};
  for (const d of data) {
    const r = rows.find((x) => x.id === d.id);
    if (!r) throw new Error(`no place ${d.id}`);
    if (r.peakIntensity === d.tier) continue;
    backup[d.id] = r.peakIntensity ?? null;
    patches.push({ entityType: 'destination', entityId: d.id, field: 'peakIntensity', value: d.tier, loadedUpdatedAt: r.updatedAt.toISOString() });
  }
  console.log(patches.length, 'places change');
  if (!apply) { console.log('dry run'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'peak-intensity-2026-10-23-high.json'), JSON.stringify(backup, null, 1));
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
