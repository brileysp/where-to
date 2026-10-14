import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Rewrites the interest text and monthly scores of Myanmar (id bagan) and Assam & Northeast India (id kaziranga)
// for their broader scope. Written by Claude, researched from the sources listed below. Dry run unless --apply.

type Month = [number, string];
interface Section { overview: string; months: Month[] }

// Same text and near-same score across a stable stretch of months.
function run(text: string, scores: number[]): Month[] { return scores.map((s) => [s, text] as Month); }

const BAGAN_BIRDING_WINTER = "Cool, dry mornings suit Bagan's endemics (White-throated Babbler, Burmese Bushlark, Hooded Treepie, scarcer Jerdon's Minivet), and Inle Lake's wintering waterbirds, including Glossy Ibis and Brown-headed Gull, are seen on boat tours.";
const BAGAN_BIRDING_HEAT = 'Dry-zone heat above 40°C confines birding at Bagan and Mount Popa to the first hour after dawn. White-throated Babbler and Hooded Treepie stay resident, but few other birds are active in the heat.';
const BAGAN_BIRDING_MONSOON = "Monsoon showers cut birding time, though Bagan lies in a rain shadow and stays among the driest parts of Myanmar. Resident White-throated Babbler, Burmese Bushlark and Hooded Treepie remain findable, and Mount Popa's forest holds more species.";

const BAGAN_WILD_COOL = "Low, dry-season water makes Irrawaddy dolphins easier to see on boat trips near Kyaukmyaung, and macaques are common on Mount Popa's trails in cool weather.";
const BAGAN_WILD_HEAT = "Dry-zone heat above 40°C keeps wildlife viewing to early mornings: dolphin boat trips near Kyaukmyaung and macaques on Mount Popa's cooler slopes.";
const BAGAN_WILD_MONSOON = "The swollen monsoon river makes Irrawaddy dolphins harder to see near Kyaukmyaung; macaques stay on Mount Popa's trails and bats roost in Bagan's temples.";

const AS_SAFARI_PEAK = "With the elephant grass burned back (burning runs December to February), sightlines are at their best at Kaziranga. Jeep safaris from Kohora and Bagori find rhinos, elephants and water buffalo; tigers are possible, never promised. Manas and Pobitora are also open.";
const AS_SAFARI_CLOSED = 'Kaziranga, Manas and Pobitora are closed for the monsoon floods, halting all jeep safaris.';
const AS_BIRD_CLOSED = 'Kaziranga and Manas are closed for the monsoon floods, so there is no birding access to the grasslands and wetlands.';
const AS_WILD_CLOSED = 'Kaziranga is closed for the monsoon floods, and its rhinos, elephants and tigers retreat to the higher Karbi Anglong hills until the waters fall.';

const CONTENT: Record<string, Record<string, Section>> = {
  bagan: {
    birding: {
      overview: "Bagan's dry scrub holds four Myanmar endemics: White-throated Babbler, Burmese Bushlark, Hooded Treepie and the scarcer Jerdon's Minivet, with Mount Popa, about 90 minutes away, adding forest birds. Inle Lake holds over 20,000 migratory waterbirds from October to March, seen from boat tours.",
      months: [
        [5.2, BAGAN_BIRDING_WINTER], [4.9, BAGAN_BIRDING_WINTER],
        [3.0, 'Heat builds across the dry zone and wintering waterbirds leave Inle Lake. White-throated Babbler and Hooded Treepie stay resident but are active mainly in the first hours after dawn.'],
        [2.0, BAGAN_BIRDING_HEAT], [2.1, BAGAN_BIRDING_HEAT],
        [3.0, BAGAN_BIRDING_MONSOON], [3.2, BAGAN_BIRDING_MONSOON], [3.1, BAGAN_BIRDING_MONSOON], [3.3, BAGAN_BIRDING_MONSOON],
        [3.6, 'Rains ease and the first migrants return to Inle Lake. Bagan\'s White-throated Babbler, Burmese Bushlark and Hooded Treepie remain resident and easiest to find at dawn.'],
        [4.7, 'Wintering waterbirds begin arriving at Inle Lake as the dry season sets in, and Bagan\'s scrub is cool enough for dawn walks. White-throated Babbler, Burmese Bushlark and Hooded Treepie are resident and easiest to find in the first hours of light.'],
        [5.3, BAGAN_BIRDING_WINTER],
      ],
    },
    wildlifeViewing: {
      overview: 'Irrawaddy dolphins still fish cooperatively with cast-net fishermen between Mingun and Kyaukmyaung, north of Mandalay, the only place they do so; about 65 were counted in 2016. Macaques are common on Mount Popa\'s trails, and bats roost in Bagan\'s temples.',
      months: [
        [3.0, BAGAN_WILD_COOL], [2.9, BAGAN_WILD_COOL],
        [1.9, 'Rising heat limits dolphin boat trips near Kyaukmyaung and macaque viewing on Mount Popa to early morning as dry-zone temperatures climb.'],
        [1.2, BAGAN_WILD_HEAT], [1.3, BAGAN_WILD_HEAT],
        [1.3, BAGAN_WILD_MONSOON], [1.4, BAGAN_WILD_MONSOON], [1.5, BAGAN_WILD_MONSOON], [1.4, BAGAN_WILD_MONSOON],
        [2.0, "Rains ease and the river starts to fall, improving dolphin sightings near Kyaukmyaung; macaques remain common on Mount Popa's trails."],
        [2.6, "Falling river levels after the rains make Irrawaddy dolphin boat trips near Kyaukmyaung easier, and cool mornings suit macaque sightings on Mount Popa's trails."],
        [2.8, BAGAN_WILD_COOL],
      ],
    },
  },
  kaziranga: {
    safari: {
      overview: "Greater one-horned rhinos are virtually guaranteed on jeep safaris at Kaziranga, about four hours from Guwahati, with elephants and water buffalo common and tigers never promised. Manas, four to five hours away, adds elephants, reintroduced rhinos and tigers; Pobitora, an hour away, holds over 100 rhinos. Kaziranga's season runs 1 November to 30 April.",
      months: [
        [8.3, AS_SAFARI_PEAK], [7.9, AS_SAFARI_PEAK],
        [7.4, "Burned grass regrows in the heat and trims sightlines, but rhinos, elephants and water buffalo still gather at Kaziranga's remaining waterholes. Manas and Pobitora remain open for jeep safaris."],
        [7.0, "Kaziranga's last month before it closes on 30 April: rising heat and humidity and regrown grass reduce sightlines, though rhinos and elephants are still found around the wetlands. Manas and Pobitora stay open until the monsoon."],
        [0.2, 'Kaziranga is closed for the monsoon floods, halting all jeep safaris, and Manas and Pobitora are closed or on reduced programs as the rains arrive.'],
        [0.0, AS_SAFARI_CLOSED], [0.0, AS_SAFARI_CLOSED], [0.1, AS_SAFARI_CLOSED], [0.1, AS_SAFARI_CLOSED],
        [2.3, "Ranges reopen in stages from late September, and Manas follows in early October, but post-monsoon elephant grass is at its tallest and tracks can be waterlogged, hiding rhinos and elephants. Pobitora reopens this month; the full season, with limited elephant-back rides, begins 1 November."],
        [6.5, 'The official season begins 1 November, with all Kaziranga ranges and a limited number of elephant-back rides running and Manas open. Rhinos are regularly seen, but tall elephant grass still hides elephants, water buffalo and tigers until the burning.'],
        [7.4, 'The elephant grass dries out in the dry season and burning begins, so sightlines at Kaziranga improve through the month. Jeep safaris find rhinos, swamp deer and elephants, and Manas offers elephants, water buffalo and tigers in cooler weather.'],
      ],
    },
    birding: {
      overview: "Kaziranga's prized, elusive targets are the Bengal Florican and Swamp Francolin; Great Hornbills are commonly seen, Pallas's Fish-Eagles frequent the wetlands and Bar-headed Geese winter. Manas, four to five hours from Guwahati, also holds the florican and Rufous-necked Hornbill; Nameri, explored on foot, is the best place for the White-winged Duck, a long shot.",
      months: [
        [7.6, 'With the grass burned back, jeep safaris give their best chances at the elusive Bengal Florican and Swamp Francolin, while Bar-headed Geese and Spot-billed Pelicans fill the wetlands. Manas and Nameri are also open.'],
        [7.2, "Dry conditions make jeep safaris ideal for finding resident Swamp Francolin and Pallas's Fish-Eagle, with wintering Spot-billed Pelicans still abundant on the shrinking wetlands."],
        [6.9, 'Bengal Florican males display over the burned, open grassland at Kaziranga and Manas, the best window to see one. Wintering waterfowl depart the wetlands, while resident Great Hornbills are commonly seen in the woodland.'],
        [6.5, "Florican display continues at Kaziranga and Manas in the shortening grass, though rising heat and the departure of wintering waterfowl thin the list. Great Hornbills and Gray-headed Fish-Eagles remain commonly seen."],
        [1.2, AS_BIRD_CLOSED], [1.0, AS_BIRD_CLOSED], [0.9, AS_BIRD_CLOSED], [1.0, AS_BIRD_CLOSED], [1.2, AS_BIRD_CLOSED],
        [2.5, 'Ranges reopen in stages from late September as the first migrants return, but tall post-monsoon grass and waterlogged tracks limit access; Manas reopens in early October.'],
        [6.8, "Kaziranga's official season begins 1 November and the first Bar-headed Geese and waterfowl arrive on the wetlands. Jeep safaris reach Great Hornbills and Pallas's Fish-Eagles, though tall grass still hides the Swamp Francolin and Bengal Florican. Manas and Nameri are open."],
        [7.2, 'Winter waterfowl, including Bar-headed Geese and Spot-billed Pelicans, peak on the wetlands while burning shortens the grass; jeep safaris give the first good chances at Swamp Francolin and Bengal Florican, both elusive.'],
      ],
    },
    wildlifeViewing: {
      overview: "Greater one-horned rhinos are virtually guaranteed on jeep safaris at Kaziranga, about four hours from Guwahati, which holds about two-thirds of the world's population; elephants and water buffalo are common and tigers are seen only with luck. Manas adds reintroduced rhinos and elephants, and Hoollongapar, near Jorhat, is the best place for hoolock gibbons, India's only apes, with good chances on a quiet dawn walk.",
      months: [
        [8.2, "Burned patches open up Kaziranga's grassland and animals gather on the new shoots and ash, so rhinos, elephants and water buffalo are easy to see; tigers are elusive but sightings improve as cover drops."],
        [8.6, 'Visibility is excellent where the grass has been burned and grazed low, making jeep safaris at Kaziranga very productive for rhinos, elephants and swamp deer, with better odds at a tiger than earlier in the season, still never certain.'],
        [8.9, "Dry conditions gather rhinos, elephants and water buffalo around Kaziranga's remaining wetlands, and with the grass burned and grazed low, tiger sightings are likeliest now, though still a matter of luck. Manas burns its grass in March and April too, improving its visibility."],
        [8.5, 'Last month before Kaziranga closes on 30 April: rhinos and elephants are concentrated at waterholes and tigers are most visible in short grass, but heat and humidity build and regrowth begins to cover sightlines.'],
        [0.0, AS_WILD_CLOSED], [0.0, AS_WILD_CLOSED], [0.0, AS_WILD_CLOSED], [0.0, AS_WILD_CLOSED], [0.0, AS_WILD_CLOSED],
        [2.5, 'Ranges reopen in stages from late September, but tall post-monsoon elephant grass and waterlogged tracks hide most animals; rhinos and elephants are returning to the floodplain, and Pobitora reopens for its dense rhino population.'],
        [7.5, 'Kaziranga is open in stages from October and fully from 1 November. Rhinos and elephants are present, but the post-monsoon elephant grass is at its tallest, hiding tigers and swamp deer until burning begins. Manas is open.'],
        [7.8, 'Controlled burning starts in the dry elephant grass this month, slowly improving sightlines at Kaziranga. Rhinos and water buffalo are reliably seen, elephants are frequently seen moving through the marshes, and tigers stay elusive in the remaining tall cover.'],
      ],
    },
  },
};

const SOURCES: Record<string, Record<string, Array<{ url: string; label: string; note?: string }>>> = {
  bagan: {
    birding: [
      { url: 'https://tropicalbirding.com/asiamyanmar', label: 'Tropical Birding: Myanmar tour', note: 'Four dry-zone endemics around Bagan; Mount Popa species' },
      { url: 'https://wingsbirds.com/tours/myanmar/narrative', label: 'Wings Birding Tours: Myanmar narrative', note: 'Bagan endemics, Jerdon\'s Minivet scarcer' },
      { url: 'https://www.eaaflyway.net/?p=44820', label: 'East Asian-Australasian Flyway Partnership: Inle Lake', note: 'Over 20,000 migratory waterbirds, 75+ species; counts October to March' },
    ],
    wildlifeViewing: [
      { url: 'https://icsf.net/?p=20550', label: 'ICSF: Irrawaddy dolphins and cooperative fishing', note: 'Mingun to Kyaukmyaung stretch; 65 dolphins in the 2016 survey' },
      { url: 'https://www.wilson-howarth.com/Blog/Mount-Popa', label: 'Mount Popa notes', note: 'Macaques along the trails' },
    ],
  },
  kaziranga: {
    safari: [
      { url: 'https://www.theweek.in/wire-updates/national/2025/09/26/ces4-as-kaziranga.html', label: 'The Week: Bagori range reopens 26 Sep 2025', note: 'Staged reopening; elephant safari from 1 November' },
      { url: 'https://assamtourism.gov.in/Manas-National-Park.php', label: 'Assam Tourism: Manas National Park' },
      { url: 'https://www.sahapedia.org/reintroduction-of-greater-one-horned-rhinoceros-manas-national-park', label: 'Sahapedia: rhino reintroduction to Manas', note: '22 rhinos translocated 2008 to 2021' },
    ],
    birding: [
      { url: 'https://natureinfocus.in/guide/manas-national-park/', label: 'Nature in Focus: Manas National Park', note: 'Bengal Florican display March to April; hornbills' },
      { url: 'https://kalpavriksh.org/wp-content/uploads/2018/07/NameriBirdingOutlookTravellerOctober2014.pdf', label: 'Outlook Traveller: birding Nameri', note: 'White-winged Duck, explored on foot' },
    ],
    wildlifeViewing: [
      { url: 'https://en.wikipedia.org/wiki/Hoollongapar_Gibbon_Sanctuary', label: 'Hoollongapar Gibbon Sanctuary', note: "India's only ape; seven primate species" },
      { url: 'https://www.sentinelassam.com/topheadlines/assam-kaziranga-national-park-ranks-third-globally-in-tiger-density-says-survey', label: 'Sentinel Assam: Kaziranga tiger density 2024' },
      { url: 'https://www.deccanchronicle.com/amp/lifestyle/environment/assam-wildlife-tourism-season-begins-oct-2-as-manas-reopens-kaziranga-follows-1992189', label: 'Deccan Chronicle: Assam parks reopen in October', note: '2,613 rhinos at Kaziranga' },
      { url: 'https://jeevoka.com/kaziranga-the-land-of-floods-and-fire/s', label: 'Kaziranga grass burning', note: 'Burning December to February' },
    ],
  },
};

const PLACE_FIELDS: Record<string, { about?: string; costOverview?: string }> = {
  bagan: {
    about: "Cool-dry season Nov–Feb is best across the country (and prime for Bagan's sunrise balloon rides), hot Mar–May in the dry zone, monsoon Jun–Oct.",
    costOverview: 'In Bagan, tea, food and e-bike rental are all cheap — the archaeological zone pass is the one real fixed cost, valid across your whole stay.',
  },
};

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { validateContent, overallStatus } = await import('../src/lib/gemini/validate');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');

  let anyReject = false;
  for (const [placeId, sections] of Object.entries(CONTENT)) {
    for (const [key, sec] of Object.entries(sections)) {
      if (sec.months.length !== 12) throw new Error(`${placeId}/${key}: ${sec.months.length} months`);
      const out = { overview: sec.overview, monthly: sec.months.map(([score, text]) => ({ score, text })), sources: [], confidence: 'high' as const, flags: [] };
      const issues = validateContent(out, key, placeId);
      const peak = Math.max(...sec.months.map((m) => m[0]));
      console.log(`\n${placeId}/${key}: peak ${peak}, overview ${sec.overview.length} chars, longest month ${Math.max(...sec.months.map((m) => m[1].length))}`);
      for (const i of issues) console.log(`  [${i.severity}] ${i.message}`);
      if (overallStatus(issues) === 'invalid') anyReject = true;
    }
  }
  if (anyReject) { console.log('\nREJECTS present: not applying.'); process.exit(1); }
  if (!apply) { console.log('\nDry run complete (no rejects).'); process.exit(0); }

  for (const [placeId, sections] of Object.entries(CONTENT)) {
    const [place] = await db.select().from(places).where(eq(places.id, placeId));
    const loadedUpdatedAt = place.updatedAt.toISOString();
    const base = { entityType: 'destination', entityId: placeId, loadedUpdatedAt };
    const curves = { ...((place.sliderCurves as Record<string, unknown>) ?? {}) };
    const overviews = { ...((place.sliderOverview as Record<string, string>) ?? {}) };
    const monthly = { ...((place.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {}) };
    const ovMeta = { ...((place.sliderOverviewMeta as Record<string, unknown>) ?? {}) };
    const moMeta = { ...((place.sliderMonthlyWeatherMeta as Record<string, unknown>) ?? {}) };
    const srcs = { ...((place.sliderSources as Record<string, unknown[]>) ?? {}) };
    const overrides = { ...((place.scoreOverrides as Record<string, unknown>) ?? {}) };
    const now = new Date().toISOString();
    const stamp = { origin: 'claude' as const, lastEditedBy: 'claude' as const, lastEditorName: 'claude-sonnet-5.5', lastEditedAt: now, lastChange: 'Rewritten for the broader place scope (Oct 2026)' };
    let overridesChanged = false;
    for (const [key, sec] of Object.entries(sections)) {
      const { curve } = fitMonthlyToCurve(sec.months.map((m) => m[0]), { errorTolerance: 0.06 });
      curves[key] = curve;
      overviews[key] = sec.overview;
      monthly[key] = sec.months.map((m) => m[1]);
      ovMeta[key] = stamp;
      moMeta[key] = new Array(12).fill(stamp);
      srcs[key] = (SOURCES[placeId]?.[key] ?? []).map((s) => ({ ...s, addedAt: now.slice(0, 10) }));
      if (overrides[key]) { delete overrides[key]; overridesChanged = true; }
    }
    const patches = [
      { ...base, field: 'sliderCurves', value: curves },
      { ...base, field: 'sliderOverview', value: overviews },
      { ...base, field: 'sliderMonthlyWeather', value: monthly },
      { ...base, field: 'sliderOverviewMeta', value: ovMeta },
      { ...base, field: 'sliderMonthlyWeatherMeta', value: moMeta },
      { ...base, field: 'sliderSources', value: srcs },
    ];
    if (overridesChanged) patches.push({ ...base, field: 'scoreOverrides', value: overrides });
    const pf = PLACE_FIELDS[placeId];
    if (pf?.about) patches.push({ ...base, field: 'about', value: pf.about });
    if (pf?.costOverview) patches.push({ ...base, field: 'costOverview', value: pf.costOverview });
    const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
    console.log(placeId, 'saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  }
  process.exit(0);
})();
