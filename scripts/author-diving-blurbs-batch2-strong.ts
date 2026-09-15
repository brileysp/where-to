import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'diving';

const OVERVIEWS: Record<string, string> = {
  'monterey-big-sur': 'Monterey Bay is real, serious cold-water diving — a thick wetsuit or drysuit is essential year-round, with water in the 50s°F even in summer. The reward is giant kelp forests full of sea lions, harbor seals, sea otters, and rockfish; there\'s no coral, and visibility is modest by tropical standards, typically 15-30 feet.',
  'big-island': 'The Kona coast\'s night manta ray dive is a genuine bucket-list experience — lights attract plankton, plankton attracts mantas, and they feed just meters from divers and snorkelers. Daytime reef diving along the same coast is calm and easy.',
  'costa-rica': 'The Pacific coast has real diving, if secondary to the country\'s rainforest reputation — Caño Island Biological Reserve and the Bat Islands (bull sharks) are the highlights. Cocos Island, with its schooling hammerheads, is a different trip entirely: a remote, liveaboard-only marine park well offshore.',
  tanzania: 'Zanzibar\'s Mnemba Atoll is the real diving draw here — healthy coral, turtles, and a real chance of whale sharks between October and March. It\'s a genuinely different trip from the mainland safari the country is best known for.',
  maui: 'Molokini Crater — a crescent-shaped, partially sunken volcanic crater a few miles offshore — is Maui\'s signature site, prized for exceptionally clear water. Its back wall drops steeply and draws more experienced divers; the inside crater is calm and easy, good for snorkelers too.',
  srilanka: 'The island runs two monsoons on opposite schedules — the more-visited south/west coast (Hikkaduwa, Pigeon Island\'s reef sharks and turtles) is best in the northern winter, while the east coast (Trincomalee, with real WWII-era wrecks) runs the opposite calendar. Whichever coast is in season, this is real but modest diving, a tier below Southeast Asia\'s best.',
  barbados: 'Several deliberately sunk wrecks make for easy, reliable wreck diving close to shore, and Carlisle Bay is a genuinely good spot to snorkel with sea turtles. Conditions are calm and easy most of the year.',
  aruba: 'The Antilla — one of the largest, most accessible shipwrecks in the Caribbean — is the headline dive, sitting in shallow, calm water good for beginners. Aruba sits just outside the hurricane belt, so conditions stay reliable essentially year-round.',
  'colombian-caribbean': 'The Rosario Islands, a short boat ride from Cartagena, offer easy, casual reef snorkeling and diving — real, but modest compared to the Caribbean\'s bigger dive destinations.',
  canaries: 'Volcanic terrain continues underwater — black sand, lava arches, and caves rather than coral, with sea turtles and occasional visits from pelagic species passing through. It\'s a real, distinct diving environment, if a modest one.',
  havana: 'Havana itself isn\'t Cuba\'s dive hub — Playa Girón (Bay of Pigs), a few hours away, has real wall diving, and it\'s common to extend a Cuba trip toward Jardines de la Reina, a remote, exceptionally healthy reef system further east.',
  croatia: 'The Baron Gautsch, an Austro-Hungarian passenger ship sunk in 1914, is Croatia\'s best-known wreck dive, and the island of Vis has real cave and cavern sites. Visibility is generally excellent, though marine life is modest compared to warmer seas.',
  panama: 'Panama has two very different coasts: Coiba National Park on the Pacific side, sometimes called "Panama\'s Galápagos" for its whale sharks and hammerheads, and Bocas del Toro on the Caribbean side, a calmer, more casual mangrove-and-reef destination.',
  'cape-town': 'Cape Town\'s cold Atlantic kelp forests — the same ecosystem made famous by "My Octopus Teacher" — are the real specialty here: octopus, pyjama sharks, and dense kelp canopies in clear, cold water. A thick wetsuit or drysuit is essential.',
  dubai: 'Diving here is real but modest — artificial reefs and wrecks in warm, calm Gulf water, more a side activity than a dedicated dive destination.',
  'los-cabos': 'Cabo Pulmo National Marine Park is the real story — a nearly dead reef in the 1980s, now one of the most successful marine recovery stories anywhere, with fish biomass up several hundred percent since it was protected in 1995. Los Islotes, further north near La Paz, is a reliable spot to snorkel with a resident sea lion colony.',
  sardinia: 'Neptune\'s Grotto and the surrounding limestone coastline offer real cave and cavern diving, plus exceptionally clear Mediterranean water — modest marine life, but genuinely beautiful underwater terrain.',
  'puerto-rico': 'Culebra and Vieques have the real reef diving — clear water, healthier coral than the main island\'s coast — and Vieques\' bioluminescent bay is a genuine, if different, nighttime experience best seen by kayak or snorkel.',
  mallorca: 'Clear Mediterranean water and some real cave systems along the coast, though marine life is modest — this is more about scenery and water clarity than a wildlife-driven dive destination.',
  madagascar: 'Nosy Be, off the northwest coast, has real coral reef diving and a genuine whale shark season overlapping the dry months — a marine complement to the country\'s famous lemur trekking, in a different part of the island entirely.',
  sydney: 'This is real temperate diving, not tropical — grey nurse sharks gather at sites like Magic Point and Fish Rock year-round, and weedy seadragons, found only in this part of the world, are a genuine specialty.',
  jamaica: 'Reef diving and some real wrecks along the north coast, calm and casual rather than a dedicated bucket-list destination.',
  'north-island': 'The Poor Knights Islands, a marine reserve off Tutukaka, are consistently ranked among the world\'s best temperate dive sites — a warm subtropical current brings an unusual mix of tropical and temperate species together in the same water.',
  sicily: 'The waters around Sicily and nearby Ustica (a protected marine reserve) offer real Mediterranean diving — wrecks, caves, and clear water, with modest but genuine marine life.',
};

const MED_COLD = 'Cold water, few operators running.';
const MED_IMPROVE = 'Conditions improve as the water warms.';
const MED_PEAK = 'The warmest water and best diving conditions of the year.';
const MED_COOLING = 'Still decent, cooling down.';
const MED_BACK_TO_COLD = 'Back to the cold, quiet off-season.';

const MONTHLY: Record<string, string[]> = {
  'monterey-big-sur': Array(12).fill('Diving here doesn\'t really have a season — the water is cold and visibility modest every month, sometimes marginally clearer in winter when the kelp itself thins out. The sea lions, seals, and otters are just as reliable year-round.'),
  'big-island': [
    'The wetter, choppier season, especially on the Hilo side; Kona stays comparatively calm, and the manta night dive runs year-round.',
    'The wetter, choppier season, especially on the Hilo side; Kona stays comparatively calm, and the manta night dive runs year-round.',
    'The wetter, choppier season, especially on the Hilo side; Kona stays comparatively calm, and the manta night dive runs year-round.',
    'Conditions are improving.',
    'The dry season — the calmest, clearest conditions of the year.',
    'The dry season — the calmest, clearest conditions of the year.',
    'The dry season — the calmest, clearest conditions of the year.',
    'The dry season — the calmest, clearest conditions of the year.',
    'The dry season — the calmest, clearest conditions of the year.',
    'Still good, easing toward winter.',
    'The wetter season returns.',
    'The wetter season returns.',
  ],
  'costa-rica': [
    'Dry season — the calmest, clearest conditions of the year.', 'Dry season — the calmest, clearest conditions of the year.',
    'Dry season — the calmest, clearest conditions of the year.', 'Dry season — the calmest, clearest conditions of the year.',
    'Green season is underway; conditions ease but diving continues.', 'Green season is underway; conditions ease but diving continues.',
    'Green season is underway; conditions ease but diving continues.', 'Green season is underway; conditions ease but diving continues.',
    'The wettest months — the least reliable stretch of the year.', 'The wettest months — the least reliable stretch of the year.',
    'Conditions are recovering.',
    'Dry season returns.',
  ],
  tanzania: [
    'Good conditions, and within whale shark season at Mnemba.', 'Good conditions, and within whale shark season at Mnemba.',
    'The long rains — the least reliable stretch of the year for diving.', 'The long rains — the least reliable stretch of the year for diving.', 'The long rains — the least reliable stretch of the year for diving.',
    'The dry season — the best visibility of the year, though whale shark season has ended by this point.', 'The dry season — the best visibility of the year, though whale shark season has ended by this point.', 'The dry season — the best visibility of the year, though whale shark season has ended by this point.', 'The dry season — the best visibility of the year, though whale shark season has ended by this point.', 'The dry season — the best visibility of the year, though whale shark season has ended by this point.',
    'Conditions remain good, and whale sharks return for the season.', 'Conditions remain good, and whale sharks return for the season.',
  ],
  maui: [
    'The wetter, choppier season.',
    'Conditions are improving.', 'Conditions are improving.',
    'The calmest, clearest stretch of the year at Molokini.', 'The calmest, clearest stretch of the year at Molokini.', 'The calmest, clearest stretch of the year at Molokini.', 'The calmest, clearest stretch of the year at Molokini.', 'The calmest, clearest stretch of the year at Molokini.', 'The calmest, clearest stretch of the year at Molokini.',
    'Still good, easing toward winter.',
    'The wetter season returns.', 'The wetter season returns.',
  ],
  srilanka: [
    'The south/west coast\'s best season — calm, clear conditions.', 'The south/west coast\'s best season — calm, clear conditions.', 'The south/west coast\'s best season — calm, clear conditions.',
    'Conditions on the south/west coast are easing as its monsoon approaches.',
    'A transitional month on the south/west coast — the east coast (Trincomalee) is heading into its own better season.',
    'The south/west coast\'s monsoon — genuinely poor diving conditions there; the east coast is in season instead.', 'The south/west coast\'s monsoon — genuinely poor diving conditions there; the east coast is in season instead.', 'The south/west coast\'s monsoon — genuinely poor diving conditions there; the east coast is in season instead.',
    'A transitional month as the south/west coast\'s season begins returning.',
    'The south/west coast\'s season is returning.', 'The south/west coast\'s season is returning.',
    'The south/west coast\'s best season is back — calm, clear conditions.',
  ],
  barbados: [
    'Dry season, calm and clear — the best window of the year.', 'Dry season, calm and clear — the best window of the year.', 'Dry season, calm and clear — the best window of the year.', 'Dry season, calm and clear — the best window of the year.',
    'Conditions begin easing as hurricane season approaches.',
    'Hurricane season is underway; conditions are less consistent.', 'Hurricane season is underway; conditions are less consistent.',
    'Peak hurricane risk — the least reliable stretch of the year.', 'Peak hurricane risk — the least reliable stretch of the year.', 'Peak hurricane risk — the least reliable stretch of the year.',
    'Conditions are recovering.',
    'Dry season returns.',
  ],
  aruba: Array(12).fill('Conditions stay reliably calm and clear essentially year-round — there\'s no real off-season here.'),
  'colombian-caribbean': [
    'Dry season — the calmest, clearest conditions of the year.', 'Dry season — the calmest, clearest conditions of the year.', 'Dry season — the calmest, clearest conditions of the year.', 'Dry season — the calmest, clearest conditions of the year.',
    'The wetter season — conditions are noticeably less consistent.', 'The wetter season — conditions are noticeably less consistent.', 'The wetter season — conditions are noticeably less consistent.', 'The wetter season — conditions are noticeably less consistent.', 'The wetter season — conditions are noticeably less consistent.', 'The wetter season — conditions are noticeably less consistent.', 'The wetter season — conditions are noticeably less consistent.',
    'Dry season returns.',
  ],
  canaries: Array(12).fill('Diving here doesn\'t really have an off-season — mild, sunny conditions year-round with only minor swings.'),
  havana: [
    'Dry season, calm and comfortable — the best window of the year.', 'Dry season, calm and comfortable — the best window of the year.', 'Dry season, calm and comfortable — the best window of the year.', 'Dry season, calm and comfortable — the best window of the year.',
    'Conditions ease as hurricane season approaches.',
    'Hurricane season is underway; conditions are less consistent.', 'Hurricane season is underway; conditions are less consistent.',
    'Peak hurricane risk — the least reliable stretch of the year.', 'Peak hurricane risk — the least reliable stretch of the year.', 'Peak hurricane risk — the least reliable stretch of the year.',
    'Dry season returns.', 'Dry season returns.',
  ],
  croatia: [MED_COLD, MED_COLD, MED_IMPROVE, MED_IMPROVE, MED_IMPROVE, MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK, MED_COOLING, MED_COOLING, MED_BACK_TO_COLD],
  panama: [
    'Dry season on the Pacific side — the best conditions of the year for Coiba.', 'Dry season on the Pacific side — the best conditions of the year for Coiba.', 'Dry season on the Pacific side — the best conditions of the year for Coiba.', 'Dry season on the Pacific side — the best conditions of the year for Coiba.',
    'The wet season — conditions are noticeably rougher, especially on the Pacific side.', 'The wet season — conditions are noticeably rougher, especially on the Pacific side.', 'The wet season — conditions are noticeably rougher, especially on the Pacific side.', 'The wet season — conditions are noticeably rougher, especially on the Pacific side.', 'The wet season — conditions are noticeably rougher, especially on the Pacific side.', 'The wet season — conditions are noticeably rougher, especially on the Pacific side.', 'The wet season — conditions are noticeably rougher, especially on the Pacific side.',
    'Conditions are improving as the dry season returns.',
  ],
  'cape-town': [
    'Summer — generally the clearest, calmest conditions.', 'Summer — generally the clearest, calmest conditions.', 'Summer — generally the clearest, calmest conditions.',
    'Conditions ease as winter approaches.', 'Conditions ease as winter approaches.',
    'Winter — the roughest, least consistent stretch of the year.', 'Winter — the roughest, least consistent stretch of the year.', 'Winter — the roughest, least consistent stretch of the year.',
    'Conditions are recovering.', 'Conditions are recovering.',
    'Back to the clearer summer conditions.', 'Back to the clearer summer conditions.',
  ],
  dubai: [
    'The most comfortable, pleasant conditions of the year.', 'The most comfortable, pleasant conditions of the year.', 'The most comfortable, pleasant conditions of the year.',
    'Extreme summer heat makes surface conditions uncomfortable, though the water itself is diveable.', 'Extreme summer heat makes surface conditions uncomfortable, though the water itself is diveable.', 'Extreme summer heat makes surface conditions uncomfortable, though the water itself is diveable.', 'Extreme summer heat makes surface conditions uncomfortable, though the water itself is diveable.', 'Extreme summer heat makes surface conditions uncomfortable, though the water itself is diveable.', 'Extreme summer heat makes surface conditions uncomfortable, though the water itself is diveable.', 'Extreme summer heat makes surface conditions uncomfortable, though the water itself is diveable.',
    'Comfortable conditions return.', 'Comfortable conditions return.',
  ],
  'los-cabos': [
    'Calmer, clearer conditions, and gray whales are in the nearby lagoons — not part of the dive itself, but a real bonus for a trip timed here.',
    'Calmer, clearer conditions, and gray whales are in the nearby lagoons — not part of the dive itself, but a real bonus for a trip timed here.',
    'Calmer, clearer conditions, and gray whales are in the nearby lagoons — not part of the dive itself, but a real bonus for a trip timed here.',
    'Calmer, clearer conditions, and gray whales are in the nearby lagoons — not part of the dive itself, but a real bonus for a trip timed here.',
    'Calmer, clearer conditions, and gray whales are in the nearby lagoons — not part of the dive itself, but a real bonus for a trip timed here.',
    'Warmer water, slightly less consistent conditions.', 'Warmer water, slightly less consistent conditions.', 'Warmer water, slightly less consistent conditions.', 'Warmer water, slightly less consistent conditions.', 'Warmer water, slightly less consistent conditions.',
    'Conditions improve again.', 'Conditions improve again.',
  ],
  sardinia: [MED_COLD, MED_COLD, MED_IMPROVE, MED_IMPROVE, MED_IMPROVE, MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK, MED_COOLING, MED_BACK_TO_COLD, MED_BACK_TO_COLD],
  'puerto-rico': [
    'The calmest, clearest stretch of the year.', 'The calmest, clearest stretch of the year.', 'The calmest, clearest stretch of the year.', 'The calmest, clearest stretch of the year.',
    'Conditions stay decent, with hurricane season (Jun-Nov, peaking Aug-Oct) adding some real risk of disruption.', 'Conditions stay decent, with hurricane season (Jun-Nov, peaking Aug-Oct) adding some real risk of disruption.', 'Conditions stay decent, with hurricane season (Jun-Nov, peaking Aug-Oct) adding some real risk of disruption.', 'Conditions stay decent, with hurricane season (Jun-Nov, peaking Aug-Oct) adding some real risk of disruption.', 'Conditions stay decent, with hurricane season (Jun-Nov, peaking Aug-Oct) adding some real risk of disruption.', 'Conditions stay decent, with hurricane season (Jun-Nov, peaking Aug-Oct) adding some real risk of disruption.', 'Conditions stay decent, with hurricane season (Jun-Nov, peaking Aug-Oct) adding some real risk of disruption.', 'Conditions stay decent, with hurricane season (Jun-Nov, peaking Aug-Oct) adding some real risk of disruption.',
  ],
  mallorca: [MED_COLD, MED_COLD, MED_IMPROVE, MED_IMPROVE, MED_IMPROVE, MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK, MED_COOLING, MED_BACK_TO_COLD, MED_BACK_TO_COLD],
  madagascar: [
    'Cyclone season — the least reliable stretch of the year.', 'Cyclone season — the least reliable stretch of the year.', 'Cyclone season — the least reliable stretch of the year.',
    'Conditions are improving.',
    'The dry season — the best diving conditions, with whale sharks most likely toward the start of this window.', 'The dry season — the best diving conditions, with whale sharks most likely toward the start of this window.', 'The dry season — the best diving conditions, with whale sharks most likely toward the start of this window.', 'The dry season — the best diving conditions, with whale sharks most likely toward the start of this window.', 'The dry season — the best diving conditions, with whale sharks most likely toward the start of this window.', 'The dry season — the best diving conditions, with whale sharks most likely toward the start of this window.',
    'Still decent, easing toward cyclone season.',
    'Cyclone risk returns.',
  ],
  sydney: [
    'Summer — the warmest water and most comfortable diving of the year.', 'Summer — the warmest water and most comfortable diving of the year.', 'Summer — the warmest water and most comfortable diving of the year.',
    'Conditions cool but remain diveable.', 'Conditions cool but remain diveable.', 'Conditions cool but remain diveable.',
    'The coldest, least comfortable month for diving without a thick wetsuit.',
    'Conditions gradually warm back up.', 'Conditions gradually warm back up.', 'Conditions gradually warm back up.', 'Conditions gradually warm back up.',
    'Back to warm summer conditions.',
  ],
  jamaica: [
    'Dry season, calm and clear — the best window of the year.', 'Dry season, calm and clear — the best window of the year.', 'Dry season, calm and clear — the best window of the year.', 'Dry season, calm and clear — the best window of the year.',
    'The wetter, hurricane-risk stretch of the year — conditions are noticeably less consistent.', 'The wetter, hurricane-risk stretch of the year — conditions are noticeably less consistent.',
    'A brief better window within hurricane season, though risk remains.', 'A brief better window within hurricane season, though risk remains.',
    'The wetter, hurricane-risk stretch of the year — conditions are noticeably less consistent.', 'The wetter, hurricane-risk stretch of the year — conditions are noticeably less consistent.', 'The wetter, hurricane-risk stretch of the year — conditions are noticeably less consistent.',
    'Dry season returns.',
  ],
  'north-island': [
    'Summer — the warmest water and best visibility of the year at the Poor Knights.', 'Summer — the warmest water and best visibility of the year at the Poor Knights.', 'Summer — the warmest water and best visibility of the year at the Poor Knights.',
    'Conditions ease as the water cools.', 'Conditions ease as the water cools.',
    'Winter — the coldest, least comfortable stretch.', 'Winter — the coldest, least comfortable stretch.', 'Winter — the coldest, least comfortable stretch.',
    'Conditions gradually improve.', 'Conditions gradually improve.', 'Conditions gradually improve.',
    'Back to warm summer conditions.',
  ],
  sicily: [MED_COLD, MED_COLD, MED_IMPROVE, MED_IMPROVE, MED_IMPROVE, MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK, MED_COOLING, MED_BACK_TO_COLD, MED_BACK_TO_COLD],
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try { raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8'); } catch { return out; }
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
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12 (${MONTHLY[id].length})`); process.exit(1); }
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
