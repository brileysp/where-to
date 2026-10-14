import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Second-look corrections (8 Oct 2026). The first source check (7 Oct) got these wrong or incomplete; the review history says so.
// Usage: npx tsx scripts/whale-source-check-followup.ts
const NOTES: Record<string, string> = {
  azores: 'Round three, 8 Oct 2026: sei whales peak in April and May (a 2014 study of São Miguel vessel records put 54% of sei whale records there; the Pico operator says possible in June, rarely later). One travel guide says July to September, which the research and operators contradict. July to September are now led by sperm whales and dolphins, and the scores for those months came down from about 9.6 to about 8.',
  borabora: 'Round three, 8 Oct 2026: Tahiti Tourisme gives the humpback season as July to November (an operator quotes an official 20 July to 20 November window), peaking late August to October. October is now a peak month, not the tail, July is the opening month, and November is a shortened month. Bora Bora has its own whale tours, so it is named with Moorea and Tahiti.',
  gbr: 'Round three, 8 Oct 2026: the first check could not confirm "the world\'s only regulated in-water encounters". The sources do support the meaning for dwarf minke whales: James Cook University\'s Minke Whale Project calls the northern Great Barrier Reef the only known predictable gathering of the species, and the swim program is permitted (maximum nine permits, Code of Practice, 30 metre rule). The wording now says "only known predictable gathering" with permitted encounters.',
  falklands: 'Round three, 8 Oct 2026: the first check found no Stanley boat trips. Sulivan Shipping Services runs harbour launches from Stanley including whale watching, and Penguin Travel lists whale-watching launches, so boat trips from Stanley stay. Sei whales in Berkeley Sound are reported January to May (Falklands Conservation) and vary year to year. Orcas are best documented at Sea Lion Island hunting elephant seal pups, mostly October to December, not at penguin colonies; the text now says so.',
  taiwan: 'Round three, 8 Oct 2026: the first check found no source for pantropical spotted dolphins. Hualien operators and guides do list them with spinner and Risso\'s dolphins, so the text stays. Sperm whales have become more frequent since 2018 (24 of 163 tours in July 2026); short-finned pilot whales usually appear in late summer, so that cell now runs July to October.',
  komodo: 'Round three, 8 Oct 2026: whale sightings are anecdotal liveaboard reports (a sperm whale in September, a blue whale in late October 2025, melon-headed whales). Dry season is roughly April to November, not December. The text now names Risso\'s dolphins, limits whales to September to November, and treats December as the start of the wet season.',
  'charleston-savannah': 'Round three, 8 Oct 2026: strand feeding is seen July to September on Folly Beach trips, not through the whole warm season. Winter dolphin tour schedules could not be confirmed, so winter scores are a little lower. Right whales calve offshore of Georgia in winter but sightings are from survey aircraft and boats far offshore.',
  croatia: 'Round three, 8 Oct 2026: Blue World Institute recorded bottlenose dolphins around the southern Kornati and Telasica Nature Park (as many as 50 in a day in summer fieldwork), and a summer morning dolphin trip runs from Zadar. The best-studied dolphins are at Cres and Losinj in the north. Text updated; no whale trips exist.',
  maldives: 'Round three, 8 Oct 2026: blue whales pass the Maldives November to May (peaks December to January and April). Sperm whales are common, especially in the south, but sightings are chance. The text and cell now say so.',
  okinawa: 'Round three, 8 Oct 2026: Ministry of the Environment says humpbacks return from late December to about April, but tours vary by year: the 2016 season ran 27 December to 5 April, while 2022 and 2026 tours started in early January and finished 25 to 31 March. December and April are now edge months with low scores, and February is the peak.',
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
