// 1 Nov 2026: the rank smell test for Museums & Art and Architecture found five cells whose saved flat-ish curves were being cut by place-level "seasonal hazards"
// (Beijing winter smog and spring dust, Chiang Mai burning season, Delhi/Agra smog), so Beijing museums showed 2.5 in January while its text says winter is a great time.
// The owner's rule for indoor and all-year interests (31 Oct 2026): heat, cold, smog and crowds alone do not lower the score; only real closures and reduced hours do.
// This removes museumsArt and architecture from the affected sliders of those hazards (the hazards stay for every other interest). Dry run unless --apply.
import { readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { places } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits'); const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply-actor');
  const KEYS = ['museumsArt', 'architecture'];
  const rows = await db.select().from(places); const backup: Record<string, unknown> = {}; let n = 0;
  for (const r of rows) {
    const hz = ((r as any).seasonalHazards ?? []) as Array<{ affectedSliders?: string[] }>;
    if (!hz.some((h) => (h.affectedSliders ?? []).some((s) => KEYS.includes(s)))) continue;
    backup[r.id] = hz;
    const next = hz.map((h) => ({ ...h, affectedSliders: (h.affectedSliders ?? []).filter((s) => !KEYS.includes(s)) }));
    console.log(r.id, hz.map((h) => (h.affectedSliders ?? []).join(',')).join(' | '), '->', next.map((h) => (h.affectedSliders ?? []).join(',')).join(' | '));
    if (apply) { const res = await applyAdminEdits([{ entityType: 'destination', entityId: r.id, field: 'seasonalHazards', value: next, loadedUpdatedAt: r.updatedAt.toISOString() }] as never, SYSTEM_ACTOR); if (res.errors.length || res.conflicts.length) console.log('PROBLEM', r.id, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); else n++; }
  }
  if (apply) writeFileSync(join(__dirname, '..', 'docs', 'backups', 'seasonal-hazards-before-indoor-fix-2026-11-01.json'), JSON.stringify(backup, null, 1));
  console.log(apply ? `saved ${n}` : 'dry run');
  process.exit(0);
})();
