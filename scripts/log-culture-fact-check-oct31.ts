// SUPERSEDED the same day: the owner does not want a source stored per sentence, only the corrected results and one dated note with the sources used. The sentence rows this wrote were deleted;
// the whole-interest and per-place notes in interest_reviews are what stay. Kept only as the list of sources used per check (MANUAL). Do not re-run with --apply.
// 31 Oct 2026: records the Museums & Art and Architecture fact check (owner: "log what was done into the app's log").
// For every Gemini-written cell of the two interests it (1) records each risky sentence of the LIVE text in content_fact_checks (unchecked unless a check was done),
// (2) marks 'verified' only where a source was actually used: a hand check of that sentence (MANUAL below, source link per entry), or a sentence that only names
// venues, every one of which was found in the Overture Maps places file as open, or as a Wikipedia article in the right area (scripts/data/venue-evidence-oct31.json),
// (3) writes interest_reviews notes: one for each of the two interests, and one for each place whose text had to be corrected.
// Sentences nobody checked stay 'unchecked' on purpose. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/log-culture-fact-check-oct31.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const INTERESTS = ['museumsArt', 'architecture'];
const BY = 'Claude (web source check, 31 Oct 2026)';
const OVERTURE = 'https://docs.overturemaps.org/guides/places/';
// Hand checks: any claim whose sentence contains one of the `has` strings (in the cell `id`, when given) is verified against `url`.
type Manual = { has: string[]; id?: string; url: string; note: string };
const MANUAL: Manual[] = [
  { has: ['Long Night of Museums'], url: 'https://www.dhm.de/lange-nacht-der-museen', note: 'Berlin Long Night of Museums is held in late August (29 Aug 2026), evening openings across the city.' },
  { has: ['first Thursday of every month'], id: 'cape-town', url: 'https://www.dailymaverick.co.za/article/2024-12-08-first-thursdays-marks-start-of-cape-towns-festive-cheer', note: 'Cape Town First Thursdays: central galleries stay open late on the first Thursday of every month.' },
  { has: ['Art Walk', 'Gallery District'], id: 'los-cabos', url: 'https://thecabosun.com/last-chance-for-culture-san-jose-del-cabos-famous-art-walk-wraps-up-its-season-in-june/', note: 'San José del Cabo Art Walk runs Thursday evenings November to June; streets closed to cars; summer hiatus.' },
  { has: ['First Friday Art Walk'], id: 'bend-crater-lake', url: 'https://bendbulletin.com/?p=994513', note: 'Bend First Friday Gallery Walk is held on the first Friday of each month.' },
  { has: ['Zona Maco'], url: 'https://hyperallergic.com/541617/taking-in-local-projects-at-zona-maco-latin-americas-largest-art-fair/', note: 'Zona Maco is held each February in Mexico City and is described as Latin America\'s largest art fair (the fair\'s own claim, repeated in press).' },
  { has: ['Aruba Art Fair'], url: 'https://www.aruba.com/us/news/aruba-art-fair-2026-when-san-nicolas-becomes-a-living-gallery', note: 'Annual Aruba Art Fair in San Nicolas (2026: 11-13 Sept), artists paint murals during it; murals stay up all year.' },
  { has: ['cable car', 'MMM Corones', 'Messner Mountain Museum Corones', 'Oberholz', 'ski lifts'], id: 'dolomites', url: 'https://messner-mountain-museum.it/en/corones/visit/', note: 'MMM Corones follows the lift seasons (late May to early Nov, late Nov to mid-April), by Zaha Hadid; Oberholz Mountain Hut by Peter Pichler is a timber restaurant at the Obereggen lift station (https://peterpichler.eu/project/13-oberholz-mountain-hut).' },
  { has: ['Lotte World Tower'], url: 'https://www.skyscrapercenter.com/building/lotte-world-tower/88', note: 'CTBUH lists Lotte World Tower at 554.5 m / 1,819 ft.' },
  { has: ['largest concentration of colonial-era buildings'], url: 'https://en.wikipedia.org/wiki/Yangon', note: 'Wikipedia: Yangon has the largest number of colonial-era buildings in Southeast Asia (a widely repeated claim, no systematic count).' },
  { has: ['Chapel of the Holy Cross'], url: 'https://www.atlasobscura.com/places/chapel-of-the-holy-cross', note: 'Completed 1956, funded and conceived by Marguerite Brunswig Staude, with a 90-foot cross built into the facade.' },
  { has: ['Shelburne Museum closes'], url: 'https://shelburnemuseum.org/calendar/2025-12-01', note: 'Museum calendar: main campus closed for the season in winter, reopens in May. Pizzagalli Center is the year-round building.' },
  { has: ['Moraine Park Discovery Center'], url: 'https://www.recreation.gov/camping/poi/259198', note: 'Moraine Park Discovery Center is seasonal: open late May to early October, closed in winter.' },
  { has: ['Chapel in the Hills'], url: 'https://chapel-in-the-hills.org/about.html', note: 'Chapel in the Hills (Rapid City) is a seasonal site, May to September, with limited autumn dates.' },
  { has: ['Vogtsbauernhof'], url: 'https://en.wikipedia.org/wiki/Black_Forest_Open_Air_Museum', note: 'The open-air museum opens about seven months a year, not in winter (except the Christmas market).' },
  { has: ['Casa Madsen'], url: 'https://elchalten.com/v4/en/madsen-old-house-guided-tour-el-chalten.php', note: 'Casa Madsen is a house-museum for Andreas Madsen, an early El Chaltén settler, visited on guided tours.' },
  { has: ['Pablo Fierro'], url: 'https://www.interpatagonia.com/puertovaras/museo-pablo-fierro_i.html', note: 'Museo Pablo Fierro is an eclectic private museum on the Puerto Varas waterfront.' },
  { has: ['Coral Museum'], url: 'https://www.summerinitaly.com/guide/coral-museum-of-ravello', note: 'Coral Museum (Museo del Corallo) is in Ravello, Piazza Duomo 9.' },
  { has: ['Williams Cottage'], url: 'https://www.heritage.org.nz/the-list/details/2336', note: 'Williams Cottage is Queenstown\'s oldest remaining cottage, on the waterfront.' },
  { has: ['Museo della Carta'], url: 'https://www.amalfipapermuseum.com/?p=4666', note: 'Museum site: open in winter with reduced days (Friday to Sunday in January and February).' },
  { has: ["Scotty's Castle"], url: 'https://www.nps.gov/deva/learn/news/scottys-castle-tours-2026-2027.htm', note: 'NPS: Scotty\'s Castle interior still closed; limited ranger-led ground tours October 2026 to April 2027; full reopening not before November 2028.' },
  { has: ['Dark Mofo'], url: 'https://www.discovertasmania.com.au/things-to-do/festivals-and-events/darkmofo2026/', note: 'Dark Mofo, MONA\'s midwinter festival in Hobart, ran 11-22 June 2026.' },
  { has: ['Edinburgh Art Festival'], url: 'https://www.edinburghfestivalcity.com/inspiration/637-introducing-edinburgh-art-festival-2026', note: 'Edinburgh Art Festival runs through August (14-30 Aug 2026).' },
  { has: ['Singapore Art Week'], url: 'https://www.nac.gov.sg/about-us/media-centre/press-releases/singapore-art-week-2026---the-region-s-pinnacle-visual-arts-season-to-experience--the-best-of-southeast-asian-art', note: 'Singapore Art Week ran 22-31 Jan 2026; ART SG 23-25 Jan 2026.' },
  { has: ['Berlin Art Week'], url: 'https://www.berlinartweek.de/en/about-berlin-art-week/', note: 'Berlin Art Week 2026 ran 9-13 September.' },
  { has: ['Artissima'], url: 'https://www.artissima.art/en/about/', note: 'Artissima is held in Turin around the turn of October and November (2026: 30 Oct to 1 Nov).' },
  { has: ['Modernism Week'], url: 'https://www.modernismweek.com/', note: 'Modernism Week is an 11-day festival in February (12-22 Feb 2026); a shorter edition runs in October.' },
  { has: ['Art Basel'], url: 'https://ocula.com/art-galleries/shanghart/art-fairs/art-basel-hong-kong-2026/', note: 'Art Basel Hong Kong 2026: 27-29 March, with Art Central 25-29 March.' },
  { has: ['Kochi-Muziris Biennale'], url: 'https://canvasonline.com/event/6th-kochi-muziris-biennale/', note: 'Sixth Kochi-Muziris Biennale ran 12 Dec 2025 to 31 Mar 2026; held every two years.' },
  { has: ['Istanbul Biennial'], url: 'https://canvasonline.com/event/istanbul-biennial-2025/', note: '18th Istanbul Biennial opened 20 Sept 2025 (autumn), with further legs in 2026 and 2027; no fixed odd-year pattern.' },
  { has: ['Venice Art Biennale', 'Venice Biennale'], url: 'https://www.labiennale.org/en/news/biennale-arte-2026-take-place-9-may-22-november', note: 'The 61st Venice Art Biennale runs 9 May to 22 Nov 2026; Art editions fall in even years (2022, 2024, 2026).' },
  { has: ['Chale Wote'], url: 'https://www.abhmuseum.org/events/chale-wote-art-festival-2026/', note: 'Chale Wote Street Art Festival, Jamestown, Accra, runs in mid-August.' },
  { has: ['Old Town Art Fair'], url: 'https://www.chicagogallerynews.com/events/old-town-art-fair-2026', note: 'Old Town Art Fair is held in mid-June (13-14 June 2026).' },
  { has: ["Montreal's Mural Festival"], url: 'https://www.bonjourquebec.com/en-us/listing/events/festival-mural/0sdg', note: 'MURAL Festival, Montreal, runs in early June (4-14 June 2026).' },
  { has: ['Charleston Festival'], url: 'https://www.historiccharleston.org/events/the-charleston-festival-2026', note: 'Historic Charleston Foundation\'s Charleston Festival (formerly the Festival of Houses and Gardens) ran 18 March to 11 April 2026.' },
  { has: ['Fall Tours'], url: 'https://www.charlestoncvb.com/events/the-fall-tours-of-homes-history-architecture~13729', note: 'Preservation Society of Charleston Fall Tours run through October into early November.' },
  { has: ['Sedona Arts Festival', 'Plein Air Festival'], url: 'https://visitsedona.com/events-calendar/sedona-arts-festival1/', note: 'Sedona Arts Festival 10-11 Oct 2026; Plein Air Festival 16-24 Oct 2026.' },
  { has: ['Friday night', 'Gallery Stroll', 'weekly Friday'], id: 'cape-cod-islands', url: 'https://ptowntourism.com/arts-and-culture/', note: 'Provincetown galleries open on Friday evenings, May to October.' },
  { has: ['Soo Locks'], url: 'https://www.wxyz.com/news/soo-locks-closing-jan-15-for-winter-maintenance-heres-where-new-lock-construction-stands', note: 'The Soo Locks close to ships from 15 January to about 25 March each winter.' },
  { has: ['closed for restoration'], id: 'acadia', url: 'https://en.wikipedia.org/wiki/Abbe_Museum', note: 'Abbe Museum\'s Sieur de Monts location is closed for restoration, reopening targeted for 2028. Replaced an earlier sentence that said it was open May-October.' },
  { has: ['Moab Museum typically closes'], id: 'arches-canyonlands', url: 'https://www.discovermoab.com/places-to-go/moabinwinter/whats-closed-in-the-winter-in-moab/', note: 'Moab Museum closes about 23 Dec to 10 Feb every winter. Tom Till Gallery (named in the earlier text) is permanently closed.' },
  { has: ['Guy Bradley Visitor Center'], id: 'everglades', url: 'https://local10.com/news/local/2023/07/14/pink-palace-in-the-everglades-open-again-years-after-being-destroyed-by-hurricane-irma', note: 'Hurricane Irma destroyed the pink Flamingo Visitor Center in 2017; the rebuilt Guy Bradley Visitor Center opened in July 2023. Replaced a sentence calling it recently restored.' },
  { has: ['Kykuit'], id: 'hudson-valley', url: 'https://hudsonvalley.org/historic-sites/kykuit-the-rockefeller-estate/', note: 'Kykuit tours are on hiatus for 2026. Kykuit was removed from the text.' },
  { has: ['reduced winter schedule'], id: 'hudson-valley', url: 'https://www.nps.gov/vama/planyourvisit/hours.htm', note: 'Vanderbilt Mansion tours run through winter with fewer per day (visitor guides; check the NPS hours page).' },
  { has: ['Bailey House', 'August 2023 wildfire'], id: 'maui', url: 'https://mauinow.com/2026/04/06/hawaiian-moment-baldwin-house/', note: 'The Baldwin Home in Lahaina was gutted in the August 2023 wildfire and is still closed; Bailey House Museum (Wailuku) is open Tuesday to Friday (https://mauimuseum.org/museum-history).' },
  { has: ['Art Dubai'], id: 'dubai', url: 'https://graziamagazine.com/me/articles/art-dubai-2026-new-dates/', note: 'Art Dubai normally runs in April; the 2026 edition was moved to mid-May. Replaced a sentence that said March.' },
  { has: ['Santa Marta, founded in 1525'], id: 'colombian-caribbean', url: 'https://roughguides.com/colombia/cartagena-caribbean/santa-marta-around', note: 'Santa Marta was founded in 1525 and is one of the oldest surviving Spanish-founded cities in South America; its early buildings were largely lost to pirates.' },
  { has: ['Dark Mofo'], id: 'tasmania', url: 'https://www.discovertasmania.com.au/things-to-do/festivals-and-events/darkmofo2026/', note: 'Dark Mofo, 11-22 June 2026. Mona Foma ended in February 2024 and was removed from the text (https://en.wikipedia.org/wiki/Mona_Foma).' },
];
const CORRECTED: Array<{ k: string; id: string; what: string; src: string }> = [
  { k: 'museumsArt', id: 'acadia', what: 'Abbe Museum Sieur de Monts is closed for restoration (reopening about 2028); the text said it was open May to October.', src: 'https://en.wikipedia.org/wiki/Abbe_Museum' },
  { k: 'museumsArt', id: 'arches-canyonlands', what: 'Tom Till Gallery is permanently closed and the Moab Museum closes about 23 Dec to 10 Feb; the text named the gallery and promised consistent hours all year.', src: 'https://www.discovermoab.com/places-to-go/moabinwinter/whats-closed-in-the-winter-in-moab/' },
  { k: 'museumsArt', id: 'andalucia', what: 'CAC Málaga was folded into MuCAC Málaga; the old name was removed.', src: 'https://malaga.eu/visorcontenido/ANUDocumentDisplayer/174411/COMUNICADO.pdf' },
  { k: 'museumsArt', id: 'tasmania', what: 'Mona Foma ended in February 2024; removed from text, January and February scores lowered from 7.9 / 7.8 to 7.2 / 7.0.', src: 'https://en.wikipedia.org/wiki/Mona_Foma' },
  { k: 'museumsArt', id: 'dubai', what: 'Art Dubai is held in April (May in 2026), not March; text corrected, March score lowered from 6.3 to 6.0.', src: 'https://graziamagazine.com/me/articles/art-dubai-2026-new-dates/' },
  { k: 'museumsArt', id: 'argentine-lake-district', what: 'La Pastera (Che Guevara museum) was ordered closed in May 2025; removed.', src: 'https://www.noticiasnqn.com.ar/amp/noticias/2025/05/07/313119-el-gobierno-revoco-a-ate-el-manejo-del-edificio-la-pastera-en-el-parque-lanin' },
  { k: 'museumsArt', id: 'borabora', what: 'Galerie des Tropiques (Papeete) could not be confirmed to exist; removed.', src: 'https://www.virtualtourist.com/travel/Australia_and_Oceania/French_Polynesia/Papeete-1907543/Things_To_Do-Papeete-TG-C-1.html' },
  { k: 'museumsArt', id: 'nepal', what: 'Taragaon Museum is now Taragaon Next; both names given.', src: 'https://en.wikipedia.org/wiki/Taragaon_Museum' },
  { k: 'museumsArt', id: 'venice', what: 'Venice Art Biennale is held in even-numbered years (2026), not odd; text corrected.', src: 'https://www.labiennale.org/en/news/biennale-arte-2026-take-place-9-may-22-november' },
  { k: 'museumsArt', id: 'istanbul', what: 'The Istanbul Biennial no longer follows an odd-year pattern (18th edition runs in legs 2025-2027); wording changed.', src: 'https://canvasonline.com/event/istanbul-biennial-2025/' },
  { k: 'architecture', id: 'colombian-caribbean', what: 'Santa Marta\'s early buildings were largely lost; text now claims only the 1525 city.', src: 'https://roughguides.com/colombia/cartagena-caribbean/santa-marta-around' },
  { k: 'architecture', id: 'everglades', what: 'The Flamingo Visitor Center was destroyed by Hurricane Irma and rebuilt as the Guy Bradley Visitor Center (2023); text said recently restored.', src: 'https://local10.com/news/local/2023/07/14/pink-palace-in-the-everglades-open-again-years-after-being-destroyed-by-hurricane-irma' },
  { k: 'architecture', id: 'hudson-valley', what: 'Kykuit tours are on hiatus in 2026; the Vanderbilt Mansion runs winter tours. Text changed.', src: 'https://hudsonvalley.org/historic-sites/kykuit-the-rockefeller-estate/' },
  { k: 'architecture', id: 'maui', what: 'The Baldwin Home in Lahaina was gutted in the 2023 wildfire; text now points to Wailuku and says Lahaina is rebuilding.', src: 'https://mauinow.com/2026/04/06/hawaiian-moment-baldwin-house/' },
  { k: 'architecture', id: 'charleston-savannah', what: 'The Festival of Houses and Gardens is now called the Charleston Festival; name updated.', src: 'https://www.historiccharleston.org/events/the-charleston-festival-2026' },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places, interestReviews } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { claimKinds, hashSentence, splitSentences } = await import('../src/lib/gemini/claims');
  const { syncClaims, recordVerdicts } = await import('../src/lib/gemini/fact-check');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const evidence = JSON.parse(readFileSync(join(__dirname, 'data', 'venue-evidence-oct31.json'), 'utf8')) as Record<string, Record<string, { s: string; t?: string }>>;
  const rows = await db.select().from(places);
  const stats: Record<string, { cells: number; claims: number; verified: number; byManual: number; byVenue: number }> = {};
  for (const k of INTERESTS) stats[k] = { cells: 0, claims: 0, verified: 0, byManual: 0, byVenue: 0 };
  for (const r of rows) {
    for (const k of INTERESTS) {
      const meta = ((r.sliderOverviewMeta as Record<string, { origin?: string }>) ?? {})[k];
      if (meta?.origin !== 'gemini') continue;
      const ov = ((r.sliderOverview as Record<string, string>) ?? {})[k] ?? '';
      const mo = ((r.sliderMonthlyWeather as Record<string, string[]>) ?? {})[k] ?? [];
      const seen = new Map<string, { sentence: string; kinds: string[]; entities: string[]; where: string[] }>();
      const texts: Array<[string, string]> = [['overview', ov], ...mo.map((m, i) => [String(i + 1), m] as [string, string])];
      for (const [where, text] of texts) for (const s of splitSentences(text)) {
        const ck = claimKinds(s, r.name); if (!ck.kinds.length) continue;
        const h = hashSentence(s); const e = seen.get(h);
        if (e) { if (!e.where.includes(where)) e.where.push(where); } else seen.set(h, { sentence: s, kinds: ck.kinds, entities: ck.entities, where: [where] });
      }
      const claims = [...seen.entries()].map(([hash, c]) => ({ hash, ...c })) as never[];
      const verdicts: Record<string, { verdict: 'verified'; sourceUrl: string; note: string }> = {};
      const ev = evidence[`${k}|${r.id}`] ?? {};
      for (const [hash, c] of seen) {
        const m = MANUAL.find((x) => (!x.id || x.id === r.id) && x.has.some((h) => c.sentence.includes(h)));
        if (m) { verdicts[hash] = { verdict: 'verified', sourceUrl: m.url, note: m.note }; stats[k].byManual++; continue; }
        if (c.kinds.length === 1 && c.kinds[0] === 'named' && c.entities.length && c.entities.every((n) => ev[n])) {
          const first = ev[c.entities[0]];
          const how = c.entities.map((n) => (ev[n].s === 'overture' ? `${n}: listed as an open venue in the Overture Maps places file (release 2026-10-21.0)` : `${n}: Wikipedia article "${ev[n].t}" in the right area`)).join('; ');
          verdicts[hash] = { verdict: 'verified', sourceUrl: first.s === 'wiki' ? `https://en.wikipedia.org/wiki/${encodeURIComponent((first.t ?? '').replace(/ /g, '_'))}` : OVERTURE, note: `Named venues exist and are operating. ${how}` };
          stats[k].byVenue++;
        }
      }
      stats[k].cells++; stats[k].claims += seen.size; stats[k].verified += Object.keys(verdicts).length;
      if (apply) {
        await syncClaims(r.id, k, claims);
        const problems = await recordVerdicts(r.id, k, verdicts, BY);
        if (problems.length) console.log('PROBLEMS', r.id, k, problems.slice(0, 3));
      }
    }
  }
  console.log(JSON.stringify(stats));
  // review notes
  const today = '2026-10-31';
  const existing = await db.select().from(interestReviews).where(eq(interestReviews.reviewerName, BY));
  const have = new Set(existing.map((e) => `${e.interestKey}|${e.placeId ?? ''}`));
  const entries: Array<{ interestKey: string; placeId: string | null; notes: string }> = [];
  for (const k of INTERESTS) {
    const s = stats[k]; const fixed = CORRECTED.filter((c) => c.k === k);
    entries.push({ interestKey: k, placeId: null, notes: `Fact check of the Gemini-written texts (${s.cells} places), done by Claude with public sources, no Gemini. Named venues checked against the Overture Maps places file (open or closed flag) and Wikipedia; every sentence about access, closures, events, superlatives and numbers searched by hand. ${s.verified} of ${s.claims} risky sentences are recorded as verified with a source; the rest (mostly general climate and crowd sentences and venues known only from memory) are still unchecked. ${fixed.length} texts were wrong or out of date and were corrected: ${fixed.map((c) => c.id).join(', ')}. Full report: https://claude.ai/artifact/CdwCANpP4DERSbuwzxLNiT` });
    for (const c of fixed) entries.push({ interestKey: k, placeId: c.id, notes: `Corrected. ${c.what} Source: ${c.src}` });
  }
  let written = 0;
  for (const e of entries) {
    if (have.has(`${e.interestKey}|${e.placeId ?? ''}`)) continue;
    written++;
    if (apply) {
      const values = { interestKey: e.interestKey, placeId: e.placeId, reviewerName: BY, reviewerRole: 'AI: Claude', reviewedOn: today, notes: e.notes, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${e.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    }
  }
  console.log(`${apply ? 'logged' : 'would log'} ${written} review notes`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
