// 24 Oct 2026: connects the approved chips of Street Food, Luxury Hotels and Road Cycling to their new columns and makes them live.
// A chip must be approved first; nothing unapproved is touched. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/connect-chips-oct24.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type Driver = { column: string; option?: string; fullAt?: number };
const MAP: Array<[string, string, Driver[]]> = [
  ['streetFood', 'night-markets', [{ column: 'nightMarkets' }]],
  ['streetFood', 'cooking-classes', [{ column: 'cookingClasses' }]],
  ['streetFood', 'fresh-produce-markets', [{ column: 'produceMarkets' }]],
  ['streetFood', 'street-stalls-and-hawker-centres', [{ column: 'streetStalls' }]],
  ['streetFood', 'food-tours', [{ column: 'foodTours' }]],
  ['luxuryHotels', 'boutique-hotels', [{ column: 'boutiqueHotels' }]],
  ['luxuryHotels', 'grand-and-historic-hotels', [{ column: 'grandHotels' }]],
  ['luxuryHotels', 'remote-luxury-lodges', [{ column: 'remoteLodges' }]],
  ['cyclingRoad', 'quiet-scenic-road-riding', [{ column: 'quietScenic' }]],
  ['cyclingRoad', 'gravel-and-dirt-roads', [{ column: 'gravel' }]],
  ['cyclingRoad', 'big-mountain-climbs', [{ column: 'iconicClimbs', fullAt: 5 }]],
  ['cyclingRoad', 'multi-day-touring', [{ column: 'multiDayTouring' }]],
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const { driverProblem } = await import('../src/lib/admin/interest-pages/chips');
  for (const [interestKey, chipKey, drivers] of MAP) {
    const defs = factDefsFor(interestKey);
    const where = and(eq(interestChips.interestKey, interestKey), eq(interestChips.chipKey, chipKey));
    const [cur] = await db.select().from(interestChips).where(where);
    if (!cur) throw new Error(`no chip ${interestKey}:${chipKey}`);
    if (!cur.approvedAt) { console.log(`${chipKey}: NOT approved, left alone`); continue; }
    const problem = driverProblem(drivers[0], defs);
    if (problem) throw new Error(`${chipKey}: ${problem}`);
    console.log(`${interestKey}/${chipKey}: ${cur.status} -> live, reads ${drivers.map((d) => d.column).join(', ')}`);
    if (!apply) continue;
    const next = { ...cur, drivers, needsColumn: '', status: 'live' as const, updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_chip', entityId: `${interestKey}:${chipKey}`, action: 'update', before: cur, after: next, write: (tx) => tx.update(interestChips).set({ drivers, needsColumn: '', status: 'live', updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() }).where(where).returning() });
  }
  if (!apply) console.log('dry run');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
