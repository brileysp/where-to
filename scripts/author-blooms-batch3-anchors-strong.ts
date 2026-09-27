import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildflowerBlooms';

const OVERVIEWS: Record<string, string> = {
  canaries: 'Spring brings a broader flush of the islands\' varied endemic flora across different elevations and islands, but the single most famous sight is Tenerife\'s tajinaste rojo — a striking red flower spike, unique to Teide National Park, that a plant grows for years before blooming once and dying. It flowers in a specific window, typically May into June.',
  'glacier-waterton': 'Glacier lilies, beargrass, and Indian paintbrush fill the alpine meadows every summer, with Logan Pass and the Hidden Lake and Highline trails the classic viewing spots — a reliable annual event. Beargrass has its own irregular bonus: any individual plant blooms only once every 5-7 years, so some years bring an exceptional mass bloom on top of the usual display, unpredictable in advance.',
  tasmania: 'Tasmania\'s wildflowers — including waratahs, flannel flowers, and a range of endemic alpine species in the highlands — follow the Southern Hemisphere\'s calendar, building through the austral spring.',
  provence: 'Valensole\'s lavender fields are the reason people plan trips to Provence specifically for this — but the window is short and cut for oil potency, not visual peak, so it can close early in a hot year. The Valensole lavender festival is fixed to the third Sunday of July, but by then the fields are sometimes already harvested; the most reliable peak color runs late June into the first ten days of July.',
  'texas-hill-country': 'Bluebonnets, the state flower, carpet the Hill Country roadsides and fields each spring — the classic only-in-Texas photo. The display varies meaningfully year to year with rainfall; a dry fall and winter noticeably thins it.',
  amsterdam: 'Keukenhof, one of the world\'s largest flower gardens, opens for only about eight weeks each spring and is built entirely around this — seven million bulbs, tulips chief among them. It\'s a single, deliberately-built garden rather than a wild landscape, and closes completely outside its short season.',
  'rocky-mountain': 'Alpine tundra above treeline bursts into a short, intense wildflower season once the snow clears — a narrower and later window than lower-elevation Rockies destinations, since the alpine zone only has a few usable weeks each year.',
  'great-smoky-mountains': 'The Smokies hold over 1,500 flowering plant species, and the annual Spring Wildflower Pilgrimage (running since 1950) is built entirely around the trillium, phlox, and lady\'s slipper bloom — a real, long-running event, not a marketing add-on.',
  azores: 'Faial\'s blue and white hydrangea hedges (it\'s nicknamed the "Blue Island" for them) are the signature image, but hydrangeas line roads across several of the islands through the summer.',
  madeira: 'Madeira runs its own Flower Festival each spring, and the island\'s volcanic soil and mild climate support a genuinely unusual concentration of endemic flora alongside it — not just an imported display.',
  namibia: 'In the country\'s arid south, near the South African border, an unusually wet winter can trigger the same desert-bloom phenomenon that colors Namaqualand just across the line — dormant seeds flowering en masse after rain. It\'s the same event family as Cape Town\'s Namaqualand bloom, just the Namibian side of it, and just as rain-dependent.',
  hokkaido: 'Furano\'s lavender fields are the reason for the season — vivid purple hillsides that peak for a specific two-to-three-week window each July, not the whole summer.',
  'north-cascades': 'Alpine meadows above treeline fill with wildflowers for a short window once the snowpack clears — glacier lilies, lupine, and paintbrush among them, concentrated in the park\'s high country.',
  olympic: 'Hurricane Ridge\'s subalpine meadows turn into a genuine wildflower garden once the snow melts — lupine, avalanche lilies, and paintbrush among the classic sights, with the timing shifting year to year depending on snowpack.',
  swissalps: 'Alpine meadows across the Swiss Alps fill with wildflowers each summer once the snow clears — a reliable, if broad, seasonal display rather than one named event.',
  dolomites: 'Alpe di Siusi, Europe\'s largest high alpine pasture, hosts over 800 wildflower species and is the Dolomites\' signature bloom — soldanella, alpine poppy, arnica, and edelweiss among them, with higher trails still flowering into early August after the main plateau peaks.',
  napa: 'Vintners deliberately sow mustard as a cover crop between the vines each winter, and the result — bright yellow fields against bare vineyard rows — has become its own local season, with a Mustard Celebration running through February and March. The most expansive bloom is typically mid-February, ahead of the festival\'s late-March finale.',
  kyrgyzstan: 'The high alpine meadows around Song-Köl and Jyrgalan fill with wildflowers once the passes open for summer, part of the same trekking season as the region\'s lakes and yurt stays rather than a standalone destination.',
  tuscany: 'The classic Tuscan image — red poppies scattered through the wheat fields of the Val d\'Orcia — peaks in May; the sunflower fields that follow later in summer are a separate, later bloom not reflected in this window.',
  'death-valley': 'Death Valley has a modest wildflower bloom most years at lower elevations, typically February into April — but the true "superbloom," carpeting the valley floor, is a rare, exceptional event tied to unusually wet winters, roughly once a decade (2005, 2016, and 2019 were the recent standouts). Most years fall well short of that.',
  'joshua-tree': 'Like its desert neighbors, Joshua Tree gets a modest annual bloom in most years, typically March into April — genuine superblooms are rare and rain-dependent, not something to plan a trip around expecting.',
  santorini: 'Wildflowers here are a minor, scattered seasonal presence — spring brings some color to the caldera slopes — not a real draw in its own right.',
  lapland: 'The brief arctic summer brings cloudberry flowers and other tundra blooms across the fells, but this is a minor seasonal detail, not something to visit for on its own.',
  'badlands-black-hills': 'Prairie wildflowers appear across the grasslands in a modest early-summer display — a nice-to-have alongside a visit, not a standalone reason to go.',
};

const MONTHLY: Record<string, string[]> = {
  canaries: ['Outside spring bloom season.', 'Outside spring bloom season.', 'Spring bloom season beginning across the islands\' varied flora.', 'Spring bloom season continuing.', 'Peak spring bloom — Tenerife\'s tajinaste rojo in flower at Teide, alongside the islands\' broader spring bloom.', 'Outside spring bloom season.', 'Outside spring bloom season.', 'Outside spring bloom season.', 'Outside spring bloom season.', 'Outside spring bloom season.', 'Outside spring bloom season.', 'Outside spring bloom season.'],
  'glacier-waterton': ['Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Alpine wildflower season beginning as the snow clears — timing shifts year to year with snowpack.', 'Peak alpine wildflower season — glacier lilies, beargrass, and paintbrush across Logan Pass and the high trails.', 'Peak alpine wildflower season continues.', 'Alpine wildflower season winding down at higher elevations.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.'],
  tasmania: ['Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Austral spring bloom beginning — waratahs, flannel flowers, and alpine species building.', 'Peak austral spring bloom.', 'Peak austral spring bloom continues.', 'Austral spring bloom winding down.'],
  provence: ['Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.', 'Lavender fields coming into color across the Valensole plateau, building toward peak.', 'Peak lavender season — the most reliable window runs late June into the first ten days of July, though fields can be harvested early in a hot summer. The fixed festival date (third Sunday) sometimes falls after the best color has already gone.', 'Lavender season fading — many fields already harvested for oil.', 'Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.'],
  'texas-hill-country': ['Outside bluebonnet season.', 'Outside bluebonnet season.', 'Bluebonnet season beginning, building toward peak — though the display varies with that year\'s rainfall.', 'Peak bluebonnet season — Hill Country roadsides and fields at their best.', 'Bluebonnet season fading.', 'Outside bluebonnet season.', 'Outside bluebonnet season.', 'Outside bluebonnet season.', 'Outside bluebonnet season.', 'Outside bluebonnet season.', 'Outside bluebonnet season.', 'Outside bluebonnet season.'],
  amsterdam: ['Keukenhof closed for the season.', 'Keukenhof closed for the season.', 'Keukenhof opens for its short spring season, tulips building toward peak.', 'Peak tulip season at Keukenhof — seven million bulbs in bloom.', 'Keukenhof\'s final weeks before closing for the season.', 'Keukenhof closed for the season.', 'Keukenhof closed for the season.', 'Keukenhof closed for the season.', 'Keukenhof closed for the season.', 'Keukenhof closed for the season.', 'Keukenhof closed for the season.', 'Keukenhof closed for the season.'],
  'rocky-mountain': ['Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Peak alpine tundra wildflower season — a short window above treeline once the snow clears.', 'Alpine tundra wildflower season continuing.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.'],
  'great-smoky-mountains': ['Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Peak spring wildflower season — trillium, phlox, and lady\'s slipper across the park, and the annual Spring Wildflower Pilgrimage (typically mid-to-late April).', 'Wildflower season fading.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.'],
  azores: ['Outside hydrangea season.', 'Outside hydrangea season.', 'Outside hydrangea season.', 'Outside hydrangea season.', 'Outside hydrangea season.', 'Hydrangea season beginning — Faial\'s hedges and roadsides across the islands building toward peak.', 'Peak hydrangea season.', 'Peak hydrangea season continues.', 'Hydrangea season fading.', 'Outside hydrangea season.', 'Outside hydrangea season.', 'Outside hydrangea season.'],
  madeira: ['Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Bloom season beginning, building toward Madeira\'s Flower Festival.', 'Peak bloom season — the Flower Festival and the island\'s endemic spring flora together.', 'Bloom season fading.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.'],
  namibia: ['Outside the window when a desert bloom could occur.', 'Outside the window when a desert bloom could occur.', 'Outside the window when a desert bloom could occur.', 'Outside the window when a desert bloom could occur.', 'Outside the window when a desert bloom could occur.', 'Outside the window when a desert bloom could occur.', 'Outside the window when a desert bloom could occur.', 'The earliest edge of a possible desert bloom in the arid south, only after an unusually wet winter.', 'The most likely month for a desert bloom in the south, if that year\'s rains were heavy enough — the same rain-dependent event as Namaqualand across the border. Confirm locally before planning around it.', 'Still within the possible window, typically fading by this point.', 'Outside the window when a desert bloom could occur.', 'Outside the window when a desert bloom could occur.'],
  hokkaido: ['Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.', 'Lavender fields at Furano coming into color, building toward peak.', 'Peak lavender season — the most reliable window runs roughly July 10-25, when all varieties bloom together.', 'Lavender season fading — some fields already cut back.', 'Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.', 'Outside lavender season.'],
  'north-cascades': ['Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Peak alpine wildflower season — glacier lilies, lupine, and paintbrush above treeline once the snowpack clears.', 'Alpine wildflower season continuing.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.'],
  olympic: ['Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Peak wildflower season at Hurricane Ridge — lupine, avalanche lilies, and paintbrush once the snow clears; timing shifts year to year with snowpack.', 'Wildflower season continuing at Hurricane Ridge.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.'],
  swissalps: ['Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Alpine wildflower season beginning as meadows clear of snow.', 'Peak alpine wildflower season across the high meadows.', 'Alpine wildflower season continuing.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.', 'Outside alpine wildflower season.'],
  dolomites: ['Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Alpe di Siusi\'s wildflower season beginning, building toward peak.', 'Peak wildflower season at Alpe di Siusi — soldanella, alpine poppy, arnica, and edelweiss across Europe\'s largest high alpine pasture.', 'Wildflower season fading on the main plateau, though higher trails can still be flowering.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.'],
  napa: ['Mustard season beginning across the vineyards, building toward peak.', 'Peak mustard bloom — bright yellow fields between the bare vineyard rows, the most expansive display of the season.', 'Mustard season fading, though the Mustard Celebration\'s finale events run into late March.', 'Outside mustard season.', 'Outside mustard season.', 'Outside mustard season.', 'Outside mustard season.', 'Outside mustard season.', 'Outside mustard season.', 'Outside mustard season.', 'Outside mustard season.', 'Outside mustard season.'],
  kyrgyzstan: ['Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Alpine wildflower season beginning as the high passes open for summer.', 'Peak alpine wildflower season around Song-Köl and Jyrgalan.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.', 'Outside wildflower season.'],
  tuscany: ['Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Poppy season beginning across the Val d\'Orcia wheat fields, building toward peak.', 'Peak poppy season — red poppies scattered through the wheat fields, the classic Tuscan image.', 'Poppy season fading; sunflower fields bloom later in summer, outside this window.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.'],
  'death-valley': ['Outside bloom season.', 'A modest bloom typically beginning at lower elevations — most years stay modest; a true superbloom is a rare, exceptional event roughly once a decade.', 'The best of the typical annual bloom — again, a genuine superbloom (like 2005, 2016, or 2019) is rare and not something to expect.', 'Bloom season fading.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.'],
  'joshua-tree': ['Outside bloom season.', 'Outside bloom season.', 'A modest annual bloom typically beginning — genuine superblooms are rare and rain-dependent, not something to plan around expecting.', 'The best of the typical annual bloom.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.'],
  santorini: ['Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Some spring color on the caldera slopes, still a minor and secondary sight.', 'Some spring color on the caldera slopes, still a minor and secondary sight.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.', 'Wildflowers are a minor, scattered presence here year-round — not a reason to plan timing around.'],
  lapland: ['Outside the brief arctic summer — no blooms.', 'Outside the brief arctic summer — no blooms.', 'Outside the brief arctic summer — no blooms.', 'Outside the brief arctic summer — no blooms.', 'Outside the brief arctic summer — no blooms.', 'The brief arctic summer beginning — cloudberry flowers and other tundra blooms across the fells, a minor seasonal detail.', 'The brief arctic summer continuing, tundra blooms still present.', 'The arctic summer fading.', 'Outside the brief arctic summer — no blooms.', 'Outside the brief arctic summer — no blooms.', 'Outside the brief arctic summer — no blooms.', 'Outside the brief arctic summer — no blooms.'],
  'badlands-black-hills': ['Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'A modest early-summer prairie wildflower display beginning across the grasslands.', 'The prairie wildflower display at its best, still a minor sight alongside a visit rather than a standalone reason to go.', 'Prairie wildflowers fading.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.', 'Outside bloom season.'],
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const missing: string[] = [];
  for (const id of Object.keys(OVERVIEWS)) {
    if (!MONTHLY[id] || MONTHLY[id].length !== 12) missing.push(id);
  }
  if (missing.length) { console.error('Bad monthly arrays:', missing); process.exit(1); }

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    console.log(`  ${id}`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
