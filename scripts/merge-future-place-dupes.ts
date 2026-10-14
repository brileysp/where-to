/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/merge-future-place-dupes.ts [--apply]
// 12 Oct 2026 owner decision: merge the duplicate future places found while rating grain.
//  - Sabi Sands (wildlife list) is already inside the catalog place Kruger & Sabi Sands: removed.
//  - Gir National Park (wildlife) and "Gir: Asiatic lions" (safari) are one place: both now named Gir National Park.
//  - Southern Arizona (birding) merged into Southeast Arizona (birding).
//  - Wolong & Chengdu (wildlife) and Wolong & Balang Mountain (birding) are one reserve: both now named Wolong & Balang Mountain.
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestPlaceIdeas } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const find = async (interestKey: string, name: string) => (await db.select().from(interestPlaceIdeas).where(and(eq(interestPlaceIdeas.interestKey, interestKey), eq(interestPlaceIdeas.name, name))))[0] as any;
  const update = async (row: any, patch: Record<string, unknown>) => {
    console.log(`update [${row.interestKey}] ${row.name} ->`, JSON.stringify(Object.keys(patch)));
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: row.id, action: 'update', before: row, after: { ...row, ...patch }, write: (tx) => tx.update(interestPlaceIdeas).set({ ...patch, updatedAt: new Date() }).where(eq(interestPlaceIdeas.id, row.id)).returning() });
  };
  const remove = async (row: any) => {
    console.log(`delete [${row.interestKey}] ${row.name}`);
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: row.id, action: 'delete', before: row, after: null, write: (tx) => tx.delete(interestPlaceIdeas).where(eq(interestPlaceIdeas.id, row.id)).returning() });
  };
  const swapAlsoOn = (why: string, note: string) => (why.includes('↳') ? why.replace(/↳[^]*$/, `↳ ${note}`) : `${why} ↳ ${note}`);

  // Sabi Sands
  const sabi = await find('wildlifeViewing', 'Sabi Sands'); if (sabi) await remove(sabi);

  // Gir
  const girW = await find('wildlifeViewing', 'Gir National Park'); const girS = await find('safari', 'Gir: Asiatic lions');
  if (girS) await update(girS, { name: 'Gir National Park', why: swapAlsoOn(girS.why, 'Also on the wildlife-viewing list (same name): the same park, listed there for the lion conservation story.'), grainNote: 'One park, one decision.' });
  if (girW) await update(girW, { why: swapAlsoOn(girW.why, 'Also on the safari list (same name): the same park, listed there as the only lion safari outside Africa.'), grainNote: 'One park, one decision.' });

  // Arizona
  const se = await find('birding', 'Southeast Arizona'); const so = await find('birding', 'Southern Arizona');
  if (se) await update(se, { why: `${se.why} Also known for its trogons, which came from a duplicate "Southern Arizona" idea merged into this one.`.replace('(Established. From the Catalog Wishlist.) Also known', '(Established. From the Catalog Wishlist.) Also known'), grainNote: 'A loop of canyons and ranges in the southeast corner, one trip.' });
  if (so) await remove(so);

  // Wolong
  const woB = await find('birding', 'Wolong & Balang Mountain'); const woW = await find('wildlifeViewing', 'Wolong & Chengdu');
  if (woB) await update(woB, { nearestExisting: '', why: swapAlsoOn(woB.why, 'Also on the wildlife-viewing list (same name): giant pandas, a different flagship species in the same reserve.'), grainNote: 'One reserve and mountain pass, one trip. Chengdu is only the gateway.' });
  if (woW) await update(woW, { name: 'Wolong & Balang Mountain', nearestExisting: '', why: swapAlsoOn(woW.why, 'Also on the birding list (same name): pheasants and other gamebirds, a different flagship species in the same reserve.'), grainNote: 'One reserve and mountain pass, one trip. Chengdu is only the gateway.' });
  console.log(apply ? 'done' : 'dry run');
  process.exit(0);
})();
