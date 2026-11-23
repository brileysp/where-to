// 9 Nov 2026: records the owner's reviews of the four Food and drink interests on the interest pages (they were only in the tracker and the review pages' notes).
// Each row says what was reviewed and when, taken from what happened in the review sessions. Safe to re-run: skips a review that already exists. Dry run unless --apply.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const BY = 'Riley Pearce';
const REVIEWS: Array<{ k: string; on: string; notes: string }> = [
  { k: 'fineDining', on: '2026-11-02', notes: 'Owner read all 185 texts and scores on the review page between 1 and 2 Nov 2026 and replaced 89 overviews with shorter ones, set five flat or peak scores and ruled on the 13 not-applicable switches (Bhutan and Zion & Bryce kept applicable). Rank checks done 2 Nov.' },
  { k: 'streetFood', on: '2026-11-03', notes: 'Owner read all 179 texts and scores between 2 and 3 Nov 2026, replaced 23 overviews and set seven peaks, then reviewed the 28 over-length places (13 remain over the maximum and are approved) and ruled on the 13 not-applicable switches (Great Barrier Reef kept applicable). Ten rank moves accepted 2 Nov.' },
  { k: 'coffeeTea', on: '2026-11-04', notes: 'Owner read all 122 texts and scores between 3 and 4 Nov 2026 and edited 31 of them (overview or blurb), asked for business names to be removed, and ruled on the five not-applicable switches (Amalfi kept applicable). Six rank moves accepted 4 Nov.' },
  { k: 'wineSpirits', on: '2026-11-09', notes: 'Owner read all 109 texts and scores between 6 and 9 Nov 2026: chose the restructured overview for 26 places, wrote 15 texts herself, asked for rewrites of 8 more and set six peak scores. Four of five rank moves accepted 9 Nov (Puglia declined).' },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { interestReviews } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write'); const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const have = new Set((await db.select().from(interestReviews).where(eq(interestReviews.reviewerName, BY))).filter((r) => !r.placeId).map((r) => r.interestKey));
  let n = 0;
  for (const r of REVIEWS) {
    if (have.has(r.k)) continue; n++; console.log(`${apply ? 'logging' : 'would log'} ${r.k} ${r.on}`);
    if (!apply) continue;
    const values = { interestKey: r.k, placeId: null as string | null, reviewerName: BY, reviewerRole: 'Owner', reviewedOn: r.on, notes: r.notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${r.k}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  console.log(`${apply ? 'logged' : 'would log'} ${n} reviews`); process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
