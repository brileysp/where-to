// Fills the hiking notes (crowding evidence, how you reach the trails, permits where notable) for the A-B places, from web research on 14 Oct 2026.
// Places not researched or with no notable hiking get crowdIndicators [] ("Do not mention crowds anywhere"). Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type D = { ind: string[]; ev?: string; reach?: string[]; permits?: string };
const DATA: Record<string, D> = {
  acadia: { ind: ['volume', 'recognized', 'controls', 'parking', 'queues'], reach: ['trailhead', 'shuttle'],
    permits: 'Cadillac Summit Road needs a vehicle reservation in the main season (hikers and cyclists are exempt).',
    ev: 'Volume: about 4 million visits a year (recreation.gov). Recognized: the park says growth has caused severe traffic and parking congestion; the superintendent says Jordan Pond is overparked regularly. Controls: Cadillac Summit Road vehicle reservations, May to October. Parking: summit lot holds about 150 vehicles, up to 350 converge. Queues: Jordan Pond House lines (45 minutes reported), crowded summit walkway.' },
  aspen: { ind: ['volume', 'recognized', 'controls', 'parking', 'queues'], reach: ['shuttle', 'trailhead'],
    permits: 'Maroon Bells Scenic Area is reservation-only for vehicles and the shuttle in summer; overnight permits are required for Conundrum Hot Springs, the Four Pass Loop and Capitol Lake.',
    ev: 'Volume: more than 300,000 visitors a year at Maroon Bells, double a few years earlier. Recognized: the Forest Service says the reservation system reduces overcrowding. Controls: reservation-only vehicles and shuttle since 2020, with daily caps. Parking: about 95% of day-parking gone two to four weeks out. Queues: cars queue on Maroon Creek Road at peak.' },
  'bavaria-munich': { ind: ['volume', 'recognized', 'parking', 'queues'], reach: ['train', 'lifts', 'shuttle'],
    ev: 'Volume: up to 4,000 cars a day at Walchensee (2020 report). Recognized: summer 2025 overtourism fears around the Eibsee; a deputy mayor compared the crowds to Oktoberfest. Parking: bumper-to-bumper traffic on the last kilometres of the only road to the Eibsee and Zugspitze cable cars. Queues: crowds waiting for Eibsee shuttle buses, which were sometimes too full. No access controls.' },
  basque: { ind: ['volume', 'recognized', 'controls'], reach: ['trailhead'],
    permits: 'A free ticket is mandatory at San Juan de Gaztelugatxe on busy days (daily from mid-June to mid-September, weekends from spring to autumn).',
    ev: 'Volume: about 730,000 visitors in 2019 and 6,434 on one day (15 August 2019). Recognized: Euronews 2023 on Basque locals lamenting overtourism. Controls: mandatory free tickets and a daily capacity limit at Gaztelugatxe (figures vary: 960 to 3,024 a day).' },
  'basque-country': { ind: ['volume', 'recognized', 'controls'], reach: ['trailhead'],
    permits: 'A free ticket is mandatory at San Juan de Gaztelugatxe on busy days (daily from mid-June to mid-September, weekends from spring to autumn).',
    ev: 'Volume: about 730,000 visitors in 2019 and 6,434 on one day (15 August 2019). Recognized: Euronews 2023 on Basque locals lamenting overtourism. Controls: mandatory free tickets and a daily capacity limit at Gaztelugatxe (figures vary: 960 to 3,024 a day).' },
  algarve: { ind: ['parking', 'queues'], reach: ['trailhead'], ev: 'Parking: Praia da Marinha, the usual start of the Seven Hanging Valleys trail, gets very busy in summer and on weekends. Congestion: the trail can be very crowded in summer. No counts or controls found.' },
  amalfi: { ind: ['queues'], reach: ['shuttle', 'fromTown'], ev: 'Congestion: travel writers describe a congested Path of the Gods in July and August, clogged from late morning to early afternoon. No visitor counts, caps or permits found; buses are infrequent.' },
  andalucia: { ind: ['controls'], reach: ['trailhead', 'shuttle'], permits: 'The Caminito del Rey needs a timed online ticket, limited to about 100 people per half hour; a shuttle bus runs from the visitors centre.', ev: 'Controls: Caminito del Rey timed, capped tickets. Nothing documented for the Sierra Nevada trails.' },
  antarctica: { ind: ['recognized', 'controls'], reach: ['boat'], permits: 'Landings are capped at 100 people ashore at a time, one ship per site (Antarctic Treaty and IAATO rules).', ev: 'Recognized: IAATO and the Treaty parties manage tourism growth. Controls: 100 ashore, one ship per site. About 80,000 visitors in 2019/20, well under the volume line.' },
  'arches-canyonlands': { ind: ['recognized', 'parking'], reach: ['trailhead'], permits: 'Fiery Furnace hikes need their own permit or reservation.', ev: 'Recognized: the park ran a timed-entry pilot from 2022 to 2025 because of crowding (not renewed for 2026). Parking: Delicate Arch and The Windows lots were chaotic before timed entry. No annual figure found.' },
  'argentine-lake-district': { ind: ['controls'], reach: ['trailhead'], permits: 'A free trekking registration with Nahuel Huapi National Park is mandatory for Refugio Frey and other hikes; refugios and camping need advance reservations.', ev: 'Controls: mandatory registration and refugio reservations (Frey has 35 places). No counts found.' },
  atacama: { ind: ['controls', 'queues'], reach: ['trailhead'], permits: 'Valle de la Luna admits visitors in groups of up to 12 with tickets bought in advance.', ev: 'Controls: group limits per sector at Valle de la Luna. Congestion: busy at sunset. No counts found.' },
  azores: { ind: ['controls'], reach: ['trailhead'], permits: 'The interior of Faial\'s Caldeira is guided only and capped at 40 visitors a day; the rim trail is open.', ev: 'Controls: Faial Caldeira interior capped at 40 a day. No crowding found at Sete Cidades or Lagoa do Fogo.' },
  'badlands-black-hills': { ind: ['parking', 'queues'], reach: ['trailhead'], ev: 'Parking: the Sylvan Lake lot (start of Black Elk Peak) overflows by noon in summer. Congestion: Sylvan Lake is one of the most crowded places in the Black Hills. No counts found.' },
  bali: { ind: ['queues'], reach: ['trailhead'], permits: 'A local guide is effectively required for the Mount Batur sunrise trek, arranged at the trailhead.', ev: 'Congestion: about 600 hikers a day on Mount Batur, a line of torches in the dark. No official count found.' },
  barcelona: { ind: ['volume'], reach: ['train', 'lifts', 'fromTown'], ev: 'Volume: Montserrat draws over a million visitors a year (monastery, not the hike). No hiking-specific crowding found.' },
  beijing: { ind: ['controls', 'queues'], reach: ['shuttle', 'lifts'], permits: 'Popular Great Wall sections (Mutianyu, Badaling, Jinshanling) require advance real-name booking; wild sections such as Jiankou may need a guide or permit.', ev: 'Controls: mandatory pre-booking at the main sections. Congestion: weekends and national holidays are busiest. No counts found.' },
  'belfast-giants-causeway': { ind: ['volume', 'controls', 'parking'], reach: ['trailhead', 'shuttle'], ev: 'Volume: about one million visitors a year at the Giant\'s Causeway (2017). Controls: pre-booking recommended; on-site parking reserved for ticket holders. Parking: limited. The Causeway Coast Way and Mournes were not reported as crowded.' },
  'bend-crater-lake': { ind: ['controls'], reach: ['trailhead'], permits: 'Central Cascades wilderness permits (some by reservation) are required from June 15 to October 15.', ev: 'Controls: permit and reservation system at popular Three Sisters trailheads. Crater Lake smoke is a July to September issue (NPS).' },
  bhutan: { ind: ['controls'], reach: ['trailhead'], permits: 'Visitors pay a Sustainable Development Fee ($100 a night until August 2027) and must travel with a licensed operator or guide.', ev: 'Controls: fee and mandatory licensed operator as a deliberate limit on numbers. About 209,000 visitors in 2025, below the volume line.' },
  'black-forest': { ind: ['parking', 'queues'], reach: ['trailhead', 'lifts'], ev: 'Parking: Feldberg parking was cramped enough to need a 1,200-space car park. Congestion: Triberg waterfalls are often full on nice weekends and holidays. No region-wide overtourism reporting found.' },
  borneo: { ind: ['controls'], reach: ['trailhead'], permits: 'Climbing Mount Kinabalu needs a Sabah Parks permit through a licensed operator, a mandatory guide and a booked night at Panalaban; daily climber numbers are capped.', ev: 'Controls: daily climber quota (figures vary from 80 to 185 a day).' },
  borabora: { ind: [], reach: ['trailhead'], permits: 'Tahiti Tourisme says a guide is needed for Mount Pahia; Mount Otemanu\'s summit cannot be climbed, only its shoulder.' },
  botswana: { ind: [], reach: ['flight'] },
  aruba: { ind: [], reach: ['trailhead'] }, athens: { ind: [], reach: ['trailhead', 'lifts'] }, bahamas: { ind: [], reach: ['trailhead'] }, barbados: { ind: [], reach: ['trailhead'] },
  belize: { ind: [], reach: ['trailhead'] }, budapest: { ind: [], reach: ['fromTown'] }, angkor: { ind: [], reach: ['trailhead'] }, bagan: { ind: [], reach: ['trailhead'] },
  amsterdam: { ind: [] }, berlin: { ind: [] }, bangkok: { ind: [] }, bordeaux: { ind: [] }, buenosaires: { ind: [] },
  'big-island': { ind: [], reach: ['trailhead'], ev: 'Hawaii Volcanoes about 1.4 million visits in 2024, below the volume line; no access controls or crowding reports found.' },
};
// 'basque' is not a place id; kept out of the write below.
delete DATA.basque;
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
