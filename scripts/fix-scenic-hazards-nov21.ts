// 21 Nov 2026 (checklist 9.6): Scenic Landscapes is live, and its approved month scores and texts already include the hazards that matter for looking at a place, so a place-level
// seasonal hazard that names scenicLandscapes would subtract the same thing a second time (live Zion & Bryce Canyon July showed 2.9 against the approved 9.6, the Scottish Highlands
// summer 2.8 against 9.1 and Chiang Mai's burning season 1.1 against 3.7). This removes scenicLandscapes from the affected sliders of those flags (they stay for every other interest
// and stay listed as an audit trail). Backup written first. Dry run unless --apply.
import { readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits'); const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply-actor');
  const KEYS = ['scenicLandscapes'];
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const rows = (await getPrimaryPlaceRows()) as any[]; const backup: Record<string, unknown> = {}; let n = 0;
  for (const r of rows) {
    const hz = ((r as any).seasonalHazards ?? []) as Array<{ affectedSliders?: string[] }>;
    if (!hz.some((h) => (h.affectedSliders ?? []).some((s) => KEYS.includes(s)))) continue;
    backup[r.id] = hz;
    const next = hz.map((h) => ({ ...h, affectedSliders: (h.affectedSliders ?? []).filter((s) => !KEYS.includes(s)) }));
    console.log(r.id, hz.map((h) => (h.affectedSliders ?? []).join(',')).join(' | '), '->', next.map((h) => (h.affectedSliders ?? []).join(',')).join(' | '));
    if (apply) { const res = await applyAdminEdits([{ entityType: 'destination', entityId: r.id, field: 'seasonalHazards', value: next, loadedUpdatedAt: r.updatedAt.toISOString() }] as never, SYSTEM_ACTOR); if (res.errors.length || res.conflicts.length) console.log('PROBLEM', r.id, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); else n++; }
  }
  if (apply) writeFileSync(join(__dirname, '..', 'docs', 'backups', 'seasonal-hazards-before-scenic-fix-2026-11-21.json'), JSON.stringify(backup, null, 1));
  console.log(apply ? `saved ${n}` : 'dry run');
  process.exit(0);
})();
