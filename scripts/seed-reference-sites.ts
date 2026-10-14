// First entries for the "Reference sites" list on each interest's Expert reviews tab (Oct 2026).
// Safe to re-run: it only adds sites that are not on the list yet (matched by interest and address), so
// nothing typed on the admin page is overwritten. Scores are Claude's first judgement (authority,
// independence, how often the site held up) and are meant to be edited as the owner learns more.
// Last used and places checked come from the per-place source links (places.sliderSources) where the site
// appears there; the column-check sources used in Oct 2026 were not itemized by place, so they show 0.
//
// Verified 9 Oct 2026: each site was opened (or searched) to see what it really offers and whether Claude can read it. Findings are in the goodFor text.
//
// Usage: npx tsx scripts/seed-reference-sites.ts           (adds missing sites only)
//        npx tsx scripts/seed-reference-sites.ts --sync    (also overwrites score, access and notes on existing seeded sites, and applies REMOVE)
import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
  }
}

type Access = 'ai' | 'partial' | 'human';
interface Seed { interestKey: string; siteUrl: string; label: string; goodFor: string; usefulness: number; aiAccess: Access; lastUsedOn: string | null; placesChecked: number }
const SEEDS: Seed[] = [
  // Whale watching (places and dates counted from the saved source links)
  { interestKey: 'whaleWatching', siteUrl: 'https://wwhandbook.iwc.int', label: 'IWC Whale Watching Handbook', usefulness: 90, aiAccess: 'partial', lastUsedOn: '2026-10-08', placesChecked: 13,
    goodFor: 'International Whaling Commission country profiles with species tables, seasons, departure points and boat types: the best single source for confirming a country. Checked 9 Oct 2026: direct page reads return 403, but web search quotes the tables, so Claude can use it only through search. Coverage is by country, not every port.' },
  { interestKey: 'whaleWatching', siteUrl: 'https://www.nps.gov', label: 'National Park Service', usefulness: 85, aiAccess: 'ai', lastUsedOn: '2026-10-08', placesChecked: 2,
    goodFor: 'Official US park pages on seasons, species and cruises. Readable. US places only.' },
  { interestKey: 'whaleWatching', siteUrl: 'https://journal.iwc.int', label: 'IWC Journal of Cetacean Research and Management', usefulness: 72, aiAccess: 'ai', lastUsedOn: '2026-10-08', placesChecked: 4,
    goodFor: 'Scientific journal of the International Whaling Commission. Abstracts read fine and give dates, species and survey effort, but papers are often old (a 2005 survey published in 2008) and cover one area each.' },
  { interestKey: 'whaleWatching', siteUrl: 'https://www.seawatchfoundation.org.uk', label: 'Sea Watch Foundation', usefulness: 72, aiAccess: 'partial', lastUsedOn: '2026-10-08', placesChecked: 4,
    goodFor: 'UK charity with long-running, recent citizen sightings and respected funders. Text pages read fine, but the sightings map does not, and the readable pages have no species-by-season tables. Strong for UK and Irish waters only.' },
  { interestKey: 'whaleWatching', siteUrl: 'https://www.marinemammalhabitat.org', label: 'Important Marine Mammal Areas (IMMA) atlas', usefulness: 70, aiAccess: 'ai', lastUsedOn: '2026-10-08', placesChecked: 4,
    goodFor: 'Scientific factsheets on where marine mammals live, with species and seasons, from the IUCN marine mammal protected areas task force. Readable, but dated (pages marked 2016-2020, newest sources about 2014-2015) and light on survey methods. Strong on habitat, not on boat trips.' },
  { interestKey: 'whaleWatching', siteUrl: 'https://oceanwide-expeditions.com', label: 'Oceanwide Expeditions', usefulness: 35, aiAccess: 'ai', lastUsedOn: '2026-10-08', placesChecked: 3,
    goodFor: 'Polar expedition operator guides give general species by month on polar cruises. Checked 9 Oct 2026: a marketing page with no author and no sources. Use only for rough polar timing and confirm elsewhere.' },
  { interestKey: 'whaleWatching', siteUrl: 'https://sealifeguide.com', label: 'Sea Life Guide', usefulness: 30, aiAccess: 'ai', lastUsedOn: '2026-09-16', placesChecked: 16,
    goodFor: 'Editorial guides funded by tour-booking commissions (Viator links), North America focused, with unsourced figures and inconsistencies (one page gives the right whale season as June-November and later June-December). A first lead only. It is logged on 16 places, many outside North America (Lofoten, Belize and others): those entries need review.' },
  // Birding
  { interestKey: 'birding', siteUrl: 'https://www.ebird.org', label: 'eBird (Cornell Lab of Ornithology)', usefulness: 95, aiAccess: 'human', lastUsedOn: null, placesChecked: 0,
    goodFor: 'The reference for checklists, species counts and seasonality by hotspot and region. Checked 9 Oct 2026: the website blocks automated reads (a bot-check page), so a person has to look things up. Claude can only reach eBird\'s public species-names file, which is useful for names but not for counts.' },
  { interestKey: 'birding', siteUrl: 'https://merlin.allaboutbirds.org', label: 'Merlin Bird ID (Cornell Lab)', usefulness: 65, aiAccess: 'human', lastUsedOn: null, placesChecked: 0,
    goodFor: 'Free app and site with species lists by location and week. Checked 9 Oct 2026: the website returns 403 to automated reads, so a person has to use it. Best for a quick view of which species are likely at a place and time of year.' },
  { interestKey: 'birding', siteUrl: 'https://datazone.birdlife.org', label: 'BirdLife DataZone', usefulness: 80, aiAccess: 'partial', lastUsedOn: '2026-10-06', placesChecked: 0,
    goodFor: 'Authoritative country and site factsheets: endemic bird areas, threatened species, Important Bird Areas. Checked 9 Oct 2026: the pages load their numbers with scripts, so Claude sees labels but no figures; use it through search results or by hand. Used for the endemic-species check (places not itemized).' },
  { interestKey: 'birding', siteUrl: 'https://www.nps.gov', label: 'National Park Service bird lists', usefulness: 85, aiAccess: 'ai', lastUsedOn: '2026-10-06', placesChecked: 0,
    goodFor: 'Official species counts for US parks (the birds page of each park; Grand Canyon: nearly 450 species). Readable. US parks only. Used for the species-count check (places not itemized).' },
  { interestKey: 'birding', siteUrl: 'https://birdfamiliesoftheworld.com', label: 'Bird Families of the World', usefulness: 70, aiAccess: 'ai', lastUsedOn: '2026-10-06', placesChecked: 0,
    goodFor: 'Lists of bird families found only on an island or country, following the Clements/eBird v2023 taxonomy. Readable and clear, but a single-person site with no update date, so newer taxonomy changes may be missing. Used for the endemic-family check (places not itemized).' },
  { interestKey: 'birding', siteUrl: 'https://en.wikipedia.org/wiki/Lists_of_birds_by_region', label: 'Wikipedia lists of birds by country', usefulness: 70, aiAccess: 'ai', lastUsedOn: '2026-10-06', placesChecked: 0,
    goodFor: 'Per-country species and endemic counts that follow the Clements checklist, with numbered footnotes (Madagascar: 311 species, 109 endemic). Readable; the sources behind the footnotes are not shown on the page, so treat it as a good first check. Used for the species-count and endemic checks (places not itemized).' },
  { interestKey: 'birding', siteUrl: 'https://www.10000birds.com', label: '10,000 Birds', usefulness: 60, aiAccess: 'ai', lastUsedOn: '2026-09-16', placesChecked: 1,
    goodFor: 'Birding blog with about two dozen contributors, very current. Readable; location posts exist, but the front pages do not show species-and-season detail, so it is a lead for hotspots and trip stories, not a source for counts.' },
  // Safari
  { interestKey: 'safari', siteUrl: 'https://www.safaribookings.com', label: 'SafariBookings', usefulness: 50, aiAccess: 'ai', lastUsedOn: '2026-09-16', placesChecked: 7,
    goodFor: 'Best-time-to-visit and park pages by named experts (the Kruger page is by Philip Briggs, a Rough Guides author). Readable, but seasons are given as dry and wet or high and low season rather than by month, wildlife claims have no sighting rates or sources, and it is a tour marketplace.' },
  // Wind sports
  { interestKey: 'windSports', siteUrl: 'https://wind-hounds.com', label: 'Wind-Hounds', usefulness: 40, aiAccess: 'ai', lastUsedOn: '2026-09-16', placesChecked: 16,
    goodFor: 'Spot guides and a directory of schools and shops by destination. Checked 9 Oct 2026: no month-by-month wind statistics on the pages we could read (one monthly table, for Fuerteventura), and the Tarifa pages are about six years old. It is the only source behind 16 of the 17 logged checks, which is too thin.' },
  // Wildflower blooms
  { interestKey: 'wildflowerBlooms', siteUrl: 'https://www.nps.gov', label: 'National Park Service', usefulness: 80, aiAccess: 'ai', lastUsedOn: '2026-09-16', placesChecked: 2,
    goodFor: 'Official park bloom and season pages. US places only. Link the exact page for each park (a guessed address returned 404).' },
];
// Listed by mistake: 2seewhales.com is one Long Beach and Los Angeles tour operator (Harbor Breeze Cruises), not a guide.
const REMOVE: Array<{ interestKey: string; siteUrl: string }> = [{ interestKey: 'whaleWatching', siteUrl: 'https://2seewhales.com' }];

async function main() {
  loadEnv();
  const { db } = await import('../src/lib/db/client');
  const { interestReferenceSites } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const SYNC = process.argv.includes('--sync');
  let added = 0, skipped = 0, synced = 0, removed = 0;
  for (const s of SEEDS) {
    const [ex] = await db.select().from(interestReferenceSites).where(and(eq(interestReferenceSites.interestKey, s.interestKey), eq(interestReferenceSites.siteUrl, s.siteUrl)));
    if (ex) {
      if (SYNC) {
        const set = { label: s.label, goodFor: s.goodFor, usefulness: s.usefulness, aiAccess: s.aiAccess };
        await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_reference_site', entityId: ex.id, action: 'update', before: ex, after: { ...ex, ...set }, write: (tx) => tx.update(interestReferenceSites).set({ ...set, updatedAt: new Date() }).where(eq(interestReferenceSites.id, ex.id)).returning() });
        synced++;
      } else skipped++;
      continue;
    }
    const values = { ...s, createdBy: CLAUDE_ACTOR.email };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_reference_site', entityId: `${s.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReferenceSites).values(values).returning() });
    added++;
  }
  if (SYNC) {
    for (const r of REMOVE) {
      const [ex] = await db.select().from(interestReferenceSites).where(and(eq(interestReferenceSites.interestKey, r.interestKey), eq(interestReferenceSites.siteUrl, r.siteUrl)));
      if (!ex) continue;
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_reference_site', entityId: ex.id, action: 'delete', before: ex, after: null, write: (tx) => tx.delete(interestReferenceSites).where(eq(interestReferenceSites.id, ex.id)) });
      removed++;
    }
  }
  console.log(`Added ${added}, already there ${skipped}, synced ${synced}, removed ${removed}.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
