// 22 Oct 2026: leftovers found by the known truths (npm run truths).
//  - P04: 177 places still carried "spectatorSports" in their N/A list although the interest was folded into Festivals on 20 Oct.
//  - T04: two live texts used UK spelling ("colour-coded" in Paris mountaineering, "neighbouring" in Lofoten whale watching).
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fix-leftovers-oct22.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const rows = await db.select().from(places);
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  let flags = 0, spell = 0;
  for (const r of rows) {
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    if (r.naSliders.includes('spectatorSports')) { flags++; patches.push({ ...base, field: 'naSliders', value: r.naSliders.filter((k) => k !== 'spectatorSports') }); }
    const ov = { ...((r.sliderOverview as Record<string, string>) ?? {}) }; let changed = false;
    for (const [k, t] of Object.entries(ov)) {
      const f = t.replace(/\bcolour-coded\b/g, 'color-coded').replace(/\bneighbouring\b/g, 'neighboring');
      if (f !== t) { if (f.toLowerCase().replace(/color/g, 'colour').replace(/neighboring/g, 'neighbouring') !== t.toLowerCase()) throw new Error(`${r.id}/${k}: wording changed`); ov[k] = f; changed = true; spell++; console.log(`spelling: ${r.name} ${k}`); }
    }
    if (changed) patches.push({ ...base, field: 'sliderOverview', value: ov });
  }
  console.log(`${flags} places lose the removed N/A flag; ${spell} texts get US spelling; ${patches.length} edits`);
  if (!apply) { console.log('dry run'); process.exit(0); }
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  let saved = 0;
  for (let i = 0; i < patches.length; i += 25) {
    const res = await applyAdminEdits(patches.slice(i, i + 25), CLAUDE_ACTOR);
    saved += res.saved.length;
    if (res.errors.length || res.conflicts.length) console.log('PROBLEM', JSON.stringify(res.errors), JSON.stringify(res.conflicts));
  }
  console.log('saved', saved);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.stack ?? e.message); process.exit(1); });
