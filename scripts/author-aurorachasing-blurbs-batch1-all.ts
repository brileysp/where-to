import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'auroraChasing';

// Shared bucket text, reused verbatim across destinations/months whose real
// situation is genuinely the same, per the playbook's skeleton convention.
const OFF_SEASON = 'Outside the real dark season — nights are too short here for a realistic look, even during a strong storm.';
const SUMMER_LIGHT = "Near-continuous summer light here — there's not enough darkness for the aurora to show, whatever the sun is doing.";
const REGULAR_SEASON = (site: string) => `Full dark season at ${site} — one of the best windows of the year.`;
const SOUTH_OFF = 'Outside the southern-hemisphere dark season — days are too long for a realistic look.';

const OVERVIEWS: Record<string, string> = {
  iceland: "Iceland sits under the auroral oval, so a clear night in the dark season is a real shot — no rare storm required. The main risk is weather, not latitude: a run of cloudy nights can undo an otherwise well-timed week.",
  lapland: "Finnish Lapland has one of the longest aurora seasons anywhere — late August into April — and locals report the lights on well over half of clear dark-season nights. Glass-roofed cabins here exist specifically so you can watch from bed.",
  lofoten: "The Lofoten Islands sit above the Arctic Circle with little light pollution, giving a genuine shot at the aurora across roughly eight months of the year — among the longer windows of any place on this list.",
  // CORRECTED post-commit — see fix-aurorachasing-fjords-latitude.ts. The
  // original text here was written around Tromsø (~70°N, Arctic Norway),
  // which is not part of this destination — the real "Norwegian Fjords"
  // entry (per its own `about` field and every other slider) is Geiranger/
  // Sognefjord/Ålesund/Bergen, ~60-62°N. Caught by the user; score was wrong
  // too (apex tier, should have been Faroe/Scottish-Highlands tier).
  fjords: "Norway's fjord country sits far enough south that the aurora isn't a given — Bergen and Ålesund need a genuinely strong solar storm, arriving only a handful of times a year, and even then the display tends to be fainter than what Norway's true Arctic north sees routinely.",
  churchill: "Churchill sits right under the auroral oval and reports aurora on close to 300 nights a year — one of the most reliable places on Earth for it, cold and dry air keeping the skies clear on top of the latitude.",
  'denali-interior': "Fairbanks and Denali's interior get one of North America's longest aurora seasons — roughly nine months — and on a clear night in season, the lights are visible on about four nights out of five.",
  banff: "Banff sees the aurora several times a season, though a truly big, sky-filling display is closer to a once-or-twice-a-year event. It's real and worth watching for, just not the near-guarantee that further-north destinations on this list offer.",
  greenland: "Greenland's near-total lack of light pollution makes for some of the cleanest dark skies for aurora viewing anywhere, across a season that runs from late summer into spring.",
  'faroe-islands': "The Faroes sit far enough north for a real shot at the aurora, but the islands' fast-moving Atlantic weather makes cloud, not darkness, the real gatekeeper — one village can be clear while the next is socked in.",
  'southeast-alaska': "Aurora here is real but genuinely modest — regular through the dark season, needing a moderately active night to clear the area's frequent cloud cover, and effectively invisible in summer's near-constant light.",
  'scottish-highlands-skye': "Known locally as the mirrie dancers, the aurora reaches the Highlands and Skye during a genuinely strong geomagnetic storm — a handful of real events most winters, not a routine sight.",
  'upper-peninsula': "The Upper Peninsula's edge along Lake Superior gives a rare thing this far south: 160 miles of open, unlit horizon to watch. A strong storm is still required, but when one hits, the UP is one of the better-placed spots in the lower 48.",
  vermont: "Vermont gets the aurora only during a real geomagnetic storm — elevation and a dark rural sky help, but this is an occasional bonus on a clear night, not a plannable season.",
  whistler: "Whistler sees the aurora only occasionally, during a genuinely active night — real, and increasingly caught on the resort's own webcams, but a treat rather than something to plan a trip around.",
  tasmania: "Tasmania is Australia's best shot at the aurora australis — the southern lights — with the state's south coast giving some of the continent's darkest, least light-polluted skies.",
  falklands: "The Falklands sit at a useful southern latitude for the aurora australis and even run a permanent monitoring station for it, though sightings still depend on real solar activity, not just location.",
  'milford-sound-fiordland': "Fiordland's remoteness gives genuinely dark skies for the aurora australis, though at this latitude a sighting still needs real, above-average solar activity.",
  'tierra-del-fuego': "As close to the pole as a city gets, Ushuaia has real potential for the aurora australis, with up to 17 hours of winter darkness — but a confirmed sighting this far up South America is still a rare, notable event, not a routine one.",
  'glacier-waterton': "Glacier and Waterton Lakes get the aurora only during a real geomagnetic storm — genuinely dark skies here help, but this is an occasional bonus, not a plannable season.",
  'vancouver-island': "Vancouver Island sees the aurora only a handful of nights a year, and only during a strong storm — the island's own frequent winter cloud cover cuts into even those odds.",
  acadia: "Acadia sits well south of the reliable aurora band. A sighting here means a genuine geomagnetic storm, not routine winter darkness — a bonus on a clear, moonless night, not a reason to plan around.",
  svalbard: "Svalbard sits right under the auroral oval — even a quiet night can deliver, no storm required. Late April to late August, though, the sun never sets, so there's no dark sky to see it against.",
};

const MONTHLY: Record<string, string[]> = {
  iceland: [
    REGULAR_SEASON('Iceland'), 'February is statistically the strongest month — long nights and typically the year\'s clearest skies.',
    'Still a real dark-season month, with decent odds on a clear night.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'The season restarts as nights lengthen again.', 'A real, if lighter, start to the season.',
    'Full dark season returns.', REGULAR_SEASON('Iceland'),
  ],
  lapland: [
    REGULAR_SEASON('Lapland'), REGULAR_SEASON('Lapland'), 'Still deep in the dark season, with strong odds on a clear night.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, 'Nights are just starting to darken again by month\'s end.',
    'Season restarts in earnest — one of the longest anywhere.', REGULAR_SEASON('Lapland'),
    REGULAR_SEASON('Lapland'), REGULAR_SEASON('Lapland'),
  ],
  lofoten: [
    REGULAR_SEASON('Lofoten'), REGULAR_SEASON('Lofoten'), 'Nights are shortening but still genuinely dark enough for a good shot.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'The season restarts as real darkness returns.', 'A solid start to the season.',
    REGULAR_SEASON('Lofoten'), REGULAR_SEASON('Lofoten'),
  ],
  fjords: [
    'Within the season — a genuinely strong storm is still needed, but nights are long and dark.',
    'Same odds as January, among the better months for a chance.',
    'Still within the season; the equinox can add a boost in activity.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'A modest start to the season.',
    'Nights are dark enough again for a real, if occasional, chance.',
    'Within the season, same odds as January.',
    'Within the season, same odds as January.',
  ],
  churchill: [
    REGULAR_SEASON('Churchill'), 'Cold, dry air keeps skies clear — among the most reliable months of the year.',
    'A real month, though odds ease slightly as nights shorten.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'The season restarts as real darkness returns.', 'A genuinely strong month to start the season.',
    REGULAR_SEASON('Churchill'), REGULAR_SEASON('Churchill'),
  ],
  'denali-interior': [
    REGULAR_SEASON('the Interior'), 'One of the clearest-sky months of the year here — a strong month for the season.',
    'Real odds remain, though nights are shortening.', OFF_SEASON, OFF_SEASON, 'The very tail end of true midnight sun; still too light most nights.',
    'Darkness is returning but is not yet reliable.', 'A real start to the season as nights lengthen.',
    'A strong month, closer to the season\'s better odds.', REGULAR_SEASON('the Interior'),
    'A strong month heading into peak season.', REGULAR_SEASON('the Interior'),
  ],
  banff: [
    REGULAR_SEASON('Banff'), 'Still within the dark season, with real if less frequent odds.',
    'A lighter month as nights shorten; a strong storm is still possible.', OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'A modest start to the season as nights lengthen.', 'Building toward the better months.',
    'A real month within the season.', REGULAR_SEASON('Banff'),
  ],
  greenland: [
    REGULAR_SEASON('Greenland'), 'One of the strongest months, combining long nights with typically calmer weather.',
    'Real odds remain as the season continues.', OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'The season restarts as darkness returns.', 'A real, building start to the season.',
    'A solid month heading into the strongest stretch.', REGULAR_SEASON('Greenland'),
  ],
  'faroe-islands': [
    'Long, dark nights all month; the real variable is catching a clear break in the weather.',
    'Still within the season, with the same weather caveat.', 'A lighter month as nights shorten and storms are less frequent.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'A modest start to the season.', 'Nights are dark enough again, weather permitting.',
    'A real month within the season.', 'Long, dark nights; the same weather caveat as December.',
  ],
  'southeast-alaska': [
    'Regular through the dark season — a moderately active night is usually enough to clear the area\'s frequent cloud.',
    'Same regular winter odds as January.', 'The equinox brings a real bump in activity — one of the strongest months of the year.',
    'Light is returning fast; odds drop off sharply.', SUMMER_LIGHT, 'Still too light most nights for a realistic look.',
    'Light is just beginning to fade back in; still a long shot.', 'A real, if modest, return as nights lengthen.',
    'The equinox bump makes this one of the year\'s strongest months.', 'Regular winter season returns.',
    'Same regular winter odds.', 'Same regular winter odds heading into January.',
  ],
  'scottish-highlands-skye': [
    'Within the season — a real storm is still needed, but nights are long and dark.',
    'Same as January — real, if occasional, odds.', 'A lighter month as nights shorten; the equinox can still bring a strong event.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'A modest start to the season.', 'The equinox can bring a real event even this early.',
    'Nights are dark enough again for a real, if occasional, chance.', 'Within the season, same odds as January.',
  ],
  'upper-peninsula': [
    'Within the season — Lake Superior\'s open northern horizon helps if a strong storm hits.',
    'Same odds as January.', 'A lighter month as nights shorten.', OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'Nights are just long enough again for a real, if occasional, chance.', 'One of the better months — a real equinox bump in activity.',
    'Within the season, same odds as January.', 'Within the season, same odds as January.',
  ],
  vermont: [
    'A real, occasional chance on a clear night during a strong storm.', 'Same odds as January.',
    'The equinox brings a genuine bump — one of the better months to catch a storm.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'A modest start to the season.', 'The equinox bump makes this one of the stronger months.',
    'A real, occasional chance returns.', 'Same odds as January.',
  ],
  whistler: [
    'A real, occasional chance during a strong storm.', 'Same odds as January.',
    'A lighter month as nights shorten, though a strong storm can still deliver.',
    'Nights are getting too short for a realistic look.', SUMMER_LIGHT, 'Still too light most nights.',
    'Light is fading back in; still a long shot most nights.', 'A modest return as nights lengthen.',
    'One of the better months, with a genuine equinox bump in activity.', 'Within the season, same odds as January.',
    'Within the season, same odds as January.', 'Within the season, same odds as January.',
  ],
  tasmania: [
    SOUTH_OFF, SOUTH_OFF, SOUTH_OFF, 'The southern dark season is starting — real, if modest, odds begin.',
    'Odds are building as nights lengthen.', 'One of the strongest months — long southern-winter darkness.',
    'Same strong winter odds as June.', 'Still within the strong stretch of the season.',
    'A real, if fading, chance as nights shorten again.', SOUTH_OFF, SOUTH_OFF, SOUTH_OFF,
  ],
  falklands: [
    SOUTH_OFF, SOUTH_OFF, SOUTH_OFF, 'The southern dark season begins — a real, if modest, chance.',
    'One of the better months as nights lengthen.', 'A strong month within the southern dark season.',
    'Same strong odds as June.', 'Still a real chance within the season.',
    'Odds fade as nights shorten again.', SOUTH_OFF, SOUTH_OFF, SOUTH_OFF,
  ],
  'milford-sound-fiordland': [
    SOUTH_OFF, SOUTH_OFF, SOUTH_OFF, 'A real, if modest, chance as the southern dark season begins.',
    'One of the better months for a chance.', 'The strongest month of the year here.',
    'Same strong odds as June.', 'Still a real chance within the season.',
    'The season\'s effectively over — a genuine long shot, at best.', SOUTH_OFF, SOUTH_OFF, SOUTH_OFF,
  ],
  'tierra-del-fuego': [
    SOUTH_OFF, SOUTH_OFF, SOUTH_OFF, 'A real, if modest, chance as the southern winter darkness begins.',
    'One of the better months, with up to 17 hours of darkness.', 'The strongest month — the heart of the southern winter.',
    'Same strong odds as June.', 'Still a real chance within the season.',
    SOUTH_OFF, SOUTH_OFF, SOUTH_OFF, SOUTH_OFF,
  ],
  'glacier-waterton': [
    'A real, occasional chance on a clear night during a strong storm.', 'Same odds as January.',
    'A lighter month as nights shorten, though a strong storm can still deliver.',
    OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'A modest start to the season.', 'A real, occasional chance returns.',
    'Same odds as January.', 'Same odds as January.',
  ],
  'vancouver-island': [
    'A real, if rare, chance on a clear night during a strong storm — winter cloud cover often works against it.',
    'Same rare odds as January, with the same cloud-cover caveat.', 'Nights are still dark enough for a rare chance.',
    'Nights are getting too short for a realistic look.', 'Nights are getting too short for a realistic look.', OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'A modest start to the season.', 'Nights are dark enough again, cloud cover permitting.',
    'A real, if rare, chance, with the season\'s usual heavy cloud cover.', 'Same rare odds as January, with the same cloud-cover caveat.',
  ],
  acadia: [
    REGULAR_SEASON('Acadia') + ' Still a genuine long shot without a real storm.', 'Same odds as January.',
    'The equinox brings a real, if still occasional, bump in activity.', OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
    'The equinox brings a real bump in solar activity — the best incidental odds of the year, though still a long shot.',
    'A real, if fading, chance as the equinox bump passes.', 'Within the season, same odds as January.', 'Within the season, same odds as January.',
  ],
  svalbard: [
    REGULAR_SEASON('Svalbard'), REGULAR_SEASON('Svalbard'), REGULAR_SEASON('Svalbard'),
    'The sun starts staying up longer; still real darkness most nights, but the window is closing.',
    'Midnight sun all month — no darkness, so no aurora.', 'Midnight sun all month — no darkness, so no aurora.', 'Midnight sun all month — no darkness, so no aurora.',
    'The sun starts setting again by month\'s end; still limited darkness.',
    'Full polar night is still weeks off, but nights are dark enough now for the season\'s first real looks.',
    REGULAR_SEASON('Svalbard'), REGULAR_SEASON('Svalbard'), REGULAR_SEASON('Svalbard'),
  ],
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12 (got ${MONTHLY[id].length})`); process.exit(1); }
    const patch = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
    console.log(`  ${id}`);
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
