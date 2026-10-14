import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Second-look corrections (8 Oct 2026). The first source check (7 Oct) got these wrong or incomplete; the review history says so.
// Usage: npx tsx scripts/whale-source-check-followup.ts
const NOTES: Record<string, string> = {
  'scottish-highlands-skye': 'Second look, 8 Oct 2026: the first check said common dolphins were unsourced. Long-term Sea Watch records show short-beaked common dolphins are the commonest animals in the Skye and Minch area (about 55% of individuals), with harbor porpoises the most records and minke whales next. Text left unchanged. Hebridean Whale and Dolphin Trust winter reports also put humpbacks around Skye.',
  palawan: 'Second look, 8 Oct 2026: the first check could not confirm early-morning trips or bottlenose dolphins. Puerto Princesa dolphin spotters do head out early in the morning, and tourism sources list bottlenose, spotted and Risso\'s dolphins in the bays. Text left unchanged. Spinner dolphins are the documented species (the tour is run by the Barangay Tulingan Fishermen\'s Association).',
  bali: 'Second look, 8 Oct 2026: the first check said the Lombok Strait whale mention was unsupported. Lovina tour descriptions cite pilot whales and Bryde\'s whales as occasional sightings, and strandings show the route is used, so the hedged "chance encounters" wording stays.',
  belize: 'Second look, 8 Oct 2026: a review of Belize records lists 15 cetacean species including sperm, short-finned pilot and false killer whales (a pod of false killer whales was in the reef near Drown Caye), so "chance sightings of sperm or pilot whales" stays. Dolphin season is not documented beyond the general dry season.',
  antarctica: 'Second look, 8 Oct 2026: fin whales are real but not a headline: guides place them mostly in deeper water around the South Shetlands, the Bransfield area and the Drake Passage. Humpbacks, minke whales and orcas lead the text now.',
  'monterey-big-sur': 'Second look, 8 Oct 2026: NOAA places blue whales in the sanctuary from May to December (adults mainly May to September) and operators say June to November, but presence varies with krill from year to year. Text now says blue whales are seen in some summers and falls; the cell is "possible".',
  svalbard: 'Second look, 8 Oct 2026: the International Whaling Commission lists blue, fin, humpback and minke whales on day trips from Longyearbyen (May to September), a dedicated blue whale charter runs in June and July, and blue whale sightings have risen in recent years. So blue whales stay in the text as a possible prize, with minke and fin whales the regulars.',
  'nice-riviera': 'Second look, 8 Oct 2026: fin whales are the large whale operators find; sperm whales are mostly single males seen from August on; pilot whales are common in some multi-year Pelagos studies but rare in one operator\'s recent logs. Beaulieu-sur-Mer and Monaco small boats sail year-round, so winter months are no longer described as halted.',
  mauritius: 'Second look, 8 Oct 2026: sperm whales (resident and transient, 38 individuals in a photo catalogue) off the west coast and humpbacks July to October are confirmed. Humpback breeding is better documented at Reunion than Mauritius and success rates come only from operators (60% to 90% claims), so the text now says "often" and "sometimes" instead of "regularly find both".',
  greenland: 'Second look, 8 Oct 2026: humpbacks (July to September) are the main target around Ilulissat and Nuuk. Fin and minke whales are listed for Disko Bay and are more prominent in South Greenland; Nuuk sources name humpbacks and minke whales only. Text adjusted.',
  tuscany: 'Second look, 8 Oct 2026: Viareggio (CE.TU.S. research catamaran) and Elba (Marina di Campo, 5.5 hours with a marine biologist) both run trips; the International Whaling Commission gives fin whale peak viewing as May to August. Fin whales are possible, striped dolphins the usual sighting, sperm whales rare. Peak lowered from 5.5 to 4.8.',
  mallorca: 'Second look, 8 Oct 2026: sunrise trips from Alcudia and Port de Pollenca exist but the listings name no species. Bottlenose dolphins are the coastal species and striped dolphins the commonest offshore; Risso\'s dolphins stay offshore and have become scarce near the coast. Text now names bottlenose and striped dolphins.',
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
