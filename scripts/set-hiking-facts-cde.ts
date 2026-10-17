// Fills the hiking notes (crowding evidence, how you reach the trails, permits where notable) for the C, D and E places, from web research on 14 Oct 2026.
// Places not researched or with no notable hiking get crowdIndicators [] ("Do not mention crowds anywhere"). Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type D = { ind: string[]; ev?: string; reach?: string[]; permits?: string };
const DATA: Record<string, D> = {
  canaries: { ind: ['volume', 'controls'], reach: ['trailhead', 'lifts'], permits: 'The Teide summit path needs a permit booked in advance (one operator says 200 a day); the cable car runs to just below the summit.', ev: 'Volume: Garajonay National Park on La Gomera gets more than 800,000 visitors a year (hiking site). Controls: Teide summit permits are capped.' },
  'cape-cod-islands': { ind: [], reach: ['trailhead'] },
  chamonix: { ind: ['volume', 'recognized', 'controls', 'queues'], reach: ['lifts', 'train'], ev: 'Volume: about 80,000 people walk the Tour du Mont Blanc a year. Recognized: Euronews (August 2026) reports that crowds on Mont Blanc may bring hut reservations and access limits. Controls: reservations on the Aiguille du Midi cable car in July and August. Queues: waits of 20 minutes to an hour and a half on peak days at the Aiguille du Midi. No documented parking figures.' },
  champagne: { ind: [], reach: ['trailhead'] },
  'charleston-savannah': { ind: [] },
  'chiang-mai': { ind: ['controls'], reach: ['trailhead'], permits: 'The Kew Mae Pan nature trail in Doi Inthanon National Park needs a local guide (about 200 baht a group) and is closed about June to October.', ev: 'Controls: mandatory guide and seasonal closure at Kew Mae Pan. Nothing documented on crowds.' },
  chiapas: { ind: [] },
  'chilean-lake-district': { ind: ['controls'], reach: ['trailhead'], permits: 'Villarrica volcano climbs go with an authorized guide (CONAF expects it; enforcement varies); Huerquehue National Park needs no guide.', ev: 'Controls: guide expectation for Villarrica. Nothing documented on crowds.' },
  churchill: { ind: [] },
  'colombian-andes': { ind: [], reach: ['shuttle'] },
  'colombian-caribbean': { ind: ['controls'], reach: ['trailhead'], permits: 'Ciudad Perdida can only be trekked with an authorized guide, 4 to 6 days; Tayrona National Park closes for about a month a year (often February) at the request of the Kogi people.', ev: 'Controls: mandatory guide for Ciudad Perdida and a yearly Tayrona closure.' },
  copenhagen: { ind: [] },
  cornwall: { ind: ['queues'], reach: ['trailhead'], ev: 'Congestion: the South West Coast Path around Newquay is quite crowded in tourist season. No counts or controls found.' },
  'costa-rica': { ind: ['controls'], reach: ['trailhead'], permits: 'Cerro Chirripo needs a permit booked in advance (daily cap, sells out in the dry season); Corcovado requires a certified guide.', ev: 'Controls: Chirripo daily permit cap; Corcovado guide rule.' },
  cotswolds: { ind: [], reach: ['trailhead'] },
  croatia: { ind: ['controls'], reach: ['trailhead'], permits: 'Plitvice Lakes needs a timed-entry ticket in the high season (it lies inland, about two hours from Zadar and Split).', ev: 'Controls: timed entry at Plitvice (one guide says 300 people an hour per entrance).' },
  'death-valley': { ind: [], reach: ['trailhead'] },
  'denali-interior': { ind: ['controls', 'parking'], reach: ['shuttle', 'trailhead'], permits: 'Private vehicles may drive only the first 15 miles of the Denali Park Road (to Savage River); beyond that travel is by park bus, except for a September lottery for driving the road.', ev: 'Controls: the park road is closed to private vehicles beyond mile 15 and a lottery governs the September drive. Parking: Savage River parking is extremely limited and the NPS recommends the free shuttle.' },
  'douro-valley-porto': { ind: [], reach: ['trailhead', 'train'] },
  dubai: { ind: [], reach: ['trailhead'] },
  'ecuadorian-andes': { ind: [], reach: ['trailhead'] },
  edinburgh: { ind: [], reach: ['trailhead'] },
  egypt: { ind: ['controls'], reach: ['trailhead'], permits: 'Climbing Mount Sinai requires a local Bedouin guide, hired at the monastery car park.', ev: 'Controls: mandatory local guide on Mount Sinai.' },
  'el-chalten': { ind: ['recognized'], reach: ['trailhead'], ev: 'Recognized: Laguna de los Tres is described by hikers as the most famous hike in El Chalten and quite crowded. No counts or controls found.' },
  ethiopia: { ind: ['controls'], reach: ['trailhead'], permits: 'The Simien Mountains National Park needs an entrance permit and a compulsory armed scout, arranged in Debark; operators say a guide is also required.', ev: 'Controls: permit and mandatory scout in the Simien Mountains.' },
  everglades: { ind: [], reach: ['trailhead'] },
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
