// Fills the hiking notes (crowding evidence, how you reach the trails, permits where notable) for the K to M places, from web research on 14 Oct 2026.
// Places not researched or with no notable hiking get crowdIndicators [] ("Do not mention crowds anywhere"). Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type D = { ind: string[]; ev?: string; reach?: string[]; permits?: string };
const DATA: Record<string, D> = {
  kaziranga: { ind: ['recognized', 'controls'], reach: ['trailhead'], permits: 'Arunachal Pradesh and Nagaland need an Inner Line Permit for Indians and a Protected Area Permit for foreigners; a registered guide is reportedly required for treks in Meghalaya\'s East Khasi Hills (unconfirmed).', ev: 'Recognized: tourism has degraded the health of the Umshiang double-decker root bridge. Controls: permit rules for Arunachal and Nagaland.' },
  kenya: { ind: ['controls'], reach: ['trailhead'], permits: 'Walking is not allowed inside most Kenyan national parks (Hell\'s Gate is the exception); the Maasai Mara allows guided walks only in the private conservancies around the reserve.', ev: 'Controls: walking restrictions in parks.' },
  kerala: { ind: ['controls'], reach: ['trailhead'], permits: 'The Meesapulimala trek near Munnar is a permitted route run by the Kerala Forest Development Corporation, with authorized guides only; the permit is booked online and collected in Munnar.', ev: 'Controls: permit and guide rule on Meesapulimala.' },
  komodo: { ind: ['controls'], reach: ['boat'], permits: 'Komodo National Park charges an entry fee and walks go with park rangers; sources conflict on whether a guide is required on Padar Island.', ev: 'Controls: entry fee and ranger-guided walks.' },
  kruger: { ind: ['controls'], reach: ['trailhead'], permits: 'Walking inside Kruger is only on guided walks with armed field guides; multi-day wilderness trails (three nights, 15 to 20 km a day) must be booked far ahead and do not run from November to February because of the heat.', ev: 'Controls: guided-only walking.' },
  kyrgyzstan: { ind: ['controls'], reach: ['trailhead'], permits: 'A small park fee is paid at the Ala-Kul trailhead; border-zone areas (such as Kel-Suu and Khan Tengri) need a State Border Service permit.', ev: 'Controls: border-zone permits.' },
  ladakh: { ind: ['controls'], reach: ['trailhead'], permits: 'Foreigners need an Inner Line Permit obtained in Leh, and the Markha Valley lies inside Hemis National Park, which has an entry fee.', ev: 'Controls: Inner Line Permit and park entry.' },
  'lake-district': { ind: ['volume', 'recognized', 'parking'], reach: ['trailhead'], ev: 'Volume: more than 30,000 people a year attempt the Three Peaks challenge, including Scafell Pike. Recognized: rangers and the National Trust report path erosion, litter and mass parking at Wasdale. Parking: Wasdale\'s single-track road, with paid National Trust parking at Lake Head and minibus bays added to stop informal parking.' },
  lapland: { ind: ['volume'], reach: ['trailhead'], ev: 'Volume: Pallas-Yllastunturi National Park gets about 400,000 to half a million visits a year. No other indicators found.' },
  lisbon: { ind: ['queues'], reach: ['trailhead', 'train'], ev: 'Queues: the 434 tourist bus to Sintra\'s hilltop palaces is frequently overwhelmed in peak season.' },
  lofoten: { ind: ['volume', 'recognized', 'parking'], reach: ['trailhead'], ev: 'Volume: thousands of hikers climb Reinebringen each summer, with near-constant crowds in July. Recognized: authorities built a stone staircase to stop erosion. Parking: roadside parking was closed and spaces are limited, so most walk in from the Reine harbour car park.' },
  london: { ind: [], reach: ['train'] },
  'los-cabos': { ind: [], reach: ['trailhead'] },
  luangprabang: { ind: [], reach: ['trailhead'] },
  madagascar: { ind: ['controls'], reach: ['trailhead'], permits: 'Guides are mandatory in Isalo National Park (self-guided walking is not allowed) and parks charge entry fees.', ev: 'Controls: mandatory guides.' },
  maldives: { ind: [], reach: ['boat'] },
  mallorca: { ind: ['recognized'], reach: ['trailhead', 'boat'], ev: 'Recognized: guides describe Sa Calobra as packed in peak season. No counts or controls confirmed.' },
  'marlborough-abel-tasman': { ind: ['controls'], reach: ['trailhead', 'boat'], permits: 'Abel Tasman Coast Track huts and campsites must be booked year-round (Great Walk); the Queen Charlotte Track needs a land cooperative pass across private land and campsite bookings.', ev: 'Controls: mandatory bookings.' },
  maui: { ind: ['controls'], reach: ['trailhead'], permits: 'Vehicles entering Haleakala National Park\'s summit area between 3 and 7 a.m. need a reservation on Recreation.gov.', ev: 'Controls: sunrise vehicle reservations.' },
  mauritius: { ind: [], reach: ['trailhead'] },
  mendoza: { ind: ['controls'], reach: ['trailhead'], permits: 'Aconcagua Provincial Park needs an entry permit (three-day trekking permit for walkers), bought in Mendoza or at the Horcones ranger shelter.', ev: 'Controls: park entry permit.' },
  mexicocity: { ind: [], reach: ['trailhead'], permits: 'Izta-Popo National Park asks for visitor registration; Iztaccihuatl is a non-technical but high-altitude climb.' },
  'milford-sound-fiordland': { ind: ['controls'], reach: ['trailhead', 'boat'], permits: 'The Milford, Routeburn and Kepler tracks (Great Walks) must be booked in peak season and can sell out within hours of opening.', ev: 'Controls: mandatory Great Walk bookings.' },
  mongolia: { ind: [], reach: ['trailhead'] },
  'monterey-big-sur': { ind: [], reach: ['trailhead'] },
  morocco: { ind: [], reach: ['trailhead'] },
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
