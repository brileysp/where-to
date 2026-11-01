// 31 Oct 2026: records the Wildlife Viewing and Birding fact check as dated notes on the interest pages (owner: only the corrected results and one dated note with the sources used; no per-sentence source rows).
// One whole-interest note per interest, plus one short note per corrected place. Safe to re-run: skips notes that already exist. Dry run unless --apply.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const BY = 'Claude (web source check, 31 Oct 2026)';
const REPORT = 'REPORT_URL';
const WHOLE: Record<string, string> = {
  wildlifeViewing: `Fact check done 31 Oct 2026 on all 200 Gemini-written Wildlife Viewing texts. 13 were wrong or out of date and were corrected (see the place notes below). Sources used: GBIF occurrence records (about 1,500 animal names checked for presence in each place's area and in the month claimed), Wikipedia (named parks, reserves and sites; all exist), national park, tourism board and wildlife authority pages, and news reports for closures, seasons and permits. Checked: species present in the area and month, named sites, closures and seasons, permits, superlatives and numbers. Not checked individually: general weather and crowd wording, and sentences about animal groups ("dolphins", "warblers") that cannot be tied to one species. Full report: ${REPORT}`,
  birding: `Fact check done 31 Oct 2026 on all 200 Gemini-written Birding texts. 7 were wrong or out of date and were corrected (see the place notes below). Sources used: GBIF occurrence records, which include eBird (about 1,500 bird and animal names checked for presence in each place's area and in the month claimed), Wikipedia (named parks, reserves and sites; all exist), national park, tourism board and wildlife authority pages, and news reports for closures, seasons and permits. Checked: species present in the area and month, named sites, closures and seasons, permits, superlatives and numbers. Not checked individually: general weather wording, and sentences about bird groups ("warblers", "shorebirds") that cannot be tied to one species. Full report: ${REPORT}`,
};
const PLACE: Array<{ k: string; id: string; note: string }> = [
  { k: 'wildlifeViewing', id: 'costa-rica', note: 'Corrected. The text called the Osa the best place in the world for Baird\'s tapir; sources say it is one of the best, with sightings not guaranteed. https://www.mammalwatching.com/2019/02/05/i-search-places-for-bairds-tapir-in-costa-rica/' },
  { k: 'wildlifeViewing', id: 'pantanal', note: 'Corrected. Jaguar encounter rates were given as above 95%; operators report above 90% in the dry season, and these are operator claims. https://www.lorenzoexpeditions.com/search-of-jaguars-in-brazil-pocone-and-porto-jofre-the-best-routes-for-sightings' },
  { k: 'wildlifeViewing', id: 'nepal', note: 'Corrected. Chitwan closes jeep safaris for the monsoon (about 1 July to mid or late September); no source for Bardia, so it was removed from the sentence. https://kathmandupost.com/national/2026/07/01/jeep-safari-inside-chitwan-national-park-suspended-for-monsoon-season' },
  { k: 'wildlifeViewing', id: 'tierra-del-fuego', note: 'Softened. Records show humpbacks in the Beagle Channel mostly January to March, so November now says "sometimes seen". Source: GBIF occurrence records.' },
  { k: 'wildlifeViewing', id: 'vienna', note: 'Corrected. Lainzer Tiergarten reopens in early February, not March; February and March text changed and the February score raised from 1.4 to 2.8. https://www.vienna.at/der-lainzer-tiergarten-ist-wieder-offen/3156167' },
  { k: 'wildlifeViewing', id: 'kerala', note: 'Corrected. Eravikulam reopens on 1 April after the February to March calving closure, not "late April". https://www.outlooktraveller.com/News/eravikulam-national-park-in-kerala-to-reopen' },
  { k: 'wildlifeViewing', id: 'fjords', note: 'Corrected. Dovrefjell is Europe\'s main wild musk ox herd outside the Arctic, but a small herd also lives in Sweden. https://www.lifeinnorway.net/musk-ox-facts/' },
  { k: 'wildlifeViewing', id: 'srilanka', note: 'Corrected. The annual Yala closure covers the busiest blocks (1 and 2), 14 September to 15 October in 2026, not the whole park. https://newsfirst.lk/2026/09/07/yala-national-park-blocks-1-and-2-to-close-temporarily-from-september-14' },
  { k: 'wildlifeViewing', id: 'iceland', note: 'Corrected. Hornstrandir is the best, not the only, place to see Arctic foxes in Iceland. https://guidetoiceland.is/nature-info/where-to-find-arctic-foxes-in-iceland' },
  { k: 'wildlifeViewing', id: 'madagascar', note: 'Corrected. Tsingy de Bemaraha reopens in late April or May, not early April; April text changed and the April score lowered from 7.8 to 6.2. https://www.madamagazine.com/en/deutsch-tsingy-de-bemaraha' },
  { k: 'wildlifeViewing', id: 'maui', note: 'Corrected. Humpbacks only start arriving in late November (about 240 records in November against about 2,800 in December); the main season starts in December. Source: GBIF occurrence records.' },
  { k: 'wildlifeViewing', id: 'north-cascades', note: 'Corrected. The highway usually closes in mid-November and reopens between mid-April and early May, so it is not closed all through April; April score raised from 0.6 to 1.0. https://wsdot.wa.gov/about/news/2025/sr-20-north-cascades-highway-closes-season-thursday-dec-4-6-pm' },
  { k: 'wildlifeViewing', id: 'jamaica', note: 'Removed an unsourced claim that the Hellshire Hills is a reserve closed to the public. https://www.iucn-isg.org/species/iguana-species/cyclura-collei/' },
  { k: 'birding', id: 'north-island', note: 'Corrected. Wrybills are at Miranda from late December to August, not arriving in May. https://www.nzgeo.com/?p=13277' },
  { k: 'birding', id: 'pantanal', note: 'Corrected. The text said about 460 bird species; published counts for the Pantanal floodplain run from about 470 to 656, with 617 in a 2021 review, so it now says more than 600. https://www.scielo.br/j/paz/a/3RFjNvcQZstfJx8Wx7HXZ7J/' },
  { k: 'birding', id: 'chiapas', note: 'Softened. No source gives a closed season for El Triunfo (a permit and guide are needed); the wet-season text no longer says it is closed. https://en.wikipedia.org/wiki/El_Triunfo_Biosphere_Reserve' },
  { k: 'birding', id: 'peruvian-amazon', note: 'Corrected. White-plumed Antbird does not occur in this southern Amazon region (no records there); replaced with Hairy-crested Antbird (594 records in the region). Source: GBIF occurrence records.' },
  { k: 'birding', id: 'grandcanyon', note: 'Corrected. Western Tanager migration builds through April and peaks in May (about 40 records in April against about 1,800 in May). Source: GBIF occurrence records.' },
  { k: 'birding', id: 'provence', note: 'Corrected. The Camargue is Western Europe\'s largest river delta, not Europe\'s (the Danube Delta is larger). https://en.wikipedia.org/wiki/Camargue' },
  { k: 'birding', id: 'north-cascades', note: 'Corrected. The highway is often still shut until late April or early May, not through all of April. https://wsdot.wa.gov/about/news/2025/sr-20-north-cascades-highway-closes-season-thursday-dec-4-6-pm' },
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
    ...Object.entries(WHOLE).map(([k, notes]) => ({ interestKey: k, placeId: null as string | null, notes: notes.replace(REPORT, reportUrl) })),
    ...PLACE.map((p) => ({ interestKey: p.k, placeId: p.id as string | null, notes: p.note })),
  ];
  let n = 0;
  for (const e of entries) {
    if (have.has(`${e.interestKey}|${e.placeId ?? ''}`)) continue;
    n++;
    if (apply) {
      const values = { interestKey: e.interestKey, placeId: e.placeId, reviewerName: BY, reviewerRole: 'AI: Claude', reviewedOn: '2026-10-31', notes: e.notes, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${e.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    }
  }
  console.log(`${apply ? 'logged' : 'would log'} ${n} notes`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
