// Points each pilot chip (fine dining, coffee and tea, street food, shopping, nightlife, traditional crafts) at its new column and clears its "needs a new column" note, 17 Oct 2026.
// The chips stay drafts: they go live once the column has data. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/set-pilot-chip-drivers.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type D = { column: string; fullAt?: number };
const MAP: Record<string, Record<string, D>> = {
  fineDining: { 'Michelin-starred restaurants': { column: 'michelinRestaurants', fullAt: 8 }, "Tasting menus and chef's tables": { column: 'tastingMenus' }, 'Farm-to-table': { column: 'farmToTable' }, 'Dining with a view': { column: 'diningWithView' } },
  coffeeTea: { 'Coffee farms': { column: 'coffeeFarms' }, 'Specialty cafés and roasteries': { column: 'specialtyCafes' }, 'Tea plantations': { column: 'teaPlantations' }, 'Tea ceremonies and tea houses': { column: 'teaCeremonies' } },
  streetFood: { 'Night markets': { column: 'nightMarkets' }, 'Street stalls and hawker centres': { column: 'streetStalls' }, 'Food tours': { column: 'foodTours' }, 'Cooking classes': { column: 'cookingClasses' }, 'Fresh produce markets': { column: 'produceMarkets' } },
  shopping: { 'Markets and bazaars': { column: 'marketsBazaars' }, 'Luxury and designer': { column: 'luxuryShopping' }, 'Local crafts and souvenirs': { column: 'localCrafts' }, 'Outlets and bargains': { column: 'outletsBargains' } },
  nightlife: { 'Clubs and dancing': { column: 'clubs' }, 'Live music venues': { column: 'liveMusic' }, 'Cocktail and rooftop bars': { column: 'cocktailBars' }, 'LGBTQ+ scene': { column: 'lgbtqScene' }, 'Beach and island parties': { column: 'beachParties' } },
  traditionalCrafts: { 'Textiles and weaving': { column: 'textilesWeaving' }, 'Pottery and ceramics': { column: 'potteryCeramics' }, 'Hands-on workshops': { column: 'craftWorkshops' }, 'Carving and metalwork': { column: 'carvingMetalwork' } },
};
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const { driverProblem } = await import('../src/lib/admin/interest-pages/chips');
  let n = 0;
  for (const [interest, byLabel] of Object.entries(MAP)) {
    const defs = factDefsFor(interest);
    const chips = await db.select().from(interestChips).where(eq(interestChips.interestKey, interest));
    if (chips.length !== Object.keys(byLabel).length) throw new Error(`${interest}: ${chips.length} chips in the database, ${Object.keys(byLabel).length} mapped`);
    for (const c of chips) {
      const d = byLabel[c.label];
      if (!d) throw new Error(`${interest}: no mapping for "${c.label}"`);
      const problem = driverProblem(d, defs);
      if (problem) throw new Error(`${interest} ${c.label}: ${problem}`);
      if (apply) await db.update(interestChips).set({ drivers: [d], needsColumn: '', updatedBy: 'Claude (pilot columns, 17 Oct 2026)', updatedAt: new Date() }).where(and(eq(interestChips.interestKey, interest), eq(interestChips.chipKey, c.chipKey)));
      n++;
    }
  }
  console.log(`${apply ? 'updated' : 'would update'} ${n} chips`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
