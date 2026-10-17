// Fills the new hiking columns "Crowding evidence", "Crowding sources" and "How you reach the trails" for the five sample places (14 Oct 2026).
// The evidence comes from web research on 14 Oct 2026 (travel press, park and tourism notices); see the Hiking round-two review page. Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const DATA: Record<string, { crowdIndicators: string[]; crowdEvidence: string; howReach: string[]; permits?: string }> = {
  dolomites: { crowdIndicators: ['volume', 'recognized', 'controls', 'parking', 'queues'], howReach: ['trailhead', 'lifts', 'shuttle'],
    crowdEvidence: 'Volume: Seceda about 4,000 to 6,000 visitors a day in summer, Lago di Sorapis up to 3,000 a day. Recognized: South Tyrol ranked with Venice for overcrowding exposure (Demoskopika), rangers at busy sites, accommodation capped at 2019 levels. Controls: Lago di Braies car access restricted 1 Jul to 15 Sep, 9am to 4pm; Tre Cime toll road with timed booking; Seceda lift timed slots and a ridge turnstile; Santa Maddalena bus limits. Parking: pass pull-outs controlled, Alpe di Siusi car parks booked online. Congestion: Braies boat pier described as extremely crowded. A few hotspots, but pressure is region-wide. Sources: moonhoneytravel.com, euronews.com, wildconnectionsphotography.com, throneandvine.com (14 Oct 2026).' },
  sedona: { crowdIndicators: ['volume', 'recognized', 'controls', 'parking'], howReach: ['trailhead', 'shuttle'],
    crowdEvidence: 'Volume: about 2.8 to 3 million visitors a year for a town of about 10,000 (ADOT, Sedona Chamber). Recognized: Outside magazine essay on overtourism; Sedona sustainable tourism plan. Controls: Cathedral Rock trailhead lot closed Thursday to Sunday, free Sedona Shuttle instead (Forest Service). Parking: Devil\'s Bridge overflow along Boynton Pass Road from about 7:15am. No documented queues.' },
  madeira: { crowdIndicators: ['recognized', 'controls', 'parking', 'queues'], howReach: ['trailhead'],
    crowdEvidence: 'Recognized: regional secretary says pressure points remain; carrying capacity of all classified trails updated with the University of Madeira. Controls: since 2026 every classified (PR) trail needs a paid time-slot booking with a visitor cap per slot (visitmadeira.com, timesofmadeira.com). Parking: at Caldeirão Verde after 10am you park about 2 km down the road. Congestion: Caldeirão Verde packed 10am to 2pm. No trail-specific volume figure found.' },
  'cape-town': { crowdIndicators: ['volume', 'recognized', 'queues'], howReach: ['trailhead', 'lifts'],
    crowdEvidence: 'Volume: Table Mountain National Park 2.8 million visits in 2023 (up to 4.2 million by other counts). Recognized: park strengthened safety amid a surge in visitors, Dec 2025. Queues: cable car lines in summer; Platteklip Gorge very busy on weekends. No access controls on the hiking routes.' },
  banff: { crowdIndicators: ['volume', 'recognized', 'controls', 'parking', 'queues'], howReach: ['trailhead', 'shuttle', 'lifts'],
    permits: 'Moraine Lake Road is closed to private vehicles from about 1 June to mid-October: visitors use the Parks Canada shuttle (reservation recommended), Roam Transit, a commercial bus or a taxi.',
    crowdEvidence: 'Volume: the town of Banff alone receives more than 4 million visitors a year; Banff National Park had about 694,000 visitors in July. Recognized: press coverage of Banff confronting overtourism (the-iceberg.org); Parks Canada acted on it. Controls: private vehicles banned on the Moraine Lake road since 2023, shuttle with reservations (cbc.ca). Parking: Moraine Lake lot full nearly 24 hours a day in summer, about 900 cars parked and more than 5,000 turned away a day; Johnston Canyon lot full with cars along the Bow Valley Parkway. Congestion: Johnston Canyon described as heavily crowded, July to September.' },
  'torres-del-paine': { crowdIndicators: ['controls'], howReach: ['trailhead', 'shuttle', 'boat'],
    permits: 'Park tickets are bought online in advance (at least 24 hours ahead if arriving by bus, tour or boat). The W and O treks need booked campsites or refugios, which sell out months ahead for December to February.',
    crowdEvidence: 'Controls: campsites and refugios on the W and O treks are booked in advance and capped; park tickets bought online. Volume below the line: about 367,000 visits in 2024 (about 1,000 a day across the park). Guides say crowds peak December to mid-February, but no documented congestion, parking overflow or queue figures were found.' },
  swissalps: { crowdIndicators: ['recognized'], howReach: ['lifts', 'train', 'fromTown'],
    crowdEvidence: 'Recognized: Zermatt ranks first in Switzerland for tourism intensity (overnight stays per resident), about five times Venice (Federal Statistical Office figures via welove2ski.com); 1.6 million overnight stays in 2024 for about 6,000 residents. No documented queues, access controls or parking overflow at the hiking sites were found.' },
  nepal: { crowdIndicators: ['recognized', 'queues'], howReach: ['flight', 'trailhead'],
    permits: 'Trekking permits and park or conservation fees are required (the Annapurna Conservation Area is about NPR 3,000, US$25 to 30, in 2026); permits are arranged through a licensed trekking agency.',
    crowdEvidence: 'Recognized: Lonely Planet and trekking press discuss overcrowding and litter on the Everest Base Camp route. Congestion: about 500 trekkers a day on the Everest trail in March to May and September to November (older article), dozens of Lukla flights a day, groups of 30 to 40 reported on the trail (2015). Volume below the line: about 40,000 a year to Everest Base Camp. No access controls on the walking trails.' },
  'tokyo-kyoto': { crowdIndicators: ['volume', 'recognized', 'queues'], howReach: ['train', 'lifts', 'fromTown'],
    permits: '',
    crowdEvidence: 'Volume: Mt Takao draws 2.5 to 3 million visitors a year and is often called the most visited mountain in the world. Recognized: press coverage of Kyoto overtourism, with the lower Fushimi Inari trail described as very crowded. Queues: the Takao cable car and chairlift queue 30 to 60 minutes on autumn weekends. No access controls or parking limits found.' },
  chicago: { crowdIndicators: ['volume', 'parking'], howReach: ['trailhead'],
    crowdEvidence: 'Volume: Starved Rock about 2.2 million visits in 2025, Indiana Dunes about 2.8 to 3.2 million. Parking: Starved Rock lots fill before 9am on peak days. No controls, no recognized problem, no queues documented.' },
};
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  for (const [placeId, add] of Object.entries(DATA)) {
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'hiking')));
    const before = (existing?.facts ?? {}) as Record<string, unknown>;
    const after = { ...before, ...add };
    if (!add.permits) delete (after as Record<string, unknown>).permits;
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'place_interest_fact', entityId: `${placeId}:hiking`, action: existing ? 'update' : 'create', before: existing ? { placeId, interestKey: 'hiking', facts: before } : null, after: { placeId, interestKey: 'hiking', facts: after },
      write: (tx) => tx.insert(placeInterestFacts).values({ placeId, interestKey: 'hiking', facts: after as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: after as never, updatedAt: new Date() } }) });
    console.log(placeId, 'crowding', add.crowdIndicators.length, 'of 5');
  }
  process.exit(0);
})();
