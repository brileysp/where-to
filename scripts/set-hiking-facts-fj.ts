// Fills the hiking notes (crowding evidence, how you reach the trails, permits where notable) for the F to J places, from web research on 14 Oct 2026.
// Places not researched or with no notable hiking get crowdIndicators [] ("Do not mention crowds anywhere"). Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type D = { ind: string[]; ev?: string; reach?: string[]; permits?: string };
const DATA: Record<string, D> = {
  falklands: { ind: [], reach: ['flight', 'trailhead'] },
  'faroe-islands': { ind: ['controls'], reach: ['trailhead', 'boat'], permits: 'Several popular routes charge a mandatory hiking fee (the Sørvágsvatn trail and Kallur lighthouse about 200 DKK, Mykines about 100 DKK plus the ferry); closures can apply during sheep gathering and lambing; the rules were changing in 2026.', ev: 'Controls: mandatory fees on popular trails and tour-only access on Mykines in season. No visitor counts found.' },
  fiji: { ind: [], reach: ['trailhead'], permits: 'The Lavena Coastal Walk on Taveuni charges a village fee of about FJ$35 a person.' },
  fjords: { ind: ['volume', 'recognized', 'controls', 'parking'], reach: ['trailhead', 'shuttle'], permits: 'Parking at the Trolltunga trailhead (Mågelitopp) must be pre-booked.', ev: 'Volume: about 80,000 hikers a year on Trolltunga, more than 300,000 on Preikestolen, more than 60,000 on Besseggen in the short season. Recognized: CNBC (2019) on social-media crowding at Trolltunga, Preikestolen and Kjeragbolten. Controls: pre-booked parking at Trolltunga (30 spaces at the closest lot). Parking: the Besseggen car park fills before 7 a.m.' },
  galapagos: { ind: ['controls'], reach: ['boat'], permits: 'Visitors must pay a US$200 national park fee on arrival, and most park sites are visited only with a licensed guide.', ev: 'Controls: park fee and guide rules for most sites.' },
  gbr: { ind: [], reach: ['boat'], permits: 'The Ngaro Track in the Whitsundays is reached by boat; independent walkers must book through the track website.' },
  ghana: { ind: ['controls'], reach: ['trailhead'], permits: 'The upper Wli Falls hike needs a local guide and is usually closed in the wet season (about July to December); Mount Afadjato ascents are guided through the Liati Wote community office; the Kakum canopy walk is guided.', ev: 'Controls: mandatory guides at Wli, Afadjato and Kakum.' },
  'glacier-waterton': { ind: ['recognized', 'controls', 'parking'], reach: ['shuttle', 'trailhead', 'boat'], permits: 'Glacier ran a timed vehicle-reservation pilot through September 2025; check the park for the 2026 rules.', ev: 'Recognized: visitors and press report crowded trails and lots even under the reservation system. Controls: the timed vehicle-reservation pilot (ended September 2025). Parking: Logan Pass lots fill early.' },
  grandcanyon: { ind: [], reach: ['trailhead'] },
  'great-smoky-mountains': { ind: ['volume', 'recognized', 'controls', 'parking'], reach: ['trailhead', 'shuttle'], permits: 'A parking tag is required to park in the park for more than 15 minutes.', ev: 'Volume: about 12 to 13 million visits a year (hiking blog; the most visited national park). Recognized: the NPS describes Alum Cave as extreme crowding and limited parking and suggests a shuttle. Controls: the parking tag. Parking: popular lots including Alum Cave fill early.' },
  greenland: { ind: [], reach: ['flight', 'trailhead'] },
  guatemala: { ind: [], reach: ['trailhead'] },
  'guilin-yangshuo': { ind: [], reach: ['trailhead'] },
  havana: { ind: ['controls'], reach: ['trailhead'], permits: 'Pico Turquino can only be climbed with a local guide (a military area with limited permits) and the park office is sometimes closed for days.', ev: 'Controls: guide-only and limited permits on Pico Turquino.' },
  hokkaido: { ind: ['controls'], reach: ['trailhead'], permits: 'On the ground trail at the Shiretoko Five Lakes a permit and a short bear briefing are needed in bear season; brown bears are seen on it about every other day in August and September.', ev: 'Controls: permit and bear briefing at the Five Lakes.' },
  hongkong: { ind: [], reach: ['trailhead'] },
  'hudson-valley': { ind: ['volume', 'parking', 'controls'], reach: ['train', 'trailhead'], permits: 'Minnewaska State Park Preserve requires parking reservations at the Sam\'s Point area on weekends and holidays (about April to mid-November).', ev: 'Volume: an older estimate of about 100,000 hikers a year on Breakneck Ridge. Parking: over 100 cars fill the Breakneck lot and roadsides on a sunny weekend, so many take the train. Controls: Sam\'s Point parking reservations.' },
  iceland: { ind: ['volume', 'controls', 'parking'], reach: ['trailhead'], permits: 'The Laugavegur huts (run by the Icelandic Touring Association) must be booked and fill months ahead; paid parking at Landmannalaugar is new for 2026.', ev: 'Volume: about 75,000 to 100,000 people hike the Laugavegur a year, mostly July and August. Controls: hut booking with the beds selling out. Parking: paid parking at Landmannalaugar from 2026.' },
  ireland: { ind: [], reach: ['trailhead'] },
  istanbul: { ind: [], reach: ['boat'] },
  jamaica: { ind: [], reach: ['trailhead'] },
  jordan: { ind: [], reach: ['trailhead', 'fromTown'] },
  'joshua-tree': { ind: [], reach: ['trailhead'] },
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
