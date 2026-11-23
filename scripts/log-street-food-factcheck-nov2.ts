// 31 Oct 2026: records the Wildlife Viewing and Birding fact check as dated notes on the interest pages (owner: only the corrected results and one dated note with the sources used; no per-sentence source rows).
// One whole-interest note per interest, plus one short note per corrected place. Safe to re-run: skips notes that already exist. Dry run unless --apply.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const BY = 'Claude (web source check, 2 Nov 2026)';
const WHOLE: Record<string, string> = {
  streetFood: `Fact check done 2 Nov 2026 on all 179 Gemini-written Street Food & Markets texts. Before the owner read them, Claude read every text twice and corrected the errors it found (below); the owner then reviewed all 179 texts and scores on 2 Nov 2026. Sources used: Wikipedia entity lookups for about 2,860 names across the Food batch (markets, districts, festivals, dishes, regions), and targeted web searches for market seasons, closures and events: city and tourism pages, market organizers' pages, local press (La Nacion for the Bariloche food carts). The places where Gemini scored a month more than 2 points below the peak were each checked: market and shack seasons were kept where listings confirmed them (Aspen Saturday Market, the Moab, Banff and Jasper markets, Cape Cod seafood shacks, Los Cabos organic markets, Leh's tourist eateries) and softened where evidence was thin. 59 seasonal-drop judgments across the four Food interests had no evidence either way and are flagged for later review.`,
};
const PLACE: Array<{ k: string; id: string; note: string }> = [
  { k: 'streetFood', id: 'arches-canyonlands', note: 'Corrected. The text put the Moab Farmers Market on Thursday evenings; sources list it as a seasonal Saturday-morning market, May to October. Source: Moab Sun News and market directory listings.' },
  { k: 'streetFood', id: 'argentine-lake-district', note: 'Rewritten after an owner question. Bariloche has licensed food carts and trucks at lakeshores, viewpoints and trailheads (the Costanera, the Circuito Chico, Cerro Catedral); the text now says so, without counts or named carts, and no longer credits San Martin de los Andes. Source: La Nacion, January 2020 and February 2021. Only Bariloche was verified.' },
  { k: 'streetFood', id: 'aspen', note: 'Checked and kept. The Aspen Saturday Market runs about the first Saturday of June to early October (2025: 7 June to 4 October), so the winter closure is right. Source: City of Aspen.' },
  { k: 'streetFood', id: 'banff', note: 'Checked and kept. The Banff market runs mid-spring to 30 September and the Jasper market mid-June to mid-September, both weekly in summer only. Source: Travel Alberta listings.' },
  { k: 'streetFood', id: 'cape-cod-islands', note: 'Checked, partly kept. Cape clam shacks such as Seafood Shanty and Jim\'s Clam Shack close shortly after Columbus Day, but some places on the Cape stay open all year, so the winter drop was cut back. Sources: shack listings and press coverage.' },
  { k: 'streetFood', id: 'faroe-islands', note: 'Checked, partly kept. Torshavn\'s monthly local-food market is listed through winter, but harbor kiosks and food trucks are sparse then. Source: Visit Faroe Islands events listings.' },
  { k: 'streetFood', id: 'ladakh', note: 'Checked, partly kept. Most tourist eateries and cafes in Leh run May to October and close November to April; a few local eateries stay open. Source: travel guides to Leh.' },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const reportUrl = process.argv.find((a) => a.startsWith('--report='))?.slice(9) ?? '';
  const { db } = await import('../src/lib/db/client');
  const { interestReviews } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const existing = await db.select().from(interestReviews).where(eq(interestReviews.reviewerName, BY));
  const have = new Set(existing.map((e) => `${e.interestKey}|${e.placeId ?? ''}`));
  const entries = [
    ...Object.entries(WHOLE).map(([k, notes]) => ({ interestKey: k, placeId: null as string | null, notes })),
    ...PLACE.map((p) => ({ interestKey: p.k, placeId: p.id as string | null, notes: p.note })),
  ];
  let n = 0;
  for (const e of entries) {
    if (have.has(`${e.interestKey}|${e.placeId ?? ''}`)) continue;
    n++;
    if (apply) {
      const values = { interestKey: e.interestKey, placeId: e.placeId, reviewerName: BY, reviewerRole: 'AI: Claude', reviewedOn: '2026-11-02', notes: e.notes, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${e.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    }
  }
  console.log(`${apply ? 'logged' : 'would log'} ${n} notes`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
