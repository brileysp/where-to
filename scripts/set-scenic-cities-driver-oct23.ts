// 23 Oct 2026: connects the Cities & villages chip to its column but leaves it a draft (five chips can be live at once and Landscape photography took the fifth slot).
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/set-scenic-cities-driver-oct23.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestChips } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const where = and(eq(interestChips.interestKey, 'scenicLandscapes'), eq(interestChips.chipKey, 'cities'));
  const [cur] = await db.select().from(interestChips).where(where);
  const drivers = [{ column: 'citiesRating' }];
  await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_chip', entityId: 'scenicLandscapes:cities', action: 'update', before: cur, after: { ...cur, drivers, needsColumn: '' }, write: (tx) => tx.update(interestChips).set({ drivers, needsColumn: '', updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() }).where(where).returning() });
  console.log('cities chip now reads citiesRating, still a draft');
  process.exit(0);
})();
