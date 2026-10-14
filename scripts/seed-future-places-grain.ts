/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/seed-future-places-grain.ts [--apply]
// Fills the Grain column on the Future places tabs (scripts/data/future-places-grain.json), on every list that has future places.
// Never overwrites a grain that is already set. Same place name on several lists gets the same rating.
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestPlaceIdeas } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const data = JSON.parse(readFileSync('scripts/data/future-places-grain.json', 'utf8')) as Record<string, [number, string]>;
  const rows = await db.select().from(interestPlaceIdeas);
  let n = 0, skipped = 0, missing = 0;
  for (const r of rows) {
    const d = data[r.name];
    if (!d) { missing++; console.log('no rating for', r.name); continue; }
    if (r.grain !== null) { skipped++; continue; }
    n++;
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: r.id, action: 'update', before: r, after: { ...r, grain: d[0], grainNote: d[1] }, write: (tx) => tx.update(interestPlaceIdeas).set({ grain: d[0], grainNote: d[1], updatedAt: new Date() }).where(eq(interestPlaceIdeas.id, r.id)).returning() });
  }
  console.log(`${apply ? 'rated' : 'would rate'} ${n} of ${rows.length}; ${skipped} already rated; ${missing} unmatched`);
  process.exit(0);
})();
