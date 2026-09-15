import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'windSports';

const OVERVIEWS: Record<string, string> = {
  maui: 'Ho\'okipa Beach, on Maui\'s North Shore, is one of the classic windsurfing waves on Earth — a rare combination of real swell and real wind that built the island\'s whole wind-sports reputation. This is a year-round destination: trade winds are consistent enough that there\'s no real dead season, though April through September is when the wind is strongest and steadiest.',
  aruba: 'Fisherman\'s Huts (Hadicurari) is windsurfable essentially every day of the year — even in the calmest months, more than 75% of days still bring reliable planing wind. Kitesurfing is based nearby at Boca Grandi, on the rougher north coast. June through August is both the windiest stretch and when the Aruba Hi-Winds tournament, the Caribbean\'s largest windsurfing event, has run since 1986.',
  mauritius: 'Le Morne, on Mauritius\' southwest coast, is regarded as one of the best kitesurfing spots on the planet — a flat lagoon on one side, real waves on the other, within about a mile of each other. The main season runs June through November; December through April is real but genuinely more variable, with a higher chance of cyclones.',
  'cape-town': 'Bloubergstrand and Big Bay owe their reputation to the "Cape Doctor," a forceful southeasterly that blows October through March — strong enough to host the Red Bull King of the Air, the sport\'s marquee Big Air event, most years in November or December. May through August is genuinely the region\'s quiet season for wind, driven by Cape Town\'s wet Mediterranean-climate winter.',
  morocco: 'Essaouira, on Morocco\'s Atlantic coast, has earned the nickname "the Windy City of Africa" — the Alizée trade winds blow nearly all year, funneled and accelerated by the coastal terrain. April through October is the real season, peaking July through September; winter is calmer but rarely windless.',
  canaries: 'Fuerteventura\'s Sotavento lagoon has hosted the PWA Windsurfing & Kiteboarding World Cup for over 30 years — trade winds here can exceed 50 knots in peak season. This works essentially year-round, though winter (November through February) is genuinely the least reliable stretch; March through October is when to actually plan a trip.',
  andalucia: 'Tarifa, where the Atlantic meets the Mediterranean at the Strait of Gibraltar, is widely known as Europe\'s windsurfing and kitesurfing capital — the pressure difference between the two seas produces wind roughly 300 days a year. This is genuinely a year-round destination; July and August are the windiest, but there\'s no real off-season.',
  oaxaca: 'La Ventosa, in the Isthmus of Tehuantepec, is one of the windiest places documented on Earth — a Venturi effect between two mountain ranges channels cold-front-driven winds that can exceed 50 knots. This is a genuinely seasonal, winter-only phenomenon: the wind is driven by cold-air surges that only occur roughly October through April, peaking January-February; outside that window there\'s essentially no wind for the sport.',
  sicily: 'Lo Stagnone, a shallow lagoon near Marsala, is known across Europe as one of the world\'s capitals of kitesurfing — flat water, no waves, and constant thermal wind roughly 300 days a year. This runs essentially year-round, with April through October the real, reliable season and winter genuinely quieter.',
  sardinia: 'Porto Pollo, in the channel between Sardinia and Corsica, is internationally renowned for windsurfing, kitesurfing, and wingfoiling — it hosted the IKA Kiteboarding World Championship finals in 2016. The reliable Maestrale wind season runs April through November; December through March is genuinely quieter, and much of the spot\'s own infrastructure winds down for the winter.',
  'costa-rica': 'Lake Arenal is rated among the best windsurfing and kitesurfing lakes in the world — thermal winds funneled by the surrounding hills and Arenal Volcano can hit 25-30 knots daily. This is a genuinely seasonal destination built around the dry season (December through April); the wet season (May through November) is real but notably less reliable, with schools operating only when conditions allow.',
  'los-cabos': 'La Ventana, on the Sea of Cortez near La Paz, was ranked the #1 kiteboarding spot in the world by Discovery Channel — thermal "El Norte" winds blow reliably from late October through mid-May. Summer (roughly June through September) is the real off-season, when the wind mechanism driving La Ventana simply isn\'t present.',
  egypt: 'El Gouna, Hurghada, and Ras Sudr, all on the Red Sea, are established kitesurfing and windsurfing hubs — steady thermal winds funneled by the surrounding desert blow over warm, shallow lagoons that are easy to learn in. This works year-round; the thermal wind builds through the year and peaks in September, with winter genuinely the calmer season.',
  vietnam: 'Mui Ne is billed as Vietnam\'s windsurfing and kitesurfing capital — Asia\'s strongest, most consistent cross-onshore wind, with roughly 230 windy days a year. This works essentially year-round: winter (November through March) is the strongest window, but the lighter summer wind is still genuinely rideable, not a dead season.',
  namibia: 'Walvis Bay Lagoon is one of Namibia\'s two established kitesurfing spots — flat, shallow water on one side for beginners, real waves on the outside for advanced riders, with wind that can reach 35 knots. The main season runs November through April; May through October is genuinely the quieter stretch.',
  provence: 'The Camargue coast, especially Beauduc and the beaches near Les Saintes-Maries-de-la-Mer, is one of France\'s best-known kitesurfing regions — driven by the Mistral, a powerful wind funneled down the Rhône valley. The Mistral is strongest and most frequent November through April, but it can blow at any time of year, including a lighter autumn presence.',
  'turks-caicos': 'Long Bay Beach, on Providenciales, is described as a kite school "designed by nature" — three miles of shallow, flat water with reliable onshore wind for roughly 10 months of the year. December through May is the strongest window; June through October is genuinely the only real dip, coinciding with hurricane season.',
};

const MONTHLY: Record<string, string[]> = {
  maui: [
    'The quietest stretch of the year for wind at Ho\'okipa — trade winds are lighter, but this still isn\'t a dead season.',
    'Trade winds at Ho\'okipa are moderate and ridable, building toward spring.',
    'Trade winds at Ho\'okipa are moderate and ridable, building toward spring.',
    'Trade winds at Ho\'okipa are moderate and ridable, building toward spring.',
    'Trade winds at Ho\'okipa nearing peak strength.',
    'Peak windsurfing season at Ho\'okipa — the trade wind is strongest and most reliable all year.',
    'Peak windsurfing season at Ho\'okipa — the trade wind is strongest and most reliable all year.',
    'Peak windsurfing season at Ho\'okipa — the trade wind is strongest and most reliable all year.',
    'Still excellent windsurfing wind at Ho\'okipa, just easing from peak.',
    'Trade winds at Ho\'okipa easing back to a moderate, still-ridable level.',
    'The quietest stretch of the year for wind at Ho\'okipa — trade winds are lighter, but this still isn\'t a dead season.',
    'The quietest stretch of the year for wind at Ho\'okipa — trade winds are lighter, but this still isn\'t a dead season.',
  ],
  aruba: [
    'Solid, dependable trade winds for windsurfing at Fisherman\'s Huts — never a dead month here.',
    'Solid, dependable trade winds for windsurfing at Fisherman\'s Huts — never a dead month here.',
    'Solid, dependable trade winds for windsurfing at Fisherman\'s Huts — never a dead month here.',
    'Solid, dependable trade winds for windsurfing at Fisherman\'s Huts — never a dead month here.',
    'Wind building toward peak windsurfing season at Fisherman\'s Huts.',
    'Peak windsurfing season at Fisherman\'s Huts, including the Hi-Winds tournament.',
    'Peak windsurfing season at Fisherman\'s Huts, including the Hi-Winds tournament.',
    'Peak windsurfing season at Fisherman\'s Huts, including the Hi-Winds tournament.',
    'Still excellent wind at Fisherman\'s Huts, just easing from peak.',
    'Solid, dependable trade winds for windsurfing at Fisherman\'s Huts — never a dead month here.',
    'Solid, dependable trade winds for windsurfing at Fisherman\'s Huts — never a dead month here.',
    'Solid, dependable trade winds for windsurfing at Fisherman\'s Huts — never a dead month here.',
  ],
  mauritius: [
    'The wet season at Le Morne — kiteable, but wind is genuinely more variable here, with a higher chance of cyclones.',
    'The wet season at Le Morne — kiteable, but wind is genuinely more variable here, with a higher chance of cyclones.',
    'The wet season at Le Morne — kiteable, but wind is genuinely more variable here, with a higher chance of cyclones.',
    'Wind at Le Morne picking back up as the wet season eases.',
    'Wind at Le Morne building toward the main season.',
    'Peak kitesurfing season at Le Morne — the trade wind is strongest and most reliable all year.',
    'Peak kitesurfing season at Le Morne — the trade wind is strongest and most reliable all year.',
    'Peak kitesurfing season at Le Morne — the trade wind is strongest and most reliable all year.',
    'Still excellent wind at Le Morne, just easing from peak.',
    'The main season at Le Morne easing into its shoulder — real, dependable wind, just short of peak.',
    'The main season at Le Morne easing into its shoulder — real, dependable wind, just short of peak.',
    'The main season at Le Morne easing into its shoulder — real, dependable wind, just short of peak.',
  ],
  'cape-town': [
    'Peak Cape Doctor season at Bloubergstrand and Big Bay — the wind is at its strongest and most reliable all year.',
    'Peak Cape Doctor season at Bloubergstrand and Big Bay — the wind is at its strongest and most reliable all year.',
    'Still within Cape Doctor season at Bloubergstrand and Big Bay, just past peak.',
    'Cape Doctor season easing at Bloubergstrand and Big Bay, though still solid.',
    'The Cape Doctor is fading at Bloubergstrand and Big Bay as Cape Town\'s wet winter sets in.',
    'The genuine quiet season for wind at Bloubergstrand and Big Bay — Cape Town\'s wet winter means this isn\'t a realistic time to plan a wind-sports trip around.',
    'The genuine quiet season for wind at Bloubergstrand and Big Bay — Cape Town\'s wet winter means this isn\'t a realistic time to plan a wind-sports trip around.',
    'The genuine quiet season for wind at Bloubergstrand and Big Bay — Cape Town\'s wet winter means this isn\'t a realistic time to plan a wind-sports trip around.',
    'The Cape Doctor picking back up at Bloubergstrand and Big Bay as winter eases.',
    'Cape Doctor season building at Bloubergstrand and Big Bay.',
    'Cape Doctor season in full swing at Bloubergstrand and Big Bay, including most years\' Red Bull King of the Air.',
    'Peak Cape Doctor season at Bloubergstrand and Big Bay — the wind is at its strongest and most reliable all year.',
  ],
  morocco: [
    'The calmer season at Essaouira — the Alizée trade wind is lighter here, but real wind still blows most days.',
    'The calmer season at Essaouira — the Alizée trade wind is lighter here, but real wind still blows most days.',
    'The calmer season at Essaouira — the Alizée trade wind is lighter here, but real wind still blows most days.',
    'The Alizée trade wind picking up at Essaouira.',
    'Strong, building Alizée trade winds at Essaouira, nearing peak.',
    'Strong, building Alizée trade winds at Essaouira, nearing peak.',
    'Peak Alizée trade-wind season at Essaouira — the "Windy City of Africa" living up to its name.',
    'Peak Alizée trade-wind season at Essaouira — the "Windy City of Africa" living up to its name.',
    'Peak Alizée trade-wind season at Essaouira — the "Windy City of Africa" living up to its name.',
    'The Alizée trade wind easing at Essaouira, still strong.',
    'The calmer season at Essaouira — the Alizée trade wind is lighter here, but real wind still blows most days.',
    'The calmer season at Essaouira — the Alizée trade wind is lighter here, but real wind still blows most days.',
  ],
  canaries: [
    'Winter at Sotavento — the least reliable stretch of the year, though the trade wind rarely disappears entirely.',
    'Winter at Sotavento — the least reliable stretch of the year, though the trade wind rarely disappears entirely.',
    'Winter at Sotavento — the least reliable stretch of the year, though the trade wind rarely disappears entirely.',
    'Trade winds building at Sotavento.',
    'Trade winds nearing peak at Sotavento.',
    'Peak trade-wind season at Sotavento — home of the PWA World Cup, and the wind is at its strongest and most reliable.',
    'Peak trade-wind season at Sotavento — home of the PWA World Cup, and the wind is at its strongest and most reliable.',
    'Peak trade-wind season at Sotavento — home of the PWA World Cup, and the wind is at its strongest and most reliable.',
    'Still excellent trade winds at Sotavento, just easing from peak.',
    'Trade winds easing further at Sotavento, still solid.',
    'Winter at Sotavento — the least reliable stretch of the year, though the trade wind rarely disappears entirely.',
    'Winter at Sotavento — the least reliable stretch of the year, though the trade wind rarely disappears entirely.',
  ],
  andalucia: [
    'Tarifa\'s quieter stretch — still real, rideable wind most days, just not peak strength.',
    'Tarifa\'s quieter stretch — still real, rideable wind most days, just not peak strength.',
    'Tarifa\'s quieter stretch — still real, rideable wind most days, just not peak strength.',
    'Wind building at Tarifa.',
    'Wind nearing peak at Tarifa.',
    'Peak windsurfing and kitesurfing season at Tarifa — the Strait of Gibraltar wind at its strongest.',
    'Peak windsurfing and kitesurfing season at Tarifa — the Strait of Gibraltar wind at its strongest.',
    'Peak windsurfing and kitesurfing season at Tarifa — the Strait of Gibraltar wind at its strongest.',
    'Still excellent wind at Tarifa, just easing from peak.',
    'Still excellent wind at Tarifa, just easing from peak.',
    'Tarifa\'s quieter stretch — still real, rideable wind most days, just not peak strength.',
    'Tarifa\'s quieter stretch — still real, rideable wind most days, just not peak strength.',
  ],
  oaxaca: [
    'Peak Tehuantepecer wind season at La Ventosa — the strongest, most extreme winds of the year.',
    'Peak Tehuantepecer wind season at La Ventosa — the strongest, most extreme winds of the year.',
    'Still strong Tehuantepecer winds at La Ventosa, just past peak.',
    'Tehuantepecer wind season easing at La Ventosa.',
    'The Tehuantepecer winds are fading at La Ventosa as the cold-front season ends.',
    'Outside the Tehuantepecer wind season at La Ventosa — the cold-air surges that drive this wind don\'t occur in summer, so this isn\'t a realistic time to plan around it.',
    'Outside the Tehuantepecer wind season at La Ventosa — the cold-air surges that drive this wind don\'t occur in summer, so this isn\'t a realistic time to plan around it.',
    'Outside the Tehuantepecer wind season at La Ventosa — the cold-air surges that drive this wind don\'t occur in summer, so this isn\'t a realistic time to plan around it.',
    'Outside the Tehuantepecer wind season at La Ventosa — the cold-air surges that drive this wind don\'t occur in summer, so this isn\'t a realistic time to plan around it.',
    'The Tehuantepecer wind season beginning at La Ventosa as the first cold-front surges arrive.',
    'Tehuantepecer wind season building at La Ventosa.',
    'Peak Tehuantepecer wind season at La Ventosa — the strongest, most extreme winds of the year.',
  ],
  sicily: [
    'Winter at Lo Stagnone — genuinely the quietest stretch, though the lagoon\'s thermal wind doesn\'t fully disappear.',
    'Wind picking up at Lo Stagnone as winter eases.',
    'Wind picking up at Lo Stagnone as winter eases.',
    'Solid, building thermal wind at Lo Stagnone.',
    'Solid, building thermal wind at Lo Stagnone.',
    'Peak thermal-wind season at Lo Stagnone — one of Europe\'s most reliable flat-water kitesurfing windows.',
    'Peak thermal-wind season at Lo Stagnone — one of Europe\'s most reliable flat-water kitesurfing windows.',
    'Peak thermal-wind season at Lo Stagnone — one of Europe\'s most reliable flat-water kitesurfing windows.',
    'Still strong thermal wind at Lo Stagnone, easing from peak.',
    'Still strong thermal wind at Lo Stagnone, easing from peak.',
    'Winter at Lo Stagnone — genuinely the quietest stretch, though the lagoon\'s thermal wind doesn\'t fully disappear.',
    'Winter at Lo Stagnone — genuinely the quietest stretch, though the lagoon\'s thermal wind doesn\'t fully disappear.',
  ],
  sardinia: [
    'Winter at Porto Pollo — genuinely quiet, and much of the spot\'s own infrastructure closes for the season.',
    'Still quiet at Porto Pollo, ahead of the spring wind season.',
    'Still quiet at Porto Pollo, ahead of the spring wind season.',
    'The Maestrale wind season building at Porto Pollo.',
    'The Maestrale wind season building at Porto Pollo.',
    'The Maestrale wind season building at Porto Pollo.',
    'Peak Maestrale season at Porto Pollo — the wind at its strongest and most reliable, and when the spot is busiest.',
    'Peak Maestrale season at Porto Pollo — the wind at its strongest and most reliable, and when the spot is busiest.',
    'Peak Maestrale season at Porto Pollo — the wind at its strongest and most reliable, and when the spot is busiest.',
    'Still strong Maestrale wind at Porto Pollo, easing from peak.',
    'The Maestrale wind season winding down at Porto Pollo.',
    'Winter at Porto Pollo — genuinely quiet, and much of the spot\'s own infrastructure closes for the season.',
  ],
  'costa-rica': [
    'Peak dry-season wind at Lake Arenal — some of the most consistent conditions of any lake in the world.',
    'Peak dry-season wind at Lake Arenal — some of the most consistent conditions of any lake in the world.',
    'Peak dry-season wind at Lake Arenal — some of the most consistent conditions of any lake in the world.',
    'Still strong dry-season wind at Lake Arenal, just past peak.',
    'The wet season at Lake Arenal — real wind is still possible, but noticeably less consistent than the dry-season peak.',
    'The wet season at Lake Arenal — real wind is still possible, but noticeably less consistent than the dry-season peak.',
    'The wet season at Lake Arenal — real wind is still possible, but noticeably less consistent than the dry-season peak.',
    'The wet season at Lake Arenal — real wind is still possible, but noticeably less consistent than the dry-season peak.',
    'The wettest, least reliable stretch at Lake Arenal — this isn\'t a realistic time to plan a wind-sports trip around.',
    'The wettest, least reliable stretch at Lake Arenal — this isn\'t a realistic time to plan a wind-sports trip around.',
    'Conditions improving at Lake Arenal as the wet season eases.',
    'The dry season returning at Lake Arenal, building toward peak.',
  ],
  'los-cabos': [
    'Peak "El Norte" wind season at La Ventana — among the most consistent kiteboarding conditions anywhere.',
    'Peak "El Norte" wind season at La Ventana — among the most consistent kiteboarding conditions anywhere.',
    'Peak "El Norte" wind season at La Ventana — among the most consistent kiteboarding conditions anywhere.',
    'Still strong "El Norte" wind at La Ventana, just past peak.',
    '"El Norte" winds easing at La Ventana as the season winds down.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The "El Norte" wind season returning at La Ventana.',
    '"El Norte" wind season building toward peak at La Ventana.',
  ],
  egypt: [
    'The calmer winter season on the Red Sea — real wind most days at El Gouna, Hurghada, and Ras Sudr, just lighter than peak.',
    'The calmer winter season on the Red Sea — real wind most days at El Gouna, Hurghada, and Ras Sudr, just lighter than peak.',
    'The calmer winter season on the Red Sea — real wind most days at El Gouna, Hurghada, and Ras Sudr, just lighter than peak.',
    'Thermal winds building on the Red Sea.',
    'Strong, building thermal winds at El Gouna, Hurghada, and Ras Sudr.',
    'Strong, building thermal winds at El Gouna, Hurghada, and Ras Sudr.',
    'Peak thermal-wind season on the Red Sea — the strongest, most reliable conditions of the year.',
    'Peak thermal-wind season on the Red Sea — the strongest, most reliable conditions of the year.',
    'Peak thermal-wind season on the Red Sea — the strongest, most reliable conditions of the year.',
    'Still strong wind on the Red Sea, easing from peak.',
    'Thermal winds easing further on the Red Sea, still solid.',
    'The calmer winter season on the Red Sea — real wind most days at El Gouna, Hurghada, and Ras Sudr, just lighter than peak.',
  ],
  vietnam: [
    'Peak wind season at Mui Ne — Vietnam\'s strongest, most consistent wind of the year.',
    'Peak wind season at Mui Ne — Vietnam\'s strongest, most consistent wind of the year.',
    'Peak wind season at Mui Ne — Vietnam\'s strongest, most consistent wind of the year.',
    'Still strong wind at Mui Ne, just past peak.',
    'The lighter summer wind at Mui Ne — real and ridable, just not as strong as winter\'s peak.',
    'The lighter summer wind at Mui Ne — real and ridable, just not as strong as winter\'s peak.',
    'The lighter summer wind at Mui Ne — real and ridable, just not as strong as winter\'s peak.',
    'The lighter summer wind at Mui Ne — real and ridable, just not as strong as winter\'s peak.',
    'The weakest stretch at Mui Ne, coinciding with Vietnam\'s rainy season — the least reliable months for wind here.',
    'The weakest stretch at Mui Ne, coinciding with Vietnam\'s rainy season — the least reliable months for wind here.',
    'Wind building back at Mui Ne toward the winter peak.',
    'Wind building back at Mui Ne toward the winter peak.',
  ],
  namibia: [
    'Peak kitesurfing season at Walvis Bay Lagoon — the wind at its strongest and most reliable.',
    'Peak kitesurfing season at Walvis Bay Lagoon — the wind at its strongest and most reliable.',
    'Peak kitesurfing season at Walvis Bay Lagoon — the wind at its strongest and most reliable.',
    'Still strong wind at Walvis Bay Lagoon, just past peak.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The wind season building back at Walvis Bay Lagoon.',
    'Wind season building toward peak at Walvis Bay Lagoon.',
  ],
  provence: [
    'Peak Mistral season on the Camargue coast — the wind at its strongest and most frequent.',
    'Peak Mistral season on the Camargue coast — the wind at its strongest and most frequent.',
    'Peak Mistral season on the Camargue coast — the wind at its strongest and most frequent.',
    'Still strong Mistral wind on the Camargue coast, just past peak.',
    'The Mistral is lighter and less frequent on the Camargue coast in summer, though it can still blow — this is the quietest stretch of the year.',
    'The Mistral is lighter and less frequent on the Camargue coast in summer, though it can still blow — this is the quietest stretch of the year.',
    'The Mistral is lighter and less frequent on the Camargue coast in summer, though it can still blow — this is the quietest stretch of the year.',
    'The Mistral is lighter and less frequent on the Camargue coast in summer, though it can still blow — this is the quietest stretch of the year.',
    'The Mistral picking back up on the Camargue coast as autumn begins.',
    'The Mistral picking back up on the Camargue coast as autumn begins.',
    'Mistral season building on the Camargue coast, approaching peak.',
    'Mistral season building on the Camargue coast, approaching peak.',
  ],
  'turks-caicos': [
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'Trade winds building back at Long Bay toward the winter peak.',
    'Trade winds building back at Long Bay toward the winter peak.',
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
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
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
