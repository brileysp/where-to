/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/store-surfing-na-reasons.ts [--apply]
// Stores the reasons in docs/surfing-clear-na.json on places.na_reasons.surfing for places that are already N/A for surfing and have no
// reason yet (never overwrites one), and adds a to-do for the places in docs/surfing-na-review.json. Dry run unless --apply.
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places, interestTodos } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply');
  const clear = JSON.parse(readFileSync('docs/surfing-clear-na.json', 'utf8')).ids as Record<string, string>;
  const review = JSON.parse(readFileSync('docs/surfing-na-review.json', 'utf8')).places as Record<string, string>;
  let written = 0, skipped = 0, curvesChanged = 0;
  for (const [id, reason] of Object.entries(clear)) {
    const [p] = await db.select().from(places).where(eq(places.id, id));
    if (!p) { console.log('missing place', id); continue; }
    if (!p.naSliders.includes('surfing')) { console.log('not N/A for surfing any more:', id); skipped++; continue; }
    const have = (p.naReasons as any) ?? {};
    if (have.surfing) { skipped++; continue; }
    written++;
    if (!apply) continue;
    const before = JSON.stringify(p.sliderCurves);
    const value = { ...have, surfing: { reason, source: 'imported', by: 'import from docs/surfing-clear-na.json', at: new Date().toISOString() } };
    const res = await applyAdminEdits([{ entityType: 'destination', entityId: id, field: 'naReasons', value, loadedUpdatedAt: p.updatedAt.toISOString() }], SYSTEM_ACTOR);
    if (res.errors.length || res.conflicts.length) console.log('PROBLEM', id, JSON.stringify(res.errors), JSON.stringify(res.conflicts));
    const [after] = await db.select().from(places).where(eq(places.id, id));
    if (JSON.stringify(after.sliderCurves) !== before) curvesChanged++;
  }
  console.log(`${apply ? 'stored' : 'would store'} ${written} reasons; ${skipped} skipped; ${apply ? `${curvesChanged} places whose curves changed` : ''}`);
  if (apply) {
    const names = new Map((await db.select({ id: places.id, name: places.name }).from(places)).map((r) => [r.id, r.name]));
    const title = `Send ${Object.keys(review).length} former N/A places to Gemini: they have a real surf scene`;
    const have = new Set((await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'surfing'))).map((t) => t.title));
    if (!have.has(title)) {
      const detail = Object.entries(review).map(([id, why]) => `${names.get(id) ?? id}: ${why}`).join('\n');
      await db.insert(interestTodos).values({ interestKey: 'surfing', source: 'Surfing N/A review, 11 Oct 2026', title, status: 'ready_for_claude', detail });
      console.log('to-do added');
    }
  }
  process.exit(0);
})();
