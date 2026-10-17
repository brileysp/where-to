// Fills the hiking notes (crowding evidence, how you reach the trails, permits where notable) for the Q to S places, from web research on 14 Oct 2026.
// Places not researched or with no notable hiking get crowdIndicators [] ("Do not mention crowds anywhere"). Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type D = { ind: string[]; ev?: string; reach?: string[]; permits?: string };
const DATA: Record<string, D> = {
  'quebec-city': { ind: [], reach: ['fromTown'] },
  queenstown: { ind: ['recognized', 'controls'], reach: ['trailhead', 'shuttle'], permits: 'The Routeburn and Kepler Great Walks need hut or campsite bookings from 1 November to 30 April (the 2026/27 booking window opened in May and popular dates sell out within days); outside that season huts are first come, first served.', ev: 'Recognized: Roys Peak (near Wanaka) draws hundreds of walkers on busy days with queues at the summit photo spot and an overflowing car park. Controls: Great Walk bookings.' },
  rajaampat: { ind: [], reach: ['boat'] },
  'rajasthan-golden-triangle': { ind: [], reach: ['trailhead'] },
  redwood: { ind: ['controls'], reach: ['trailhead'], permits: 'In summer (about mid-May to mid-September) a day-use reservation is needed for the Gold Bluffs Beach parking area and Fern Canyon trailhead; walking in from the Prairie Creek visitor center on the 10-mile round-trip James Irvine Trail needs no permit.', ev: 'Controls: Fern Canyon day-use reservations.' },
  rio: { ind: [], reach: ['trailhead'] },
  rioja: { ind: [], reach: ['fromTown'] },
  rivieramaya: { ind: [], reach: ['fromTown'] },
  'rocky-mountain': { ind: ['recognized', 'controls'], reach: ['trailhead', 'shuttle'], permits: 'In 2026 a timed-entry reservation was required to enter between 9 a.m. and 2 p.m. from late May to mid-October (with a separate Bear Lake Road corridor reservation); outside those hours no reservation was needed.', ev: 'Recognized: the park introduced timed entry to manage congestion. Controls: timed-entry reservations.' },
  rome: { ind: [], reach: ['train'] },
  rwanda: { ind: ['controls'], reach: ['trailhead'], permits: 'Walks in Volcanoes National Park (the Dian Fossey grave hike, about 3 to 7 hours depending on the source, around US$75) go with park guides; gorilla trekking permits cost up to US$1,500 and are not hiking.', ev: 'Controls: guided walks in the park.' },
  'san-miguel-guanajuato': { ind: [], reach: ['fromTown'] },
  santorini: { ind: [], reach: ['trailhead', 'fromTown'] },
  sardinia: { ind: [], reach: ['trailhead'], permits: 'The Selvaggio Blu is a technical coast trek with scrambling and abseiling, and operators strongly recommend a guide.' },
  'scottish-highlands-skye': { ind: ['recognized', 'parking'], reach: ['trailhead'], ev: 'Recognized: the Highland Council has written about managing visitor numbers on Skye, and news reports describe cars parked for miles around the Old Man of Storr. Parking: the Quiraing car park is often full by 9 a.m. in summer, the Fairy Pools charge about 5 pounds, and the Storr has paid roadside parking.' },
  seoul: { ind: [], reach: ['train', 'fromTown'] },
  'sequoia-kings-canyon': { ind: ['controls'], reach: ['trailhead'], permits: 'Overnight trips need a wilderness permit from Recreation.gov (released six months ahead, with a quota season in summer).', ev: 'Controls: wilderness permit quota.' },
  seychelles: { ind: [], reach: ['trailhead'] },
  sicily: { ind: ['controls'], reach: ['trailhead', 'shuttle'], permits: 'On Mount Etna an authorized volcano guide is required above roughly 2,500 to 2,900 m (the limit moves with volcanic activity), and the summit craters open only when the volcano allows; lower trails near Rifugio Sapienza are open to independent walkers.', ev: 'Controls: guide rule near the summit.' },
  singapore: { ind: [], reach: ['train'] },
  snowdonia: { ind: ['volume', 'parking'], reach: ['trailhead', 'shuttle'], ev: 'Volume: the Snowdonia Society says over 500,000 people climb Snowdon each year, including more than 125,000 on the Pyg Track. Parking: the Pyg Track car park fills early on summer weekends and the national park suggests using Nant Peris and the bus.' },
  'southeast-alaska': { ind: ['controls'], reach: ['trailhead', 'boat'], permits: 'Overnight use of the Chilkoot Trail from about 1 June to 12 September needs a permit (Recreation.gov for the US side, plus a mandatory orientation in Skagway); the Mendenhall West Glacier Trail is an unmaintained backcountry route with a history of lost hikers.', ev: 'Controls: Chilkoot permit rule.' },
  srilanka: { ind: ['queues'], reach: ['trailhead'], permits: 'Adam\'s Peak (Sri Pada) is climbed from December to May (the season opens on the December Poya full moon day); out of season you need permission from the Ratnapura District Secretariat.', ev: 'Queues: on Poya full-moon nights climbers can wait hours in the queue to the summit.' },
  'st-andrews-fife': { ind: [], reach: ['trailhead'] },
  svalbard: { ind: ['controls'], reach: ['flight', 'boat'], permits: 'Everyone leaving the settlements must carry a means of scaring off polar bears (a rifle is the common practice, but sources disagree on whether the law names one); guided trips are the usual way.', ev: 'Controls: polar bear safety rules.' },
  sydney: { ind: ['recognized'], reach: ['train', 'trailhead'], ev: 'Recognized: Echo Point at the Three Sisters is very busy, especially on weekends, and its parking fills quickly. The Royal National Park Coast Track (about 26 km, no camping at North Era) is graded 5 and mostly walked as two day hikes.' },
};
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const ids = new Set((await db.select({ id: places.id }).from(places)).map((p) => p.id));
  let n = 0;
  for (const [placeId, d] of Object.entries(DATA)) {
    if (!ids.has(placeId)) { console.log('SKIP unknown place', placeId); continue; }
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'hiking')));
    const before = (existing?.facts ?? {}) as Record<string, unknown>;
    const after: Record<string, unknown> = { ...before, crowdIndicators: d.ind };
    if (d.ev) after.crowdEvidence = d.ev; else delete after.crowdEvidence;
    if (d.reach) after.howReach = d.reach; else delete after.howReach;
    if (d.permits) after.permits = d.permits;
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'place_interest_fact', entityId: `${placeId}:hiking`, action: existing ? 'update' : 'create', before: existing ? { placeId, interestKey: 'hiking', facts: before } : null, after: { placeId, interestKey: 'hiking', facts: after },
      write: (tx) => tx.insert(placeInterestFacts).values({ placeId, interestKey: 'hiking', facts: after as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: after as never, updatedAt: new Date() } }) });
    n++;
  }
  console.log('wrote facts for', n, 'places');
  process.exit(0);
})();
