// 22 Oct 2026 (owner): the Galapagos have a capped number of visitors and fairly flat prices, so a "peak season" there is not felt the way it is on the
// Amalfi Coast. Sets its peak intensity to mild (it was unset, which counted as moderate). Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/set-peak-intensity-oct22.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const [r] = await db.select().from(places).where(eq(places.id, 'galapagos'));
  console.log('galapagos peakIntensity now:', r.peakIntensity);
  if (!apply) { console.log('dry run'); process.exit(0); }
  const res = await applyAdminEdits([{ entityType: 'destination', entityId: 'galapagos', field: 'peakIntensity', value: 'mild', loadedUpdatedAt: r.updatedAt.toISOString() }], CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(0);
})();
