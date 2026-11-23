// 4 Nov 2026: records the Wildlife Viewing and Birding fact check as dated notes on the interest pages (owner: only the corrected results and one dated note with the sources used; no per-sentence source rows).
// One whole-interest note per interest, plus one short note per corrected place. Safe to re-run: skips notes that already exist. Dry run unless --apply.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const BY = 'Claude (web source check, 4 Nov 2026)';
const WHOLE: Record<string, string> = {
  coffeeTea: `Fact check done 4 Nov 2026 on all 122 Gemini-written Specialty Coffee & Tea texts. Before the owner read them, Claude read every text twice and corrected the errors it found; the owner then reviewed all 122 texts and scores on 3-4 Nov 2026 and edited 31 of them. Sources used: Wikipedia entity lookups for about 2,860 names across the Food batch (regions, districts, estates, festivals, drinks) and targeted web searches for harvest and flush seasons, festival dates and seasonal closures: Hawaii tourism and festival listings (Kona Coffee Cultural Festival, early November), AAA and Charleston Tea Garden's own pages (harvest May to October, tours open all year), Jamaican estate and travel pages (harvest window disagrees between sources, mid-August to May with a peak October to January; the text uses September to March), Aspen Chamber and local dining guides (spring and fall closures), and tour operators for Fort Portal tea estates in Uganda. On the owner's instruction the texts name no individual businesses: 13 named roasters, farms, estates and shops were removed where the sentence read fine without them (for example Finca Argovia, Finca Hamburgo, Zealong, Tregothnan, Caffe Gilli, Caroma, Sabah Tea Garden, Bois Cheri). The places where Gemini scored a month more than 2 points below the peak were each checked; 59 seasonal-drop judgments across the four Food interests had no evidence either way and are flagged for later review.`,
};
const PLACE: Array<{ k: string; id: string; note: string }> = [
  { k: 'coffeeTea', id: 'big-island', note: 'Checked and kept. The Kona Coffee Cultural Festival is held in early November (2026: 6-15 November), tied to the harvest. Source: festival and Hawaii tourism listings.' },
  { k: 'coffeeTea', id: 'jamaica', note: 'Checked, partly kept. Sources disagree on the Blue Mountain harvest: mid-August to May at one estate, peak October to January elsewhere. The text keeps September to March as the active months. Source: estate and travel pages.' },
  { k: 'coffeeTea', id: 'charleston-savannah', note: "Checked and kept. On 1 Nov the claim that it is North America's only large-scale commercial tea farm was softened to 'a working commercial tea farm'. It harvests from May to October and keeps its tours open the rest of the year. The farm is no longer named, at the owner's request. Source: AAA and the farm's own pages." },
  { k: 'coffeeTea', id: 'aspen', note: 'Checked and kept. Aspen restaurants and cafes cut hours or close in the spring mud season (late April to May) and the fall shoulder season (October to November), some staying open for locals. Source: Aspen Chamber and local dining guides.' },
  { k: 'coffeeTea', id: 'uganda', note: 'Added after an owner question. Tea is grown around Fort Portal in the Rwenzori foothills and estates run tours with factory visits and tastings; the overview now says so. Source: tour-operator pages only, so the wording is general.' },
  { k: 'coffeeTea', id: 'puglia', note: 'Corrected on 1 Nov. The text described an espressino as a Puglia drink; it is a Turin drink, not a Puglia one, so the two sentences were removed.' },
  { k: 'coffeeTea', id: 'vancouver-island', note: 'Corrected on 1 Nov and again at review. Removed the filler line about the scene being active all year; the owner then trimmed the overview and the single blurb.' },
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
      const values = { interestKey: e.interestKey, placeId: e.placeId, reviewerName: BY, reviewerRole: 'AI: Claude', reviewedOn: '2026-11-04', notes: e.notes, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${e.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    }
  }
  console.log(`${apply ? 'logged' : 'would log'} ${n} notes`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
