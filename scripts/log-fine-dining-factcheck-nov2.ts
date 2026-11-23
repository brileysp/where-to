// 31 Oct 2026: records the Wildlife Viewing and Birding fact check as dated notes on the interest pages (owner: only the corrected results and one dated note with the sources used; no per-sentence source rows).
// One whole-interest note per interest, plus one short note per corrected place. Safe to re-run: skips notes that already exist. Dry run unless --apply.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const BY = 'Claude (web source check, 2 Nov 2026)';
const WHOLE: Record<string, string> = {
  fineDining: `Fact check done 2 Nov 2026 on all 185 Gemini-written Fine Dining texts. Before the owner read them, 14 sentences were corrected by hand and Claude read every text twice; a second reading pass then corrected 6 more places (below). Sources used: Wikipedia entity lookups for about 2,860 names across the Food batch (markets, districts, festivals, dishes, regions), and targeted web searches for closures, seasons and events: tourism boards, venue and resort listings, chambers of commerce, and local press. Across the four Food interests, the 157 places where Gemini scored a month more than 2 points below the peak (32 in Fine Dining) were each checked: closures were kept where listings confirmed them (Dolomites, Santorini, Amalfi, Skye, Aspen, Torres del Paine, Uluru's Tali Wiru dune dinner) and softened where evidence contradicted them (Cape Cod, Lofoten, Acadia, Rome in August). 59 seasonal-drop judgments across the four Food interests had no evidence either way and are flagged for later review. The owner reviewed all 185 texts and scores on 2 Nov 2026.`,
};
const PLACE: Array<{ k: string; id: string; note: string }> = [
  { k: 'fineDining', id: 'acadia', note: 'Corrected. The text said almost all chef-led restaurants close for winter; most Bar Harbor restaurants do, but some, including a fine-dining room, stay open, so the text and winter scores were softened. Source: Maine Office of Tourism and Bar Harbor listings.' },
  { k: 'fineDining', id: 'cape-cod-islands', note: 'Corrected. The text said the fine dining scene largely shuts down; the Cape Cod Chamber of Commerce says the mainland Cape does not close for winter and Provincetown restaurants take breaks of a few weeks, but Nantucket and Martha\'s Vineyard restaurants close in large numbers from January to March. Text and winter scores softened.' },
  { k: 'fineDining', id: 'lofoten', note: 'Corrected. The text said many kitchens close entirely in winter; Visit Lofoten says the main towns keep restaurants open and only smaller villages and lodges close or cut service. Text and winter scores softened.' },
  { k: 'fineDining', id: 'rome', note: 'Corrected. The text said many top kitchens close for several weeks in August; sources say local trattorias close for one to two weeks around Ferragosto while hotel and tourist-area dining stay open. August text and score softened.' },
  { k: 'fineDining', id: 'galapagos', note: 'Corrected. The spiny lobster season starts in late August or September, not July; July and August moved to the closed-season text. Source: Galapagos Conservancy season announcement.' },
  { k: 'fineDining', id: 'argentine-lake-district', note: 'Corrected. Morels are a spring (October to November) mushroom, not an April one; April now names pine mushrooms only. Corrected from general knowledge of the Patagonian foraging calendar; not searched.' },
  { k: 'fineDining', id: 'uluru', note: 'Checked and kept. The Sounds of Silence buffet dinner runs year-round, but the fine-dining dune dinner (Tali Wiru) runs about 1 April to mid-October only, so the summer closure in the text is right. Source: Ayers Rock Resort and Voyages listings.' },
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
