// 9 Nov 2026: records the Wildlife Viewing and Birding fact check as dated notes on the interest pages (owner: only the corrected results and one dated note with the sources used; no per-sentence source rows).
// One whole-interest note per interest, plus one short note per corrected place. Safe to re-run: skips notes that already exist. Dry run unless --apply.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const BY = 'Claude (web source check, 9 Nov 2026)';
const WHOLE: Record<string, string> = {
  wineSpirits: `Fact check done 9 Nov 2026 on all 109 Gemini-written Wine, Beer & Spirits texts. Before the owner read them, Claude read every text twice and corrected the errors it found; the owner then reviewed all 109 texts and scores on 6 to 9 Nov 2026: she chose a restructured overview for 26 places, rewrote 15 texts herself, asked for rewrites of 8 more and set six peak scores. Sources used: Wikipedia entity lookups for about 2,860 names across the Food batch (regions, wine routes, festivals, drinks), and targeted web searches for festival dates, closures and seasons, plus three this week: Asahikawa's sake breweries (Hokkaido), Taipei's cocktail bars on the Asia's 50 Best Bars lists, and the history of Uzbek winemaking (Samarkand, 1868). On the owner's instruction the texts name no individual producers: 33 names were removed (for example Jameson, Penderyn, Marques de Riscal, the Hofbrauhaus), and eight places keep a name because it is the point of the entry (Barbados, Svalbard, Ireland, Hokkaido, Taiwan, Palau, Budapest and Venice). The places where Gemini scored a month more than 2 points below the peak were each checked; 59 seasonal-drop judgments across the four Food interests had no evidence either way and are flagged for later review.`,
};
const PLACE: Array<{ k: string; id: string; note: string }> = [
  { k: 'wineSpirits', id: 'hokkaido', note: 'Added after an owner question. Asahikawa has long-established sake breweries that run tours, so the overview now says so. Source: travel and brewery pages.' },
  { k: 'wineSpirits', id: 'taiwan', note: 'Rewritten after an owner question. Several Taipei bars appear on the Asia\'s 50 Best Bars lists (2023 to 2025), so the overview mentions the cocktail scene and the peak was raised from 3.7 to 5.6. Source: World\'s 50 Best Bars pages.' },
  { k: 'wineSpirits', id: 'uzbekistan', note: 'Rewritten from research after an owner comment. Modern Uzbek winemaking dates from 1868 in Samarkand; the Samarkand winery has a winemaking museum with tastings; Bukhara grows Rkatsiteli and Muscat, Samarkand Shirin and Gulyakandoz. Source: wine references and travel pages.' },
  { k: 'wineSpirits', id: 'nova-scotia', note: 'Corrected on 1 Nov. The text named the Devour! film festival twice in one sentence; it now names it once.' },
  { k: 'wineSpirits', id: 'napa', note: 'Corrected on 1 Nov after the source check: a sentence about a film festival was removed.' },
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
      const values = { interestKey: e.interestKey, placeId: e.placeId, reviewerName: BY, reviewerRole: 'AI: Claude', reviewedOn: '2026-11-09', notes: e.notes, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${e.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    }
  }
  console.log(`${apply ? 'logged' : 'would log'} ${n} notes`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
