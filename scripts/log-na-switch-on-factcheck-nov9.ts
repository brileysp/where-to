// 9 Nov 2026: one short dated fact-check note per newly switched-on place (owner: records stay light; no per-sentence source rows).
// Safe to re-run: skips places that already have a note from this checker. Dry run unless --apply. Add the three Costa Rica / Ethiopia / Great Smoky Mountains notes to PLACE after the owner has read them.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const BY = 'Claude (web source check, switched-on places, 9 Nov 2026)';
const PLACE: Array<{ k: string; id: string; note: string }> = [
  { k: 'wineSpirits', id: 'belfast-giants-causeway', note: 'Switched on 9 Nov 2026 at the owner\'s request; Gemini wrote the text. One distillery on the Causeway Coast (not several), so the winter blurb was corrected. Bushmills named on purpose (the town and the distillery share the name). Owner rewrote the overview.' },
  { k: 'wineSpirits', id: 'guatemala', note: 'Switched on 9 Nov 2026. Removed Gemini\'s protected-designation claim for the rum and the Quetzaltenango tasting rooms (no source found), the Zone 4 taprooms, the chicha and a brand name. Antigua craft breweries and the aged-rum reputation confirmed. Owner rewrote the overview.' },
  { k: 'wineSpirits', id: 'havana', note: 'Switched on 9 Nov 2026. Rum tours in Havana and Santiago de Cuba and the domestic light lagers confirmed; wording only. Owner rewrote the overview.' },
  { k: 'wineSpirits', id: 'iceland', note: 'Switched on 9 Nov 2026. Removed the rhubarb wine (no commercial producer found) and the Westfjords breweries (none found); farm breweries, Brennivín, arctic-thyme gin and Beer Day (1 March 1989) confirmed. Owner rewrote the overview.' },
  { k: 'wineSpirits', id: 'jamaica', note: 'Switched on 9 Nov 2026. Rum estate tours confirmed. Red Stripe named on purpose (the beer is the point). Sorrel described as often spiked with rum.' },
  { k: 'wineSpirits', id: 'puerto-rico', note: 'Switched on 9 Nov 2026. Rum distillery tours, pitorro and the piña colada\'s San Juan origin confirmed; wording only.' },
  { k: 'wineSpirits', id: 'punta-cana', note: 'Switched on 9 Nov 2026. Brugal (Puerto Plata) and Barceló (San Pedro de Macorís) tours and mamajuana confirmed. Removed the Santo Domingo craft breweries (none found). Owner rewrote the overview.' },
  { k: 'wineSpirits', id: 'costa-rica', note: 'Switched on 9 Nov 2026. Coyol (fermented palm sap, dry season roughly December to April, sold at roadside stands in Guanacaste) confirmed; December moved into the dry-season group. Owner rewrote the overview.' },
  { k: 'wineSpirits', id: 'ethiopia', note: 'Switched on 9 Nov 2026. Tej houses and the berele flask confirmed. Removed Gemini\'s Addis Ababa brewery tours (no source found); the Rift Valley winery near Ziway runs tours by appointment. Owner rewrote the overview.' },
  { k: 'wineSpirits', id: 'great-smoky-mountains', note: 'Switched on 9 Nov 2026. Rocky Top Wine Trail (Sevier County, muscadine its signature) and the legal moonshine distilleries in Gatlinburg and Pigeon Forge confirmed; Sevier County is on the Tennessee Whiskey Trail.' },
  { k: 'coffeeTea', id: 'azores', note: 'Switched on 9 Nov 2026. Europe\'s only commercial tea plantations (São Miguel, harvest April to September) and the Fajã dos Vimes coffee on São Jorge confirmed. Removed the claim that the coffee is harvested in summer (no source gives picking months).' },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { interestReviews } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write'); const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const have = new Set((await db.select().from(interestReviews).where(eq(interestReviews.reviewerName, BY))).map((e) => `${e.interestKey}|${e.placeId ?? ''}`));
  let n = 0;
  for (const p of PLACE) {
    if (have.has(`${p.k}|${p.id}`)) continue; n++;
    if (apply) { const values = { interestKey: p.k, placeId: p.id, reviewerName: BY, reviewerRole: 'AI: Claude', reviewedOn: '2026-11-09', notes: p.note, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${p.k}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() }); }
  }
  console.log(`${apply ? 'logged' : 'would log'} ${n} notes`); process.exit(0);
})();
