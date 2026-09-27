import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'beachesSwimming';

const SUMMER_ONLY = 'Summer only — the rest of the year this is genuinely too cold, not just quieter.';
const NA_SEASON = 'Outside the swim season — cold enough that this isn\'t a realistic month for it.';
const SH_WINTER = 'Southern Hemisphere winter — genuinely cold, not just quieter.';
const WET_ROUGH = 'Wet season — rougher water, not colder.';
const DRY_CALM = 'Dry season — calmer water.';

const OVERVIEWS: Record<string, string> = {
  acadia: "Acadia's rocky coast and cold Gulf of Maine water (rarely above 60°F even in summer) make this a real but bracing swim — most visitors use the park's one warmer option, Echo Lake, over the ocean itself.",
  'basque-country': "San Sebastián's Atlantic water doesn't clear 68°F until June, and the real swim season runs June through September — April, May, and October are real but distinctly colder, hardy-swimmer territory.",
  athens: "Athens' nearby Attica beaches (Vouliagmeni, Glyfada) give the city a real, if secondary, Mediterranean swim option — cold in winter, genuinely warm (79°F+) by midsummer.",
  azores: "The Azores' mid-Atlantic water stays a moderate, rarely-extreme 63-72°F — real swimming, without the Caribbean-style warmth or the truly cold-Atlantic chill of Ireland or Scotland.",
  'bavaria-munich': "Munich's real summer swim option isn't a river or a pool — it's Bavaria's real lake culture: Chiemsee and the Starnberger See both warm to a genuine 68-73°F each summer, popular day trips from the city.",
  berlin: "Berlin's real summer swim option is its many lakes (Wannsee foremost among them) — a genuine local tradition, not a beach destination, and firmly a summer-only one.",
  'black-forest': "The Black Forest's real swim options are its lakes — Titisee and Schluchsee both warm enough for a real summer swim, cold and closed to it the rest of the year.",
  botswana: "The Okavango Delta isn't a swim destination — crocodiles and hippos make open-water swimming a real hazard, not a recreational option; any water time here is a mokoro ride, not a dip.",
  budapest: "Budapest's real water tradition is its thermal baths, not open-water swimming — the Danube itself isn't a real swim destination, warm season or not.",
  'charleston-savannah': "The Lowcountry's barrier-island beaches (Folly Beach, Tybee Island) give this a real, warm-water swim option most of the year — genuinely too cold only in the depths of winter.",
  'chiang-mai': "Northern Thailand is inland and mountainous — any swimming here means a river or a pool, not a real beach destination; the cooler, driest months (Nov-Feb) are pleasant for it, the hot season less so.",
  chiapas: "Chiapas is a highland, jungle, and ruins destination first — real swimming means a river or cenote-style spot, secondary to everything else this region offers.",
  chicago: "Chicago's real summer swim option is Lake Michigan itself — the Park District's beaches officially run Jul-Sep, with water in the high 60s to mid-70s°F even at the season's warmest, and it stays genuinely too cold the rest of the year.",
  copenhagen: "Copenhagen's harbor swimming (a real, celebrated feature of the city, thanks to serious water-quality cleanup) is a firmly summer-only proposition — cold enough the rest of the year that it's not a realistic option.",
  cornwall: "Cornwall has real sea swimming, not just an incidental option — the water peaks around 63°F in August and stays swimmable (with a wetsuit for comfort) from June through November, though it's genuinely cold Dec-May.",
  'great-smoky-mountains': "The Smokies' real swim spots are its rivers — the Townsend Y and Midnight Hole among the best-known — cold, clear mountain water that's a real summer draw and firmly too cold the rest of the year.",
  guatemala: "Guatemala's real swim draw is Lake Atitlán, not a coastline — a genuine, warm-enough freshwater option most of the year, cooler and quieter in the wettest months.",
  'guilin-yangshuo': "The Li River area isn't a swim destination — any water time here is on a bamboo raft, not in the water; a few local spots exist, but this isn't why anyone visits.",
  hokkaido: "Hokkaido's water stays cold even in summer — real swimming here is a brief, narrow window (roughly Jun-Sep) rather than a genuine warm-water season.",
  hongkong: "Hong Kong's beaches (Repulse Bay, Shek O) give the city a real, warm-water summer swim option — genuinely too cool only in the depths of winter (Jan-Mar).",
  istanbul: "The Bosphorus and Sea of Marmara aren't real swim spots for the city — Istanbul's actual beach option (the Princes' Islands) is a real if secondary summer draw, cool the rest of the year.",
  jordan: "The Dead Sea is a genuinely unique floating experience, not conventional swimming — the Gulf of Aqaba nearby offers real, warm Red Sea swimming, cooler in the depths of winter.",
  luangprabang: "Laos is inland here — any swimming means the Mekong or a waterfall pool (Kuang Si is the well-known one), not a beach destination; the cooler, driest months (Nov-Feb) are the most pleasant for it.",
  madeira: "Madeira's volcanic coast has little natural sand — most real swimming here is from rocky platforms or the island's man-made sea pools, in mild (66-72°F), fairly stable Atlantic water year-round.",
  'monterey-big-sur': "Monterey Bay's water is cold nearly year-round (rarely above 60°F) thanks to constant upwelling — real swimming here means a wetsuit, in every season, not just winter.",
  'nova-scotia': "Nova Scotia's Atlantic water is genuinely cold outside a real Jun-Sep peak — the sheltered Northumberland Strait side runs distinctly warmer than the open Atlantic coast around Halifax.",
  pantanal: "Like the Okavango, the Pantanal's wildlife-rich waters (piranhas, caimans) make this a wildlife-viewing destination, not a swimming one — real open-water swimming isn't the point here.",
  peru: "The Sacred Valley and Cusco are high-altitude and inland — swimming isn't a real feature of this destination at all; any water time is incidental, not a reason to visit.",
  provence: "Provence's Mediterranean coast (the Camargue and coastal towns) gives this a real, if secondary, Mediterranean swim option — cold in winter, genuinely warm by midsummer.",
  queenstown: "Queenstown's lakes (Wakatipu especially) are genuinely, bracingly cold even in the Southern Hemisphere summer — real swimming for the hardy, not a warm-water option at any time of year.",
  sedona: "Sedona's real swim spots are its creeks — Slide Rock is the well-known one — cool, clear water that's pleasant in the desert heat and a much smaller draw in cooler months.",
  'sequoia-kings-canyon': "The high Sierra's rivers and lakes are genuinely cold, snowmelt-fed water — real swimming for the hardy in summer, and simply too cold the rest of the year.",
  singapore: "Singapore's beaches (Sentosa's among them) offer real, warm, year-round swimming — this is genuinely tropical water with almost no seasonal swing, though the monsoon months bring more rain and rougher conditions.",
  taiwan: "Taiwan's beach swimming is real but secondary to the island's other draws, and genuinely disrupted by typhoon season (Jul-Sep) — calm, warm water the rest of the year.",
  tasmania: "Tasmania's water is genuinely cold by Australian standards — real swimming is a narrow, Southern Hemisphere summer (Dec-Feb) proposition, not a year-round option.",
  'tbilisi-caucasus': "Georgia's Black Sea coast isn't part of this destination — real swimming here means a river or the reservoir known as the 'Tbilisi Sea,' a genuine if modest local summer option.",
  'tokyo-kyoto': "Neither city is a swim destination — real beach options exist within day-trip range of Tokyo (Kamakura's beaches, for one), but this isn't why anyone visits either city.",
  tuscany: "Tuscany's coast (the Maremma and Elba-adjacent stretches) gives this a real, if secondary, Mediterranean swim option — cold in winter, genuinely warm by midsummer.",
  'upper-peninsula': "The UP's Lake Superior beaches are real but the water is genuinely cold even at its summer peak (rarely exceeding the mid-60s°F) — swimmable, not warm, and a firmly summer-only option.",
  'vancouver-island': "Vancouver Island's Pacific water never gets warm — real swimming here means accepting a cold ocean (peaking near 63°F) even in the best summer months, colder outside them.",
  venice: "Venice's own canals aren't for swimming — the real (if secondary) beach option is the Lido, Venice's barrier island, cold in winter and genuinely warm by midsummer.",
  vermont: "Vermont's real summer swim tradition is its lakes — Lake Champlain foremost among them — a genuine warm-season draw, and firmly too cold outside it.",
  yosemite: "Yosemite's rivers (the Merced especially) offer real, cold, snowmelt-fed swimming — a genuine summer draw once spring runoff eases, and too cold or too dangerous (high, fast water) outside that window.",
  zambia: "South Luangwa's rivers hold real crocodile and hippo populations — this is a wildlife-viewing destination, not a swimming one.",
  zimbabwe: "Victoria Falls' powerful currents and real crocodile population rule out casual swimming in the Zambezi — the famous exception is Devil's Pool, a natural infinity pool right at the falls' edge, open only in the low-water season.",
};

const MONTHLY: Record<string, string[]> = {
  'basque-country': [
    'Water around 54°F — early, hardy-swimmer territory.', 'Same cold conditions.', 'Same cold conditions.',
    'Water around 57°F — still early, not the real season yet.', 'Same cool spring conditions.',
    'Real season begins — above 68°F.', 'Peak season.', 'Water around 70°F, the warmest of the year.',
    'Still within the real season.', 'Cooling back to hardy-swimmer territory.', 'Cold again.', 'Cold, around 54°F.',
  ],
  acadia: [NA_SEASON, NA_SEASON, NA_SEASON, SUMMER_ONLY, SUMMER_ONLY, SUMMER_ONLY, SUMMER_ONLY, SUMMER_ONLY, SUMMER_ONLY, SUMMER_ONLY, SUMMER_ONLY, NA_SEASON],
  athens: [
    'Cold, around 60°F.', 'Same cold conditions, warming slightly.', 'Warming into the mid-60s°F.',
    'Same mild spring conditions.', 'Approaching the real season.', 'Real swim season begins — into the mid-70s°F.',
    'Peak warmth, near 79°F.', 'Same peak warmth.', 'Still within the season.',
    'Cooling back down.', 'Cold again.', 'Cold, around 60°F.',
  ],
  azores: [
    'Cool end of the range, around 63°F.', 'Same cool conditions.', 'Warming slowly.',
    'Same mild conditions.', 'Same mild conditions.', 'Approaching the warmer end.',
    'Warmest stretch of the year, near 72°F.', 'Same warm conditions.', 'Same warm conditions.',
    'Cooling back down.', 'Cool again.', 'Cool, around 63°F.',
  ],
  'bavaria-munich': [NA_SEASON, NA_SEASON, 'Lakes are still too cold for a real swim.', 'Same cold conditions.', 'Warming, not yet the real season.', 'Real lake season begins — 68-73°F.', 'Peak lake season.', 'Same peak conditions.', 'Still swimmable, cooling slightly.', 'Cooling back down.', 'Too cold again.', NA_SEASON],
  berlin: [NA_SEASON, NA_SEASON, 'Lakes still too cold.', 'Same cold conditions.', 'Real lake season begins.', 'Peak lake season.', 'Same peak conditions.', 'Same peak conditions.', 'Cooling, still swimmable.', 'Too cold again.', 'Same cold conditions.', NA_SEASON],
  'black-forest': [NA_SEASON, NA_SEASON, 'Lakes still too cold.', 'Same cold conditions.', 'Warming, not yet the real season.', 'Real lake season begins.', 'Peak lake season.', 'Same peak conditions.', 'Still swimmable, cooling.', 'Too cold again.', 'Same cold conditions.', NA_SEASON],
  botswana: [
    'Not a swim destination — wildlife, not water, is the point.', 'Same as any other month.', 'Same as any other month.',
    'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.',
    'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.',
  ],
  budapest: [NA_SEASON, NA_SEASON, 'Cold, not yet swim season.', 'Same cool conditions.', 'The thermal baths, not the river, are the real option here — year-round.', 'Warmest stretch, still about the baths more than open water.', 'Same warm conditions.', 'Same warm conditions.', 'Cooling.', 'Same cool conditions.', 'Same cool conditions.', NA_SEASON],
  'charleston-savannah': [NA_SEASON, 'Cool but real; the barrier islands stay warmer than you\'d expect this far north.', 'Warming further.', 'Same mild conditions.', 'Same mild conditions.', 'Warm, real swim season.', 'Peak summer warmth.', 'Same peak warmth.', 'Still warm.', 'Cooling but still pleasant.', 'Same mild conditions.', NA_SEASON],
  'chiang-mai': [
    'Cool, dry season — pleasant for a river or pool dip.', 'Same cool, dry conditions.', 'Warming into hot season.',
    'Hot season\'s peak — water time is about cooling off, not a real "swim season."', 'Same hot conditions.',
    'Rainy season begins.', 'Same rainy conditions.', 'Same rainy conditions.', 'Same rainy conditions.',
    'Rainy season\'s tail end.', 'Cool, dry season returns.', 'Same cool, dry conditions.',
  ],
  chiapas: [
    'Dry season — pleasant for a river or cenote dip.', 'Same dry conditions.', 'Same dry conditions.',
    'Same dry conditions, warming.', 'Warming further, rain approaching.', 'Rainy season begins.',
    'Same rainy conditions.', 'Same rainy conditions.', 'Same rainy conditions.', 'Rainy season easing.',
    'Dry season returns.', 'Same dry conditions.',
  ],
  chicago: [NA_SEASON, NA_SEASON, 'Lake still far too cold.', 'Same cold conditions.', 'Same cold conditions.', 'Still cool; the official season hasn\'t started.', 'Real swim season — Park District beaches open, high 60s to low 70s°F.', 'Peak warmth, near 73°F.', 'Still within the official season, cooling.', 'Too cold again.', 'Same cold conditions.', NA_SEASON],
  copenhagen: [NA_SEASON, NA_SEASON, 'Harbor water still too cold.', 'Same cold conditions.', 'Warming, not yet real swim season.', 'Real harbor-swim season begins.', 'Peak season.', 'Same peak conditions.', 'Still swimmable, cooling.', 'Too cold again.', 'Same cold conditions.', NA_SEASON],
  cornwall: [
    'Cold, around 48°F — a wetsuit essential, not just for comfort.', 'Same cold conditions.', 'Same cold conditions.',
    'Still cold.', 'Same cold conditions, warming slowly.', 'Real season begins — above 55°F.',
    'Warming further, into the high 50s°F.', 'Peak warmth, around 63°F.', 'Still warm, one of the best months.',
    'Still swimmable — sea temperature lags air temperature by weeks.', 'Cooling but still within the real season.',
    'Cold again — the real season has ended.',
  ],
  'great-smoky-mountains': [NA_SEASON, NA_SEASON, 'Rivers still too cold and often too high with runoff.', 'Same cold, high-water conditions.', 'Warming, runoff easing.', 'Real season begins — cold, clear mountain water.', 'Peak season.', 'Same peak conditions.', 'Still swimmable, cooling.', 'Too cold again.', 'Same cold conditions.', NA_SEASON],
  guatemala: [
    'Dry season — Lake Atitlán at its most pleasant.', 'Same dry conditions.', 'Same dry conditions.',
    'Same dry conditions, warming.', 'Rainy season approaching.', 'Rainy season begins.', 'Same rainy conditions.',
    'Same rainy conditions.', 'Same rainy conditions.', 'Rainy season easing.', 'Dry season returns.', 'Same dry conditions.',
  ],
  'guilin-yangshuo': Array(12).fill('Same as any other month — this is a raft-and-scenery destination, not a real swim spot.'),
  hokkaido: [NA_SEASON, NA_SEASON, NA_SEASON, 'Still cold, water just starting to warm.', 'Same cool conditions.', 'A brief real window begins.', 'Peak of a short season.', 'Same peak conditions.', 'Cooling, season ending.', 'Too cold again.', NA_SEASON, NA_SEASON],
  hongkong: [
    'Cool for swimming, around 64°F.', 'Same cool conditions.', 'Warming into the high 60s°F.',
    'Same mild conditions.', 'Approaching real swim season.', 'Real season begins.', 'Peak warmth.',
    'Same peak warmth.', 'Same peak warmth continues.', 'Real season\'s last month.', 'Cooling below comfortable.', 'Cool again.',
  ],
  istanbul: [
    'Cool, off-season for the Princes\' Islands.', 'Coldest stretch of the year.', 'Same cool conditions.',
    'Warming; a real if modest swim window begins.', 'Same mild conditions.', 'Warmest stretch.',
    'Same warm conditions.', 'Same warm conditions.', 'Still warm.', 'Cooling but still pleasant.',
    'Same cool conditions.', 'Cold again.',
  ],
  jordan: [NA_SEASON.replace('Outside the swim season', 'Cooler end of the range'), 'Same cool conditions.', 'Warming.', 'Same mild conditions.', 'Same mild conditions.', 'Warm.', 'Warmest stretch.', 'Same warm conditions.', 'Same warm conditions.', 'Cooling slightly.', 'Same mild conditions.', 'Cool again.'],
  luangprabang: [
    'Cool, dry season — pleasant for a river or waterfall pool.', 'Same cool, dry conditions.', 'Warming into hot season.',
    'Hot season\'s peak.', 'Same hot conditions.', 'Rainy season begins.', 'Same rainy conditions.',
    'Same rainy conditions.', 'Same rainy conditions.', 'Rainy season\'s tail end.', 'Cool, dry season returns.', 'Same cool, dry conditions.',
  ],
  madeira: Array(12).fill('Same mild 66-72°F Atlantic water year-round — almost no real seasonal swing here.'),
  'monterey-big-sur': Array(12).fill('Same cold (rarely above 60°F) upwelling-fed water — a wetsuit matters here in every season, not just winter.'),
  'nova-scotia': [
    'Coldest stretch of the year, near-freezing.', 'Same frigid conditions.', 'Warming slowly, still cold.',
    'Same cold spring water.', 'Still well below comfortable.', 'Real season begins — the Northumberland Strait side runs warmest.',
    'Peak warmth, especially on the Strait.', 'Same peak conditions.', 'Still within the real season.',
    'Cooling back down.', 'Same cooling conditions.', 'Genuinely cold again.',
  ],
  pantanal: Array(12).fill('Same as any other month — this is a wildlife-viewing destination, not a swimming one.'),
  peru: Array(12).fill('Same as any other month — swimming isn\'t a real feature of this high-altitude, inland destination.'),
  provence: [
    'Cold, around 55°F.', 'Same cold conditions.', 'Warming slowly.', 'Same mild conditions.',
    'Approaching the real season.', 'Real season begins.', 'Peak warmth, near 79°F.', 'Same peak warmth.',
    'Same peak warmth continues.', 'Cooling but still pleasant.', 'Cold again.', 'Cold, around 55°F.',
  ],
  queenstown: [
    'Southern Hemisphere summer — the least cold this gets, still bracing.', 'Same conditions.',
    'Cooling as autumn approaches.', 'Same cooling conditions.', 'Same cooling conditions.', SH_WINTER, SH_WINTER, SH_WINTER,
    'Spring begins — still cold.', 'Same cold spring conditions.', 'Same cold spring conditions.', 'Summer returns — the least cold this gets.',
  ],
  sedona: [
    'Cool for a creek dip, but a real desert-heat escape when needed.', 'Same cool conditions.', 'Warming.',
    'Same mild conditions.', 'Same mild conditions.', 'A welcome cool-off from the desert heat.',
    'Same welcome cool-off.', 'Same welcome cool-off.', 'Still warm enough to be a real draw.',
    'Cooling, smaller draw now.', 'Same cool conditions.', 'Cool again.',
  ],
  'sequoia-kings-canyon': [NA_SEASON, NA_SEASON, 'Rivers running high and cold with snowmelt.', 'Same high, cold-water conditions.', 'Runoff easing, still cold.', 'Real season begins for the hardy.', 'Peak season.', 'Same peak conditions.', 'Still swimmable, cooling.', 'Too cold again.', 'Same cold conditions.', NA_SEASON],
  singapore: [
    'Warm and tropical, around 84°F.', 'Same warm conditions.', 'Same warm conditions.', 'Same warm conditions.',
    'Monsoon season brings more rain and rougher water, not colder temperatures.', 'Same monsoon conditions.',
    'Same monsoon conditions.', 'Same monsoon conditions.', 'Same monsoon conditions.', 'Same monsoon conditions.',
    'Rainier still — the wetter of the two monsoon seasons.', 'Same rainier conditions.',
  ],
  taiwan: [
    'Cool, real off-season.', 'Same cool conditions.', 'Warming — a real, calm swim window.', 'Same warm, calm conditions.',
    'Cooling slightly, still swimmable.', 'Same mild conditions.', 'Typhoon season begins — genuine storm risk.',
    'Typhoon season\'s peak.', 'Same typhoon-peak conditions.', 'Calm, warm conditions return.',
    'Same warm conditions.', 'Cooling toward the real off-season.',
  ],
  tasmania: [
    'Southern Hemisphere summer — the real, if still cool by mainland-Australian standards, season.', 'Same summer conditions.',
    'Still summer-warm as autumn approaches.', 'Cooling into autumn.', 'Same cooling conditions.', SH_WINTER, SH_WINTER,
    'Still cold, warming slightly.', 'Spring begins — cool.', 'Same cool spring conditions.', 'Same cool spring conditions.', 'Summer returns.',
  ],
  'tbilisi-caucasus': [NA_SEASON, NA_SEASON, 'Still too cold.', 'Same cold conditions.', 'Warming, not yet real season.', 'Real season begins at the reservoir and rivers.', 'Peak season.', 'Same peak conditions.', 'Still swimmable, cooling.', 'Too cold again.', 'Same cold conditions.', NA_SEASON],
  'tokyo-kyoto': [
    'Cold — not a real swim month for either city.', 'Same cold conditions.', 'Warming slightly; day-trip beaches still cool.',
    'Same mild conditions.', 'Cooling again, real rainy season approaching.', 'Rainy season — not swim weather.',
    'A real, if brief, warm window at day-trip beaches.', 'Same warm window.', 'Rainy again — typhoon season.',
    'Real window returns as typhoon risk eases.', 'Same mild window.', 'Cold again.',
  ],
  tuscany: [
    'Cold, around 58°F.', 'Same cold conditions.', 'Warming slowly.', 'Same mild conditions.',
    'Approaching the real season.', 'Real season begins.', 'Peak warmth.', 'Same peak warmth.',
    'Same peak warmth continues.', 'Cooling but still pleasant.', 'Cold again.', 'Cold, around 58°F.',
  ],
  'upper-peninsula': [NA_SEASON, NA_SEASON, NA_SEASON, 'Lake Superior still frigid.', 'Same frigid conditions.', 'Real, if cold, season begins.', 'Peak warmth — still only the mid-60s°F.', 'Same peak (still cold) conditions.', 'Still swimmable, cooling.', 'Too cold again.', NA_SEASON, NA_SEASON],
  'vancouver-island': [NA_SEASON, NA_SEASON, 'Cold, water just starting to warm.', 'Same cool conditions.', 'Same cool conditions.', 'Real, if cold, season begins.', 'Peak warmth — still only the low 60s°F.', 'Same peak (still cold) conditions.', 'Still swimmable, cooling.', 'Cooling below comfortable.', NA_SEASON, NA_SEASON],
  venice: [NA_SEASON, 'Cold, not yet swim season.', 'Same cold conditions.', 'Warming, still cool.', 'Same mild conditions.', 'Warming toward the real season.', 'Real season at the Lido.', 'Same warm conditions.', 'Still warm.', 'Cooling but still pleasant.', NA_SEASON, NA_SEASON],
  vermont: [NA_SEASON, NA_SEASON, 'Lakes still far too cold.', 'Same cold conditions.', 'Warming, not yet real season.', 'Real lake season begins.', 'Peak lake season.', 'Same peak conditions.', 'Still swimmable, cooling.', 'Too cold again.', 'Same cold conditions.', NA_SEASON],
  yosemite: [NA_SEASON, NA_SEASON, 'Rivers running high and cold with spring runoff — genuinely dangerous, not just cold.', 'Same high, dangerous runoff.', 'Runoff easing; real season begins.', 'Peak season — cold, clear water.', 'Same peak conditions.', 'Same peak conditions.', 'Still swimmable, cooling.', 'Too cold again.', NA_SEASON, NA_SEASON],
  zambia: Array(12).fill('Same as any other month — this is a wildlife-viewing destination, not a swimming one.'),
  zimbabwe: [
    'Devil\'s Pool is closed — water levels are too high and dangerous.', 'Same high-water conditions.', 'Same high-water conditions.',
    'Water levels dropping; the pool may open toward month\'s end.', 'Devil\'s Pool season begins as levels drop further.',
    'Same low-water season.', 'Same low-water season.', 'Same low-water season.', 'Same low-water season, at its most reliable.',
    'Same low-water season.', 'Levels starting to rise again.', 'Water levels rising; the pool is closing for the season.',
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
