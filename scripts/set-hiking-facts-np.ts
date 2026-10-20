// Fills the hiking notes (crowding evidence, how you reach the trails, permits where notable) for the N to P places, from web research on 14 Oct 2026.
// Places not researched or with no notable hiking get crowdIndicators [] ("Do not mention crowds anywhere"). Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type D = { ind: string[]; ev?: string; reach?: string[]; permits?: string };
const DATA: Record<string, D> = {
  namibia: { ind: ['controls'], reach: ['trailhead'], permits: 'The Fish River Canyon hike is only open about 1 May to 15 September (flood risk and extreme heat); permits come from Namibia Wildlife Resorts for groups of 3 to 30, with a doctor\'s fitness certificate checked at Hobas.', ev: 'Controls: seasonal permit and group-size rules on the Fish River Canyon hike.' },
  napa: { ind: [], reach: ['trailhead'] },
  'new-orleans': { ind: [], reach: ['fromTown'] },
  nicaragua: { ind: ['controls'], reach: ['trailhead', 'boat'], permits: 'Most sources say a local guide is required (or strongly advised) to climb Volcan Maderas on Ometepe, about US$15 to 30 a person; the descent into the crater uses ropes.', ev: 'Controls: guide rule on Maderas.' },
  'nice-riviera': { ind: [], reach: ['train', 'trailhead'] },
  'north-cascades': { ind: ['recognized'], reach: ['trailhead'], permits: 'Day hikes (including Cascade Pass) need no permit; overnight trips need a backcountry permit, with reservations through Recreation.gov and the most popular areas filling quickly in summer.', ev: 'Recognized: the park calls Cascade Pass its most popular day hike, quite busy on summer weekends.' },
  'north-island': { ind: ['volume', 'controls'], reach: ['trailhead', 'shuttle'], permits: 'The Tongariro Alpine Crossing has a free booking system (a daily cap was proposed); Tongariro Northern Circuit huts and campsites must be booked in the Great Walk season, and the Mangatepopo section was closed after fires in late 2025.', ev: 'Volume: the Department of Conservation estimates about 71,000 to 100,000 crossings a season, with a single-day count above 2,000 on 30 March 2024. Controls: crossing booking system and Great Walk bookings.' },
  'nova-scotia': { ind: ['recognized', 'controls', 'parking'], reach: ['trailhead'], permits: 'From 26 June to 25 October 2026, Skyline Trail parking in Cape Breton Highlands National Park needs a timed reservation (four-hour blocks, 50 vehicles each, about 100 spaces).', ev: 'Recognized: Parks Canada says the Skyline Trail had become beyond capacity, with traffic spilling onto the Cabot Trail and off-trail walking damaging headland vegetation. Controls: timed reservations. Parking: about 100 spaces.' },
  nyc: { ind: [], reach: ['train'] },
  oaxaca: { ind: [], reach: ['trailhead', 'fromTown'], permits: 'The Pueblos Mancomunados village cabins are booked through the community agency Expediciones Sierra Norte; weekends and holidays fill up.' },
  okinawa: { ind: [], reach: ['trailhead'] },
  olympic: { ind: ['controls'], reach: ['trailhead'], permits: 'Overnight trips need a Wilderness Camping Permit (reserve on Recreation.gov; popular areas hold back only half their quota for walk-ups, scarce in summer); bear canisters are required in places such as Enchanted Valley and the Wilderness Coast. The Hoh road and Hurricane Ridge access have been disrupted by a washout and the 2023 fire at the visitor center, so check current status.', ev: 'Controls: permit quotas for overnight trips.' },
  pakistan: { ind: ['controls'], reach: ['trailhead'], permits: 'Independent trekking is not allowed on the K2 route: foreigners need an approved guide and agency, a special trekking visa, and a Central Karakoram National Park fee (about US$300 as of 2024) paid by the agency. The rules for Fairy Meadows and Nanga Parbat for foreigners conflict between sources.', ev: 'Controls: guide, visa and park fee.' },
  palau: { ind: [], reach: ['boat', 'trailhead'], permits: 'The Ngardmau Waterfall walk (20 to 30 minutes, many steps, muddy) charges an entrance fee, reported at about US$10.' },
  palawan: { ind: [], reach: ['boat', 'trailhead'] },
  panama: { ind: [], reach: ['trailhead'], permits: 'Sources conflict on whether the Sendero Los Quetzales trail near Boquete is open after storm damage in 2021; check locally.' },
  pantanal: { ind: [], reach: ['trailhead'] },
  'papua-new-guinea': { ind: ['controls'], reach: ['flight', 'trailhead'], permits: 'The Kokoda Track requires a trek permit from the Kokoda Track Authority (K200 for international adults under the 2005 schedule; operators usually include it in the package) and campsite fees to landowners.', ev: 'Controls: trek permit.' },
  paris: { ind: [], reach: ['train'] },
  peru: { ind: ['volume', 'controls'], reach: ['trailhead', 'train'], permits: 'The classic Inca Trail is capped at 500 people a day (guides and porters included) and permits sell out 3 to 6 months ahead for May to August; the trail closes each February. Machu Picchu itself needs timed tickets.', ev: 'Volume: Machu Picchu allows 4,500 to 5,600 people a day, and some Rainbow Mountain estimates run to about 1,000 a day (unofficial). Controls: Inca Trail daily cap.' },
  'peruvian-amazon': { ind: ['controls'], reach: ['boat', 'flight'], permits: 'Entering the Tambopata National Reserve requires an authorized jungle guide through licensed operators.', ev: 'Controls: guide requirement (operator-sourced).' },
  piedmont: { ind: [], reach: ['fromTown'] },
  prague: { ind: [], reach: ['train', 'fromTown'], permits: 'Pravcicka Gate (Bohemian Switzerland) charges a small entry fee and is open daily April to October.' },
  provence: { ind: ['volume', 'controls'], reach: ['trailhead', 'train'], permits: 'In summer the Calanques National Park has capped daily numbers at Sugiton cove (about 400 a day, free booking), and fire-risk days close the massifs entirely.', ev: 'Volume: Sugiton cove had peaks of up to 2,500 visitors a day before the cap. Controls: booking and fire closures.' },
  'puerto-rico': { ind: ['controls'], reach: ['trailhead'], permits: 'In El Yunque the La Mina trail and falls were closed for construction; the recreation corridor shuts at 5 p.m., and weekend reservations are reported for some northern trails.', ev: 'Controls: closures and weekend reservations.' },
  puglia: { ind: [], reach: ['trailhead'] },
  'punta-cana': { ind: [], reach: ['fromTown'] },
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
