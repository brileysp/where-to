// 22 Oct 2026 (owner): peak crowd intensity and seasonal price swing are their own columns for every place. Fills the price swing for all 200 places and the
// crowd intensity for the 67 that had none, from scripts/data/season-tiers-oct22.json (first drafts, for the owner to review in the places grid). Never
// overwrites a value that is already set. A DRY RUN unless --apply. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/set-season-tiers-oct22.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'season-tiers-oct22.json'), 'utf8')) as { price: Record<string, string>; crowd: Record<string, string> };
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = await db.select().from(places);
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  let price = 0, crowd = 0;
  for (const r of rows) {
    const at = r.updatedAt.toISOString();
    if (!r.priceSwing && data.price[r.id]) { patches.push({ entityType: 'destination', entityId: r.id, field: 'priceSwing', value: data.price[r.id], loadedUpdatedAt: at }); price++; }
    if (!r.peakIntensity && data.crowd[r.id]) { patches.push({ entityType: 'destination', entityId: r.id, field: 'peakIntensity', value: data.crowd[r.id], loadedUpdatedAt: at }); crowd++; }
  }
  console.log(`price swing for ${price} places, crowd intensity for ${crowd} places`);
  if (!apply) { console.log('dry run'); process.exit(0); }
  // One place at a time: two fields on one place share a loadedUpdatedAt, so apply the second set after the first.
  const first = patches.filter((p) => p.field === 'priceSwing');
  const r1 = await applyAdminEdits(first, CLAUDE_ACTOR);
  console.log('price swing saved', r1.saved.length, 'conflicts', r1.conflicts.length, 'errors', JSON.stringify(r1.errors));
  const fresh = new Map((await db.select({ id: places.id, u: places.updatedAt }).from(places)).map((r) => [r.id, r.u.toISOString()]));
  const second = patches.filter((p) => p.field === 'peakIntensity').map((p) => ({ ...p, loadedUpdatedAt: fresh.get(p.entityId)! }));
  const r2 = await applyAdminEdits(second, CLAUDE_ACTOR);
  console.log('crowd intensity saved', r2.saved.length, 'conflicts', r2.conflicts.length, 'errors', JSON.stringify(r2.errors));
  process.exit(0);
})();
