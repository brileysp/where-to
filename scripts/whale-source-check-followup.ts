import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Second-look corrections (8 Oct 2026). The first source check (7 Oct) got these wrong or incomplete; the review history says so.
// Usage: npx tsx scripts/whale-source-check-followup.ts
const NOTES: Record<string, string> = {
  okinawa: 'Second look, 8 Oct 2026: the first check said boats leave from Zamami, not Naha. That was wrong. Half-day whale tours also leave from Naha (via Mie-gusuku Port) as well as from Zamami; the live text now names both. Official Zamami season is 8 Jan to 25 Mar and Naha operators run about 12 Jan to 31 Mar, so late December and April in the live text are looser than the sources.',
  hokkaido: 'Second look, 8 Oct 2026: the first check could not find Muroran minke whale trips. They exist (Star Marine, June to mid-August, minke whales, Dall\'s porpoises, sometimes orcas), so Muroran stays in the text; only the September mention was removed because those cruises end in mid-August.',
  'cape-town': 'Second look, 8 Oct 2026: Heaviside\'s dolphins are most frequently reported around Cape Town and stay in the text; the dusky dolphin mention was removed because no source supports it near Cape Town.',
  sardinia: 'Second look, 8 Oct 2026: the first check found no Alghero dolphin trip. Progetto Natura Alghero runs a three-hour dolphin-watching outing, so Alghero stays in the text. Species on that trip are not named in the listings.',
  puglia: 'Second look, 8 Oct 2026: the Jonian Dolphin Conservation catamaran leaves from Taranto itself, and other operators leave from Marina di Ginosa, so both ports are named. Trips and research run all year; the live text no longer limits sightings to May to September.',
  angkor: 'Second look, 8 Oct 2026: besides the Kampot and Kep coast (Irrawaddy and Indo-Pacific humpback dolphins, best encounter rates May to November), Cambodia has the best-known dolphin watching on the Mekong at Kratie (Irrawaddy dolphins, best in the dry season, roughly November to March). The live text now covers both; the old text said there were no dedicated trips.',
  redwood: 'Second look, 8 Oct 2026: the park service names November to December and March to April as peaks, while regional sources put the southbound peak at December to mid-January and mothers and calves into May. The live text now says late November to January and March to April, with mothers and calves into May, plus a few resident whales near the Klamath River mouth.',
  nyc: 'Second look, 8 Oct 2026: American Princess Cruises sails from Riis Landing in the Rockaways (Queens); older trips also left from Sheepshead Bay in Brooklyn. A Manhattan shuttle to the Rockaways existed once. The live text now names Riis Landing in the Rockaways only.',
  'tierra-del-fuego': 'Second look, 8 Oct 2026: scoped to Ushuaia and the Beagle Channel only (the first check wrongly pointed at Punta Arenas, which is a different place). Humpbacks have been returning to the channel since about 2018 (208 individuals catalogued since 2013), sei whales are reported seasonally and orcas occasionally, but standard cruises feature sea lions, cormorants and penguins and the International Whaling Commission calls cetacean sightings sporadic. Peale\'s dolphins are the likelier sighting; Commerson\'s dolphins are listed mainly for Santa Cruz province.',
  nicaragua: 'Second look, 8 Oct 2026: two seasons confirmed. Northern-hemisphere (Central America) humpbacks breed off the Pacific coast January to April (surveys November to April; calves and singers January to April), and southern-hemisphere humpbacks pass July to October, peaking in August, at the northern edge of their range. The live text now shows both, with the northern season the stronger.',
};
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestReviews } = await import('../src/lib/db/schema');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const today = new Date().toISOString().slice(0, 10);
  for (const [placeId, notes] of Object.entries(NOTES)) {
    const values = { interestKey: 'whaleWatching', placeId, reviewerName: 'Claude (second look)', reviewerRole: 'AI: Claude', reviewedOn: today, notes, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: 'whaleWatching:new', action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  console.log('logged', Object.keys(NOTES).length);
  process.exit(0);
})();
