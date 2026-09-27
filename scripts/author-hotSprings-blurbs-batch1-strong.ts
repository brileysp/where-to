import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'hotSprings';

const OVERVIEWS: Record<string, string> = {
  atacama: "Termas de Puritama's eight geothermal pools sit in a canyon outside San Pedro de Atacama, considered sacred for centuries by the Atacameño people before opening to visitors. The desert's cold, clear nights — especially June and July — make for the sharpest hot-water contrast.",
  banff: "Banff Upper Hot Springs, on Sulphur Mountain, is the highest hot spring in Canada — its 1883 discovery and the ownership dispute that followed directly led to Banff becoming Canada's first national park two years later. The pool runs year-round at 38-40°C.",
  'tbilisi-caucasus': "Tbilisi's Abanotubani district has domed brick bathhouses built over natural sulfur springs, with a founding legend dating to the 5th century — legend holds the city is named for the springs (tpili means warm). These are indoor baths, open and used year-round.",
  'tokyo-kyoto': "Kinosaki Onsen, about 2.5 hours from Kyoto, dates to 720 CE and is known for onsen-hopping between seven public bathhouses in one walkable town. Winter pairs its outdoor snow-viewing baths with the region's crab season — a real, well-known seasonal pairing.",
  'argentine-lake-district': "Termas de Copahue, in the mountains near the Chilean border, is recognized by the WHO for its variety of sulphuric mud and thermal water treatments. It's a real seasonal destination in the strictest sense — heavy snow closes the access road entirely from around May through November.",
  aspen: "Two real, different hot springs near Aspen: Penny Hot Springs, a roadside soak on the Crystal River about 45 minutes away, and Conundrum Hot Springs, an 8.5-mile backcountry hike requiring an overnight permit. Penny is a genuine winter destination — cold-river, hot-spring contrast — while Conundrum only makes sense once the trail is snow-free.",
  azores: "Terra Nostra Park's iron-rich thermal pool in Furnas dates to 1780 — the rust-brown water permanently stains swimwear. Locals still use the same volcanic steam vents nearby to slow-cook Cozido das Furnas, a stew lowered into the ground for hours.",
  'chilean-lake-district': "Termas Geométricas, near Pucón, is 17 slate-lined pools fed by more than 60 natural springs along a volcanic fault line — a 2009 design explicitly built for soaking through a snowstorm.",
  'ecuadorian-andes': "Termas de Papallacta, about 90 minutes from Quito at 3,250m, sits in one of the most temperature-stable places on Earth — daily highs barely vary across the year. The real seasonal difference is rainfall, not temperature: June through September is genuinely drier.",
  'north-island': "Rotorua's Polynesian Spa, including the historic Priest's Bath, has run continuously since the 1870s-80s, when a Catholic priest was said to be cured of rheumatism there. The geothermal pools work well year-round, with two real high points: drier summer conditions and winter's cold-air-against-hot-water contrast.",
  queenstown: "Queenstown's own \"Onsen Hot Pools\" use heated, treated water, not natural geothermal springs. The nearest genuine natural hot spring is Hanmer Springs, about 4 hours away by road — a real day trip or overnight, not something on-site.",
  swissalps: "Leukerbad, the largest thermal resort in the Alps, has been used since Roman times — Goethe wrote about daily hour-long soaks here in 1779. Outdoor pools surrounded by snow-capped peaks are the signature winter image.",
  uyuni: "Termas de Polques, beside Laguna Salada near the Salvador Dalí Desert geysers, is a fixed stop on the multi-day 4x4 tours that cross the Uyuni salt flats — visited regardless of season. At over 4,300m, June and July nights are the coldest of the year, sharpening the contrast against the warm water.",
  yellowstone: "Yellowstone's own legal soaking spot, Boiling River, has been closed since the 2022 floods with no reopening timeline. The real, currently open option is Chico Hot Springs, a working resort about 30-40 minutes outside the park's north entrance in Montana.",
};

const ATACAMA_PEAK = 'The coldest desert nights of the year, and the sharpest contrast against the warm pools.';
const ATACAMA_GOOD = 'Dry-season conditions, good visibility and easy access to the canyon.';
const ATACAMA_LOW = 'The rainier stretch of the year, a modest dip from the rest of the season.';

const BANFF_PEAK = 'Soaking outdoors with snow and mountain views is the real draw here, and winter is when it’s best.';
const BANFF_BASE = 'The pool is open and good, just without winter’s snow-and-steam contrast.';

const TBILISI_PEAK = 'Tbilisi’s cold winter nights make the indoor sulfur baths especially appealing.';
const TBILISI_BASE = 'The baths are a real, year-round local habit, open regardless of season.';

const TK_WINTER = 'Snow-viewing outdoor baths paired with the region’s crab season — Kinosaki’s signature time of year.';
const TK_GOOD = 'Good conditions for onsen-hopping through Kinosaki’s bathhouses.';
const TK_RAINY = 'Japan’s rainy season/typhoon season can make travel to the onsen towns less pleasant.';

const ALD_PEAK = 'Copahue is open and at its best.';
const ALD_SHOULDER = 'Copahue is open, right at the edge of its snow-limited season.';
const ALD_CLOSED = 'Heavy snow closes the access road for the season — not a realistic time to plan a visit here.';

const ASPEN_PEAK = 'Penny Hot Springs’ cold-river, hot-water contrast is at its best.';
const ASPEN_BASE = 'Penny remains a good roadside soak, and this is the realistic window for the Conundrum backcountry hike.';

const AZORES_GOOD = 'Good conditions for the pool and the wider Furnas area.';
const AZORES_RAIN = 'The rainiest stretch of the year, a modest dip — the pool itself is unaffected.';

const CLD_PEAK = 'Good conditions, including the real appeal of soaking here during a winter snowstorm in June-August.';
const CLD_SHOULDER = 'Still good, quieter conditions.';
const CLD_DIP = 'A modest wet-season dip in an otherwise good season.';

const EA_PEAK = 'The driest, most comfortable stretch of the year for getting to and from the pools.';
const EA_SHOULDER = 'Slightly drier than the baseline months, a real if modest improvement.';
const EA_BASE = 'The water and pools are the same as always — Papallacta’s temperature barely changes year-round.';

const NI_SUMMER = 'Drier summer conditions, one of the two real high points here.';
const NI_WINTER = 'Winter’s cold-air contrast against the hot pools — the other real high point.';
const NI_GOOD = 'Good conditions, just short of the two peaks.';
const NI_BASE = 'Solid, unremarkable conditions.';

const QT_PEAK = 'Winter’s cold-air contrast is when a hot soak — whether the treated pools in town or the real thing at Hanmer — is most appealing.';
const QT_BASE = 'A good soak either way, just without winter’s contrast.';

const SA_PEAK = 'Outdoor soaking against snow-capped peaks — the resort’s signature season.';
const SA_BASE = 'Good conditions, often paired with hiking, just without winter’s snow backdrop.';

const UY_PEAK = 'The coldest Altiplano nights of the year, and the sharpest hot-water contrast.';
const UY_GOOD = 'Good, dry-season conditions on the tour circuit.';
const UY_WET = 'The wetter season on the Altiplano — the spring is still on the fixed tour route, just with rockier road conditions elsewhere on the circuit.';

const YS_PEAK = 'Cold winter air against Chico’s warm pools is a real, worthwhile contrast.';
const YS_MID = 'Good conditions at Chico, without winter’s contrast.';
const YS_DIP = 'A modest seasonal dip — still open, just the least distinctive time of year.';

const MONTHLY: Record<string, string[]> = {
  // Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
  atacama: [ATACAMA_LOW, ATACAMA_LOW, ATACAMA_GOOD, ATACAMA_GOOD, ATACAMA_GOOD, ATACAMA_PEAK, ATACAMA_PEAK, ATACAMA_GOOD, ATACAMA_GOOD, ATACAMA_GOOD, ATACAMA_GOOD, ATACAMA_LOW],
  banff: [BANFF_PEAK, BANFF_PEAK, BANFF_PEAK, BANFF_BASE, BANFF_BASE, BANFF_BASE, BANFF_BASE, BANFF_BASE, BANFF_BASE, BANFF_BASE, BANFF_PEAK, BANFF_PEAK],
  'tbilisi-caucasus': [TBILISI_PEAK, TBILISI_PEAK, TBILISI_BASE, TBILISI_BASE, TBILISI_BASE, TBILISI_BASE, TBILISI_BASE, TBILISI_BASE, TBILISI_BASE, TBILISI_BASE, TBILISI_BASE, TBILISI_PEAK],
  'tokyo-kyoto': [TK_WINTER, TK_WINTER, TK_GOOD, TK_GOOD, TK_GOOD, TK_RAINY, TK_GOOD, TK_GOOD, TK_RAINY, TK_GOOD, TK_GOOD, TK_WINTER],
  'argentine-lake-district': [ALD_PEAK, ALD_PEAK, ALD_PEAK, ALD_SHOULDER, ALD_CLOSED, ALD_CLOSED, ALD_CLOSED, ALD_CLOSED, ALD_CLOSED, ALD_CLOSED, ALD_CLOSED, ALD_SHOULDER],
  aspen: [ASPEN_PEAK, ASPEN_PEAK, ASPEN_PEAK, ASPEN_BASE, ASPEN_BASE, ASPEN_BASE, ASPEN_BASE, ASPEN_BASE, ASPEN_BASE, ASPEN_BASE, ASPEN_PEAK, ASPEN_PEAK],
  azores: [AZORES_RAIN, AZORES_RAIN, AZORES_GOOD, AZORES_GOOD, AZORES_GOOD, AZORES_GOOD, AZORES_GOOD, AZORES_GOOD, AZORES_GOOD, AZORES_GOOD, AZORES_RAIN, AZORES_RAIN],
  'chilean-lake-district': [CLD_PEAK, CLD_PEAK, CLD_PEAK, CLD_SHOULDER, CLD_DIP, CLD_PEAK, CLD_PEAK, CLD_PEAK, CLD_SHOULDER, CLD_SHOULDER, CLD_SHOULDER, CLD_PEAK],
  'ecuadorian-andes': [EA_BASE, EA_BASE, EA_BASE, EA_BASE, EA_SHOULDER, EA_PEAK, EA_PEAK, EA_PEAK, EA_PEAK, EA_BASE, EA_BASE, EA_SHOULDER],
  'north-island': [NI_SUMMER, NI_SUMMER, NI_GOOD, NI_BASE, NI_BASE, NI_GOOD, NI_WINTER, NI_GOOD, NI_BASE, NI_BASE, NI_BASE, NI_GOOD],
  queenstown: [QT_BASE, QT_BASE, QT_BASE, QT_BASE, QT_BASE, QT_PEAK, QT_PEAK, QT_PEAK, QT_BASE, QT_BASE, QT_BASE, QT_BASE],
  swissalps: [SA_PEAK, SA_PEAK, SA_PEAK, SA_BASE, SA_BASE, SA_BASE, SA_BASE, SA_BASE, SA_BASE, SA_BASE, SA_PEAK, SA_PEAK],
  uyuni: [UY_WET, UY_WET, UY_WET, UY_GOOD, UY_GOOD, UY_PEAK, UY_PEAK, UY_GOOD, UY_GOOD, UY_GOOD, UY_GOOD, UY_WET],
  yellowstone: [YS_PEAK, YS_PEAK, YS_PEAK, YS_DIP, YS_DIP, YS_MID, YS_MID, YS_MID, YS_MID, YS_DIP, YS_PEAK, YS_PEAK],
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
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
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
