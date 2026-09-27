import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'diving';

const OVERVIEWS: Record<string, string> = {
  madeira: 'Volcanic reefs and marine reserves like the Garajau Natural Reserve offer real, if modest, diving — clear Atlantic water, moray eels, and rays, but not the main reason people visit.',
  'marlborough-abel-tasman': 'New Zealand fur seal colonies are the real draw for snorkeling here — cold, clear water rather than tropical reef.',
  amalfi: 'Clear Mediterranean water along a dramatic coastline — real but casual snorkeling rather than a dedicated dive destination.',
  iceland: 'Silfra fissure — a crack between two tectonic plates filled with glacial meltwater so clear visibility can exceed 100 meters — is Iceland\'s genuinely unique dive site, cold enough to require a drysuit even in summer.',
  singapore: 'Not a dive destination in itself — visibility in the surrounding waters is generally poor — though it\'s a common gateway to better diving elsewhere in Southeast Asia.',
  'upper-peninsula': 'The Great Lakes\' cold, freshwater shipwrecks are the real draw — genuinely well-preserved wooden and iron wrecks in Lake Superior, for those willing to dive in very cold water.',
  hongkong: 'Real but modest diving around the outer islands — visibility is limited by sediment, and this isn\'t a reason to visit on its own.',
  barcelona: 'The nearby Costa Brava has real, if modest, Mediterranean diving — rocky reefs and clear water rather than a dedicated bucket-list destination.',
  jordan: 'Aqaba, on the Red Sea, has real diving — coral reefs and even a deliberately sunk military tank as an artificial reef — a genuinely different side of Jordan from Petra and Wadi Rum.',
  taiwan: 'Green Island and Orchid Island, off the east coast, have real coral reef diving and clear water — genuinely good, though little-known outside Asia.',
  'vancouver-island': 'Cold, nutrient-rich water here supports giant Pacific octopus, among the largest octopus species on Earth, and dense invertebrate life — a real, if cold-water-only, diving destination.',
  rio: 'Real but modest diving around Rio\'s coastline and nearby Ilha Grande — visibility is limited compared to Brazil\'s better dive spots further north, like Fernando de Noronha.',
  'nice-riviera': 'Clear Mediterranean water and some real wrecks off the coast — a casual, secondary activity rather than a dedicated destination.',
  tasmania: 'Kelp forests and weedy seadragons make for real, cold-water temperate diving — a niche, specialist activity here rather than a mainstream one.',
  santorini: 'Volcanic underwater terrain (lava formations, an old shipwreck) makes for a distinctive, if modest, dive around the caldera.',
  lisbon: 'The nearby Arrábida coast has real, if modest, Atlantic diving — rockier and colder than the Mediterranean, with genuine marine life.',
  algarve: 'Sagres and the surrounding Atlantic coast have real cave and cavern diving, plus regular dolphin sightings — a genuine, if secondary, activity alongside the region\'s famous beaches.',
  'punta-cana': 'Reef and wreck diving along the coast, calm and casual — real but a clear secondary activity to the beach resorts.',
  azores: 'Volcanic underwater terrain and the migrating blue and sperm whales passing offshore each spring make this a real, distinctive Atlantic dive destination, if a cold-water one.',
  nicaragua: 'The Corn Islands, off the Caribbean coast, have real, little-visited reef diving — calm, clear, and a world apart from the mainland\'s volcano-and-lake reputation.',
  vietnam: 'Con Dao and the Cham Islands have real, relatively unspoiled reef diving — a genuine, if secondary, side of a country better known for its coastline and cuisine.',
  puglia: 'Clear Adriatic and Ionian water along a relatively undeveloped coastline — real, modest Mediterranean diving.',
};

const COLD_LITTLE = 'Cold water, little diving activity.';
const WORKABLE = 'Workable but unremarkable conditions.';
const WARMEST_BEST = 'The warmest water and best conditions of the year.';

const MONTHLY: Record<string, string[]> = {
  madeira: Array(12).fill('Diving conditions stay fairly consistent year-round, with no real off-season.'),
  'marlborough-abel-tasman': [
    'The warmest, most comfortable water of the year.', 'The warmest, most comfortable water of the year.', 'The warmest, most comfortable water of the year.',
    'Conditions cool but remain workable.', 'Conditions cool but remain workable.',
    'The coldest, least comfortable months.', 'The coldest, least comfortable months.',
    'Conditions cool but remain workable.', 'Conditions cool but remain workable.', 'Conditions cool but remain workable.', 'Conditions cool but remain workable.',
    'The warmest, most comfortable water of the year.',
  ],
  amalfi: [
    COLD_LITTLE, COLD_LITTLE,
    'Cooler but workable conditions.', 'Cooler but workable conditions.', 'Cooler but workable conditions.',
    WARMEST_BEST, WARMEST_BEST, WARMEST_BEST,
    'Cooler but workable conditions.', 'Cooler but workable conditions.', 'Cooler but workable conditions.',
    COLD_LITTLE,
  ],
  iceland: [
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
    'Diveable, with a drysuit essential.', 'Diveable, with a drysuit essential.',
    'The most accessible window of the year, though the water itself stays glacially cold regardless of season.', 'The most accessible window of the year, though the water itself stays glacially cold regardless of season.', 'The most accessible window of the year, though the water itself stays glacially cold regardless of season.',
    'Diveable, with a drysuit essential.', 'Diveable, with a drysuit essential.',
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
  ],
  singapore: [
    'The heaviest monsoon rain of the year.',
    'The driest, most comfortable stretch.', 'The driest, most comfortable stretch.', 'The driest, most comfortable stretch.',
    'Conditions stay workable but unremarkable.', 'Conditions stay workable but unremarkable.', 'Conditions stay workable but unremarkable.', 'Conditions stay workable but unremarkable.', 'Conditions stay workable but unremarkable.', 'Conditions stay workable but unremarkable.',
    'The heaviest monsoon rain of the year.', 'The heaviest monsoon rain of the year.',
  ],
  'upper-peninsula': [
    'Frozen or near-frozen conditions make diving impractical.', 'Frozen or near-frozen conditions make diving impractical.', 'Frozen or near-frozen conditions make diving impractical.',
    'The realistic window, though the water stays cold regardless of month.', 'The realistic window, though the water stays cold regardless of month.', 'The realistic window, though the water stays cold regardless of month.', 'The realistic window, though the water stays cold regardless of month.', 'The realistic window, though the water stays cold regardless of month.', 'The realistic window, though the water stays cold regardless of month.', 'The realistic window, though the water stays cold regardless of month.', 'The realistic window, though the water stays cold regardless of month.',
    'Frozen or near-frozen conditions make diving impractical.',
  ],
  hongkong: [
    'Cooler, calmer conditions.', 'Cooler, calmer conditions.', 'Cooler, calmer conditions.', 'Cooler, calmer conditions.',
    'Visibility drops as the wet season builds.', 'Visibility drops as the wet season builds.',
    'Typhoon season — diving is genuinely impractical much of this stretch.', 'Typhoon season — diving is genuinely impractical much of this stretch.', 'Typhoon season — diving is genuinely impractical much of this stretch.',
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
  ],
  barcelona: [
    COLD_LITTLE,
    WORKABLE, WORKABLE, WORKABLE,
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
    WORKABLE, WORKABLE,
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
    COLD_LITTLE, COLD_LITTLE,
  ],
  jordan: [
    'Cold water makes this an unlikely time to dive.', 'Cold water makes this an unlikely time to dive.',
    'The most comfortable conditions of the year.', 'The most comfortable conditions of the year.', 'The most comfortable conditions of the year.',
    'Warm water, though surface heat is intense.', 'Warm water, though surface heat is intense.', 'Warm water, though surface heat is intense.', 'Warm water, though surface heat is intense.',
    'The most comfortable conditions of the year.', 'The most comfortable conditions of the year.',
    'Cold water makes this an unlikely time to dive.',
  ],
  taiwan: [
    'Cooler, transitional conditions, workable but not ideal.', 'Cooler, transitional conditions, workable but not ideal.',
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
    'Cooler, transitional conditions, workable but not ideal.', 'Cooler, transitional conditions, workable but not ideal.',
    'Typhoon season — genuinely risky for any boat-based diving.', 'Typhoon season — genuinely risky for any boat-based diving.', 'Typhoon season — genuinely risky for any boat-based diving.',
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
    'Cooler, transitional conditions, workable but not ideal.',
  ],
  'vancouver-island': [
    'The wettest, roughest stretch of the year.', 'The wettest, roughest stretch of the year.',
    'The more reliable window, though the water stays cold in every month regardless.', 'The more reliable window, though the water stays cold in every month regardless.', 'The more reliable window, though the water stays cold in every month regardless.', 'The more reliable window, though the water stays cold in every month regardless.', 'The more reliable window, though the water stays cold in every month regardless.', 'The more reliable window, though the water stays cold in every month regardless.', 'The more reliable window, though the water stays cold in every month regardless.', 'The more reliable window, though the water stays cold in every month regardless.',
    'The wettest, roughest stretch of the year.', 'The wettest, roughest stretch of the year.',
  ],
  rio: [
    'Peak summer rains reduce visibility.', 'Peak summer rains reduce visibility.', 'Peak summer rains reduce visibility.',
    'Improving, moderate conditions.', 'Improving, moderate conditions.',
    'The clearer, cooler, more reliable stretch of the year.', 'The clearer, cooler, more reliable stretch of the year.', 'The clearer, cooler, more reliable stretch of the year.', 'The clearer, cooler, more reliable stretch of the year.',
    'Improving, moderate conditions.', 'Improving, moderate conditions.',
    'Peak summer rains reduce visibility.',
  ],
  'nice-riviera': [
    COLD_LITTLE,
    WORKABLE, WORKABLE, WORKABLE, WORKABLE,
    WARMEST_BEST, WARMEST_BEST, WARMEST_BEST, WARMEST_BEST,
    WORKABLE,
    COLD_LITTLE, COLD_LITTLE,
  ],
  tasmania: [
    'Summer and early autumn — the most comfortable water of the year.', 'Summer and early autumn — the most comfortable water of the year.', 'Summer and early autumn — the most comfortable water of the year.', 'Summer and early autumn — the most comfortable water of the year.',
    'Cooler, transitional conditions.',
    'The coldest, least practical stretch of the year.', 'The coldest, least practical stretch of the year.',
    'Cooler, transitional conditions.', 'Cooler, transitional conditions.', 'Cooler, transitional conditions.', 'Cooler, transitional conditions.',
    'Back to warmer summer conditions.',
  ],
  santorini: [
    COLD_LITTLE, COLD_LITTLE,
    WORKABLE, WORKABLE, WORKABLE,
    WARMEST_BEST, WARMEST_BEST, WARMEST_BEST, WARMEST_BEST,
    WORKABLE,
    COLD_LITTLE, COLD_LITTLE,
  ],
  lisbon: [
    COLD_LITTLE, COLD_LITTLE,
    WORKABLE, WORKABLE, WORKABLE,
    WARMEST_BEST, WARMEST_BEST, WARMEST_BEST, WARMEST_BEST,
    WORKABLE,
    COLD_LITTLE, COLD_LITTLE,
  ],
  algarve: [
    COLD_LITTLE, COLD_LITTLE,
    WORKABLE, WORKABLE, WORKABLE,
    WARMEST_BEST, WARMEST_BEST, WARMEST_BEST, WARMEST_BEST,
    WORKABLE,
    COLD_LITTLE, COLD_LITTLE,
  ],
  'punta-cana': [
    'Dry season — the calmest, most reliable conditions.', 'Dry season — the calmest, most reliable conditions.', 'Dry season — the calmest, most reliable conditions.', 'Dry season — the calmest, most reliable conditions.',
    'Hurricane season — noticeably less consistent, with real risk of disruption.', 'Hurricane season — noticeably less consistent, with real risk of disruption.', 'Hurricane season — noticeably less consistent, with real risk of disruption.', 'Hurricane season — noticeably less consistent, with real risk of disruption.', 'Hurricane season — noticeably less consistent, with real risk of disruption.', 'Hurricane season — noticeably less consistent, with real risk of disruption.', 'Hurricane season — noticeably less consistent, with real risk of disruption.',
    'Dry season returns.',
  ],
  azores: [
    'Rougher Atlantic conditions, the least consistent stretch of the year.', 'Rougher Atlantic conditions, the least consistent stretch of the year.',
    'The more reliable window, still cold-water diving throughout, and within the spring whale migration.', 'The more reliable window, still cold-water diving throughout, and within the spring whale migration.', 'The more reliable window, still cold-water diving throughout, and within the spring whale migration.', 'The more reliable window, still cold-water diving throughout, and within the spring whale migration.', 'The more reliable window, still cold-water diving throughout.', 'The more reliable window, still cold-water diving throughout.', 'The more reliable window, still cold-water diving throughout.', 'The more reliable window, still cold-water diving throughout.',
    'Rougher Atlantic conditions, the least consistent stretch of the year.', 'Rougher Atlantic conditions, the least consistent stretch of the year.',
  ],
  nicaragua: [
    'Dry season — the calmest, clearest conditions.', 'Dry season — the calmest, clearest conditions.', 'Dry season — the calmest, clearest conditions.', 'Dry season — the calmest, clearest conditions.',
    'Conditions ease as the wet season approaches.',
    'The wettest stretch — noticeably less reliable.', 'The wettest stretch — noticeably less reliable.', 'The wettest stretch — noticeably less reliable.', 'The wettest stretch — noticeably less reliable.', 'The wettest stretch — noticeably less reliable.',
    'Dry season returns.', 'Dry season returns.',
  ],
  vietnam: [
    'Workable, moderate conditions.',
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
    'Workable, moderate conditions.', 'Workable, moderate conditions.', 'Workable, moderate conditions.', 'Workable, moderate conditions.',
    'Typhoon risk peaks, especially in the north/central coast — genuinely poor conditions.', 'Typhoon risk peaks, especially in the north/central coast — genuinely poor conditions.',
    'Conditions are recovering.',
    'Workable, moderate conditions.',
  ],
  puglia: [
    COLD_LITTLE,
    WORKABLE, WORKABLE, WORKABLE, WORKABLE,
    WARMEST_BEST, WARMEST_BEST, WARMEST_BEST, WARMEST_BEST,
    WORKABLE,
    COLD_LITTLE, COLD_LITTLE,
  ],
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
