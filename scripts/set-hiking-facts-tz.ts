// Fills the hiking notes (crowding evidence, how you reach the trails, permits where notable) for the T to Z places, from web research on 14 Oct 2026.
// Places not researched or with no notable hiking get crowdIndicators [] ("Do not mention crowds anywhere"). Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type D = { ind: string[]; ev?: string; reach?: string[]; permits?: string };
const DATA: Record<string, D> = {
  taiwan: { ind: ['controls'], reach: ['trailhead', 'train'], permits: 'Yushan (Jade Mountain) permits are allocated by lottery through the Hike Smart Taiwan site (a few places are set aside for foreign passport holders); Zhuilu Old Road in Taroko needs a permit applied for 1 to 30 days ahead. Rules change often.', ev: 'Controls: lottery permits for Yushan and permits for Zhuilu Old Road.' },
  tanzania: { ind: ['controls'], reach: ['trailhead'], permits: 'Kilimanjaro charges park fees of about US$70 a day plus camping or hut fees and a rescue fee, and operators say a registered guide is mandatory.', ev: 'Controls: park fees and guide rule on Kilimanjaro.' },
  tasmania: { ind: ['controls'], reach: ['trailhead', 'shuttle'], permits: 'From 1 October to 31 May the Overland Track needs a booking (about 34 places a day for independent walkers, a fee of A$312 in 2026, one direction only from Cradle Mountain to Lake St Clair); more than 3,000 places sold in six hours when bookings opened one year.', ev: 'Controls: daily booking quota on the Overland Track.' },
  'tbilisi-caucasus': { ind: ['recognized'], reach: ['trailhead', 'train'], ev: 'Recognized: guides describe the Gergeti Trinity Church path in Kazbegi as crowded in summer; the Mestia to Ushguli trek in Svaneti is Georgia\'s most popular long trek (4 days, about 55 km, poorly marked).' },
  'texas-hill-country': { ind: ['recognized', 'controls'], reach: ['trailhead'], permits: 'Enchanted Rock State Natural Area needs a day-pass reservation on weekends, holidays and school breaks (up to 30 days ahead, about US$8 for adults).', ev: 'Recognized: the park usually reaches capacity every day. Controls: reservations on busy days.' },
  thailand: { ind: [], reach: ['trailhead'] },
  'tierra-del-fuego': { ind: ['controls'], reach: ['flight', 'trailhead'], permits: 'The Dientes de Navarino circuit on Isla Navarino (Chile) is reached by flying Punta Arenas to Puerto Williams, and walkers are asked to register their trek with the Carabineros there; season roughly December to March.', ev: 'Controls: registration with the police.' },
  'turks-caicos': { ind: [], reach: ['boat', 'trailhead'] },
  tuscany: { ind: [], reach: ['fromTown', 'trailhead'] },
  uganda: { ind: ['controls'], reach: ['trailhead'], permits: 'Rwenzori Mountains National Park needs a Uganda Wildlife Authority permit and a mandatory local guide (operators quote about US$1,500 for a 7-day circuit); best seasons January to mid-March and June to August.', ev: 'Controls: permit and guide rule in the Rwenzori.' },
  uluru: { ind: [], reach: ['trailhead'], permits: 'In hot weather the Valley of the Winds walk closes at the first lookout from 11 a.m. when the temperature reaches 36 C; the Uluru base walk is advised only in the cool morning, and parts of it were closed for repairs in 2026.' },
  'upper-peninsula': { ind: [], reach: ['trailhead', 'boat'], permits: 'Overnight backcountry camping at Pictured Rocks National Lakeshore needs a permit booked through Recreation.gov; Isle Royale is reached only by ferry, seaplane or private boat and is open mid-April to the end of October.' },
  uyuni: { ind: [], reach: ['trailhead'], permits: 'The walk up Isla Incahuasi is short (about 15 minutes) and charges an entry fee; the island is cut off when the salt flat floods (roughly November to April).' },
  uzbekistan: { ind: [], reach: ['fromTown', 'trailhead'] },
  'vancouver-island': { ind: ['controls'], reach: ['trailhead'], permits: 'The West Coast Trail is open 1 May to 30 September and is fully reservable (booking opens in January and popular dates sell out in minutes); there is no standby list at the trailheads.', ev: 'Controls: reservation quota on the West Coast Trail.' },
  venice: { ind: [], reach: ['fromTown', 'trailhead'] },
  vermont: { ind: ['recognized'], reach: ['trailhead'], ev: 'Recognized: the Green Mountain Club has called Camel\'s Hump and Mount Mansfield among Vermont\'s most popular and crowded peaks; in 2020 it counted an average of 294 people a day on the Mansfield summit between May and October.' },
  vienna: { ind: [], reach: ['train', 'fromTown'] },
  vietnam: { ind: ['controls'], reach: ['trailhead'], permits: 'Fansipan (above Sapa) needs a permit and, per most sources, a licensed guide; Ha Giang requires a guide and a permit for overnight treks.', ev: 'Controls: guide and permit rules.' },
  whistler: { ind: ['controls'], reach: ['trailhead'], permits: 'In summer 2026 Garibaldi Provincial Park trailheads needed a free vehicle day pass (Rubble Creek and Diamond Head on Friday to Monday, Cheakamus daily; June 12 to October 12), released two days ahead; Joffre Lakes needs a separate trail pass per person.', ev: 'Controls: day passes for busy trailheads.' },
  yellowstone: { ind: ['recognized', 'parking'], reach: ['trailhead'], ev: 'Recognized: the Grand Prismatic overlook area is very busy, with Midway Geyser Basin busiest 9 a.m. to 6 p.m. Parking: guides say there is not enough parking for the number of visitors at the most popular sites.' },
  yosemite: { ind: ['controls'], reach: ['trailhead', 'shuttle'], permits: 'Only the cables section of Half Dome needs a permit (preseason lottery in March; a daily lottery two days before), so the Mist Trail to Vernal and Nevada Falls needs none; the cables are up from late May to mid-October.', ev: 'Controls: Half Dome permit lottery.' },
  zambia: { ind: [], reach: ['trailhead'] },
  zimbabwe: { ind: [], reach: ['trailhead'] },
  'zion-bryce': { ind: ['controls'], reach: ['trailhead', 'shuttle'], permits: 'Angels Landing needs a permit by lottery (seasonal and day-before lotteries on Recreation.gov); the West Rim Trail up to Scout Lookout needs none.', ev: 'Controls: Angels Landing lottery.' },
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
