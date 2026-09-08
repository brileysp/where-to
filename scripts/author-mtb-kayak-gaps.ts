import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Closes the "silent zero" gap for mountainBiking and kayakingRafting: 178
 * destinations had neither slider authored nor marked N/A, so they read as
 * a hard 0 indistinguishable from a deliberate "doesn't apply here" (the
 * bug the user found via North Island NZ's kayakingRafting). Every gapped
 * destination below gets an explicit call — a real tiered base score
 * (signature 7-9 / strong 6 / casual 3-4 / minor 2, reasoned from its real
 * terrain and waterways) or an explicit naSliders entry — never left to
 * default silently. Tiers follow the coffeeTea-expansion precedent.
 *
 * Written through withAdminAudit's write pattern by hand (not the helper
 * itself, to batch both sliders per destination in one row update) so the
 * audit log and live sliderCurves refit both happen — see write.ts.
 */

const ENV_LOCAL_PATH = join(__dirname, '..', '.env.local');
function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(ENV_LOCAL_PATH, 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

type Decision = { id: string; value: number } | { id: string; na: true };

// mountainBiking: real, rideable hill/trail terrain and an actual biking
// scene vs. genuinely flat/marine/desert/protected terrain where it doesn't
// apply.
const MTB: Decision[] = [
  { id: 'charleston-savannah', na: true },
  { id: 'egypt', na: true },
  { id: 'havana', na: true },
  { id: 'ireland', value: 6 },
  { id: 'los-cabos', value: 3 },
  { id: 'douro-valley-porto', value: 3 },
  { id: 'black-forest', value: 6 },
  { id: 'jamaica', value: 3 },
  { id: 'napa', value: 3 },
  { id: 'prague', na: true },
  { id: 'taiwan', value: 6 },
  { id: 'hokkaido', value: 6 },
  { id: 'yosemite', na: true }, // off-pavement biking is banned in the park
  { id: 'uganda', value: 3 },
  { id: 'cape-cod-islands', na: true },
  { id: 'edinburgh', value: 4 },
  { id: 'bahamas', na: true },
  { id: 'istanbul', na: true },
  { id: 'fjords', value: 4 },
  { id: 'guatemala', value: 3 },
  { id: 'cornwall', value: 4 },
  { id: 'san-miguel-guanajuato', value: 2 },
  { id: 'belize', na: true },
  { id: 'chicago', na: true },
  { id: 'hudson-valley', value: 4 },
  { id: 'uluru', na: true },
  { id: 'champagne', na: true },
  { id: 'komodo', na: true },
  { id: 'quebec-city', value: 4 },
  { id: 'budapest', value: 3 },
  { id: 'sardinia', value: 4 },
  { id: 'chiang-mai', value: 6 },
  { id: 'sequoia-kings-canyon', na: true }, // off-pavement biking is banned in the park
  { id: 'churchill', na: true }, // treeless subarctic tundra
  { id: 'mexicocity', value: 3 }, // Ajusco/Desierto de los Leones trails ring the city
  { id: 'denali-interior', na: true }, // off-pavement biking is banned in the park
  { id: 'panama', na: true },
  { id: 'svalbard', na: true }, // no vegetation or trail terrain
  { id: 'ghana', value: 2 },
  { id: 'nice-riviera', value: 4 },
  { id: 'barbados', na: true },
  { id: 'santorini', na: true },
  { id: 'galapagos', na: true }, // protected islands, no off-trail biking permitted
  { id: 'ethiopia', value: 3 },
  { id: 'everglades', na: true },
  { id: 'antarctica', na: true },
  { id: 'milford-sound-fiordland', na: true }, // off-pavement biking is banned in the park
  { id: 'puerto-rico', value: 4 },
  { id: 'grandcanyon', na: true }, // off-pavement biking is banned below the rim
  { id: 'algarve', value: 3 },
  { id: 'berlin', na: true },
  { id: 'bagan', value: 2 },
  { id: 'basque-country', value: 4 },
  { id: 'chiapas', value: 2 },
  { id: 'botswana', na: true }, // wetland delta, no biking terrain
  { id: 'bordeaux', na: true },
  { id: 'lisbon', value: 3 },
  { id: 'monterey-big-sur', value: 4 },
  { id: 'rajaampat', na: true },
  { id: 'falklands', value: 2 },
  { id: 'kenya', na: true }, // dangerous-wildlife safari park, biking not offered
  { id: 'maui', value: 3 },
  { id: 'okinawa', value: 3 },
  { id: 'mendoza', value: 4 },
  { id: 'luangprabang', value: 3 },
  { id: 'puglia', value: 2 },
  { id: 'greenland', na: true },
  { id: 'punta-cana', na: true },
  { id: 'kaziranga', na: true }, // wildlife park, biking not offered
  { id: 'oaxaca', value: 2 },
  { id: 'nyc', na: true },
  { id: 'lapland', value: 4 },
  { id: 'rivieramaya', na: true },
  { id: 'palawan', na: true },
  { id: 'papua-new-guinea', value: 2 },
  { id: 'pantanal', na: true }, // wetland, no biking terrain
  { id: 'tuscany', value: 4 },
  { id: 'kruger', na: true }, // dangerous-wildlife park, biking not offered
  { id: 'piedmont', value: 3 },
  { id: 'peruvian-amazon', na: true },
  { id: 'lofoten', value: 3 },
  { id: 'rwanda', value: 6 },
  { id: 'nicaragua', value: 3 },
  { id: 'upper-peninsula', value: 7 }, // Marquette is a nationally known MTB destination
  { id: 'vienna', value: 3 },
  { id: 'borneo', na: true },
  { id: 'rioja', value: 3 },
  { id: 'madagascar', value: 2 },
  { id: 'tierra-del-fuego', value: 3 },
  { id: 'st-andrews-fife', value: 3 },
  { id: 'bavaria-munich', value: 6 },
  { id: 'guilin-yangshuo', value: 4 },
  { id: 'mauritius', na: true },
  { id: 'palau', na: true },
  { id: 'uzbekistan', na: true },
  { id: 'nova-scotia', value: 4 },
  { id: 'peru', value: 6 }, // Sacred Valley downhill trails from Abra Malaga
  { id: 'buenosaires', na: true },
  { id: 'paris', na: true },
  { id: 'yellowstone', na: true }, // off-pavement biking is banned in the park
  { id: 'venice', na: true },
  { id: 'zambia', na: true }, // dangerous-wildlife park, biking not offered
  { id: 'bali', value: 4 },
  { id: 'iceland', value: 4 },
  { id: 'rome', na: true },
  { id: 'dubai', na: true },
  { id: 'big-island', value: 4 },
  { id: 'maldives', na: true },
  { id: 'borabora', na: true },
  { id: 'tokyo-kyoto', na: true },
  { id: 'fiji', na: true },
  { id: 'singapore', na: true },
  { id: 'athens', na: true },
  { id: 'angkor', value: 2 },
  { id: 'hongkong', value: 4 }, // Sai Kung / country-park trails
  { id: 'rajasthan-golden-triangle', na: true },
  { id: 'acadia', value: 3 },
  { id: 'rio', value: 3 },
  { id: 'new-orleans', na: true },
  { id: 'zimbabwe', na: true },
  { id: 'aruba', na: true },
  { id: 'amsterdam', na: true }, // famously flat, no biking terrain
  { id: 'bangkok', na: true },
  { id: 'seychelles', na: true },
  { id: 'croatia', value: 3 },
  { id: 'mallorca', value: 6 }, // Tramuntana range, a real pro-cycling training ground
  { id: 'thailand', na: true },
  { id: 'srilanka', value: 3 },
  { id: 'tanzania', na: true },
  { id: 'vietnam', value: 4 },
  { id: 'redwood', value: 3 },
  { id: 'cotswolds', value: 3 },
  { id: 'london', na: true },
  { id: 'barcelona', value: 4 },
  { id: 'seoul', value: 3 },
  { id: 'gbr', na: true }, // marine/reef environment, no land biking terrain
  { id: 'sydney', value: 4 },
  { id: 'uyuni', na: true },
  { id: 'jordan', value: 2 }, // desert single-track tours around Wadi Rum
  { id: 'beijing', value: 2 }, // Great Wall biking tours
  { id: 'amalfi', value: 3 },
  { id: 'andalucia', value: 4 },
  { id: 'sicily', value: 3 },
  { id: 'turks-caicos', na: true },
  { id: 'kerala', value: 2 },
  { id: 'belfast-giants-causeway', value: 4 },
  { id: 'copenhagen', na: true },
  { id: 'southeast-alaska', value: 3 },
];

// kayakingRafting: real, navigable whitewater/lake/sea-kayak water and an
// actual paddling scene vs. genuine desert/landlocked/regulatory absence.
const KAYAK: Decision[] = [
  { id: 'charleston-savannah', value: 7 }, // Lowcountry tidal-creek/marsh kayaking
  { id: 'egypt', value: 3 },
  { id: 'havana', value: 3 },
  { id: 'atacama', na: true }, // driest desert on Earth, no navigable water
  { id: 'ireland', value: 6 },
  { id: 'los-cabos', value: 6 }, // Sea of Cortez sea kayaking
  { id: 'douro-valley-porto', value: 4 },
  { id: 'black-forest', value: 4 },
  { id: 'madeira', value: 5 },
  { id: 'jamaica', value: 4 },
  { id: 'napa', value: 3 },
  { id: 'sedona', na: true }, // Oak Creek has no navigable kayaking water
  { id: 'prague', value: 4 },
  { id: 'taiwan', value: 4 },
  { id: 'hokkaido', value: 6 }, // Furano-area whitewater rafting
  { id: 'faroe-islands', value: 6 },
  { id: 'snowdonia', value: 7 }, // National Whitewater Centre
  { id: 'cape-cod-islands', value: 7 },
  { id: 'edinburgh', value: 3 },
  { id: 'bahamas', value: 6 },
  { id: 'istanbul', value: 2 },
  { id: 'marlborough-abel-tasman', value: 8 }, // premier NZ sea-kayaking destination
  { id: 'guatemala', value: 6 }, // Lake Atitlán
  { id: 'cornwall', value: 6 },
  { id: 'san-miguel-guanajuato', na: true },
  { id: 'belize', value: 7 }, // cayes, lagoons, cave rivers
  { id: 'joshua-tree', na: true },
  { id: 'chicago', value: 6 }, // Chicago River is a real established paddling scene
  { id: 'aspen', value: 6 }, // Roaring Fork whitewater
  { id: 'hudson-valley', value: 4 },
  { id: 'uluru', na: true },
  { id: 'champagne', value: 2 },
  { id: 'quebec-city', value: 4 },
  { id: 'budapest', value: 3 },
  { id: 'colombian-andes', value: 7 }, // San Gil whitewater rafting
  { id: 'sardinia', value: 6 },
  { id: 'chiang-mai', value: 6 }, // Mae Taeng rafting
  { id: 'churchill', value: 4 }, // beluga kayaking tours on the Churchill River
  { id: 'mexicocity', value: 2 },
  { id: 'panama', value: 6 }, // Chagres River, Bocas del Toro
  { id: 'morocco', value: 2 },
  { id: 'ecuadorian-andes', value: 7 }, // Tena/Baños whitewater
  { id: 'ghana', value: 2 },
  { id: 'nice-riviera', value: 4 },
  { id: 'barbados', value: 4 },
  { id: 'santorini', value: 4 },
  { id: 'ethiopia', value: 2 },
  { id: 'everglades', value: 8 }, // signature Everglades activity
  { id: 'puerto-rico', value: 7 }, // bioluminescent bay kayaking
  { id: 'algarve', value: 6 }, // sea caves and grottoes
  { id: 'death-valley', na: true },
  { id: 'berlin', value: 4 },
  { id: 'bagan', na: true },
  { id: 'basque-country', value: 4 },
  { id: 'bend-crater-lake', value: 6 }, // Deschutes River
  { id: 'chiapas', value: 3 },
  { id: 'chamonix', value: 6 }, // Arve River whitewater
  { id: 'colombian-caribbean', value: 4 },
  { id: 'bordeaux', value: 3 },
  { id: 'zion-bryce', na: true },
  { id: 'lisbon', value: 3 },
  { id: 'monterey-big-sur', value: 7 }, // Monterey Bay kelp-forest kayaking
  { id: 'north-island', value: 8 }, // Kaituna, Tongariro, Wairoa, Rangitikei
  { id: 'falklands', value: 2 },
  { id: 'kenya', na: true }, // dangerous wildlife (crocodile/hippo), not offered
  { id: 'maui', value: 6 },
  { id: 'okinawa', value: 6 }, // mangrove kayaking
  { id: 'mendoza', value: 3 },
  { id: 'luangprabang', value: 4 },
  { id: 'puglia', value: 3 },
  { id: 'punta-cana', value: 4 },
  { id: 'kaziranga', na: true }, // dangerous wildlife, not offered
  { id: 'oaxaca', na: true },
  { id: 'vermont', value: 6 }, // Lake Champlain
  { id: 'nyc', value: 3 },
  { id: 'lapland', value: 6 },
  { id: 'rivieramaya', value: 6 }, // cenote and lagoon kayaking
  { id: 'cape-town', value: 6 },
  { id: 'lake-district', value: 7 },
  { id: 'papua-new-guinea', value: 3 },
  { id: 'swissalps', value: 6 },
  { id: 'tuscany', value: 2 },
  { id: 'kruger', na: true }, // dangerous wildlife, not offered
  { id: 'piedmont', value: 2 },
  { id: 'lofoten', value: 6 },
  { id: 'dolomites', value: 2 },
  { id: 'nicaragua', value: 6 }, // Lake Nicaragua, Río San Juan
  { id: 'bhutan', value: 4 },
  { id: 'upper-peninsula', value: 6 },
  { id: 'vienna', value: 3 },
  { id: 'rioja', value: 2 },
  { id: 'provence', value: 7 }, // Gorges du Verdon
  { id: 'st-andrews-fife', value: 3 },
  { id: 'bavaria-munich', value: 4 },
  { id: 'guilin-yangshuo', value: 6 }, // Li River
  { id: 'mauritius', value: 4 },
  { id: 'badlands-black-hills', value: 3 },
  { id: 'palau', value: 6 }, // Rock Islands lagoons
  { id: 'uzbekistan', na: true },
  { id: 'nova-scotia', value: 6 }, // Bay of Fundy
  { id: 'peru', value: 6 }, // Urubamba whitewater
  { id: 'buenosaires', value: 4 }, // Tigre delta
  { id: 'paris', value: 2 },
  { id: 'venice', value: 4 },
  { id: 'bali', value: 7 }, // Ayung River rafting
  { id: 'iceland', value: 6 }, // glacier-lagoon kayaking
  { id: 'rome', na: true },
  { id: 'dubai', value: 3 },
  { id: 'big-island', value: 6 },
  { id: 'maldives', value: 4 },
  { id: 'borabora', value: 6 },
  { id: 'tokyo-kyoto', na: true },
  { id: 'fiji', value: 6 },
  { id: 'singapore', value: 3 },
  { id: 'athens', value: 2 },
  { id: 'angkor', na: true },
  { id: 'hongkong', value: 4 }, // Sai Kung kayaking
  { id: 'rajasthan-golden-triangle', na: true },
  { id: 'acadia', value: 6 },
  { id: 'rio', value: 3 },
  { id: 'new-orleans', value: 4 }, // bayou/swamp kayaking
  { id: 'aruba', value: 3 },
  { id: 'amsterdam', value: 6 }, // canal kayaking
  { id: 'bangkok', value: 2 },
  { id: 'seychelles', value: 4 },
  { id: 'mallorca', value: 6 },
  { id: 'scottish-highlands-skye', value: 6 },
  { id: 'thailand', value: 6 }, // sea-cave canoeing (James Bond Island)
  { id: 'azores', value: 6 },
  { id: 'whistler', value: 6 },
  { id: 'texas-hill-country', value: 6 }, // Guadalupe, Frio rivers
  { id: 'cotswolds', value: 2 },
  { id: 'london', value: 3 },
  { id: 'barcelona', value: 3 },
  { id: 'seoul', value: 3 },
  { id: 'sydney', value: 6 },
  { id: 'uyuni', na: true },
  { id: 'jordan', na: true },
  { id: 'beijing', na: true },
  { id: 'amalfi', value: 6 },
  { id: 'andalucia', value: 2 },
  { id: 'canaries', value: 6 },
  { id: 'sicily', value: 4 },
  { id: 'turks-caicos', value: 6 },
  { id: 'kerala', value: 7 }, // backwater canoeing is a signature Kerala activity
  { id: 'belfast-giants-causeway', value: 4 },
  { id: 'copenhagen', value: 6 }, // canal kayaking
];

async function main() {
  const env = loadDotEnvLocal();
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(connectionString, { prepare: false }));
  const actor = { id: '00000000-0000-0000-0000-000000000000', email: 'script:author-mtb-kayak-gaps' };

  const byId = new Map<string, { mtb?: Decision; kayak?: Decision }>();
  for (const d of MTB) byId.set(d.id, { ...byId.get(d.id), mtb: d });
  for (const d of KAYAK) byId.set(d.id, { ...byId.get(d.id), kayak: d });

  console.log(`${byId.size} destinations to update (dry run: ${dryRun})\n`);

  let updated = 0;
  let scoreCount = 0;
  let naCount = 0;

  for (const [id, decisions] of byId) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) {
      console.error(`  MISSING destination: ${id}`);
      continue;
    }

    const baseScores = { ...row.baseScores } as Record<string, number>;
    const naSliders = new Set(row.naSliders ?? []);

    for (const [slider, decision] of [
      ['mountainBiking', decisions.mtb],
      ['kayakingRafting', decisions.kayak],
    ] as const) {
      if (!decision) continue;
      if ('na' in decision) {
        naSliders.add(slider);
        delete baseScores[slider];
        naCount++;
      } else {
        baseScores[slider] = decision.value;
        naSliders.delete(slider);
        scoreCount++;
      }
    }

    const after = { ...row, baseScores, naSliders: Array.from(naSliders) };
    console.log(
      `  ${id.padEnd(28)} mtb=${decisions.mtb ? ('na' in decisions.mtb ? 'NA' : decisions.mtb.value) : '-'.padEnd(2)}  kayak=${decisions.kayak ? ('na' in decisions.kayak ? 'NA' : decisions.kayak.value) : '-'}`,
    );

    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx
          .update(places)
          .set({ baseScores: after.baseScores, naSliders: after.naSliders, updatedAt: new Date() })
          .where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: actor.id,
          entityType: 'destination',
          entityId: id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
        const scoring = toScoringPlace(after as Parameters<typeof toScoringPlace>[0]);
        const curves = fitDestinationCurves(scoring);
        await tx.update(places).set({ sliderCurves: curves }).where(eq(places.id, id));
      });
    }
    updated++;
  }

  console.log(`\n${updated} destinations updated: ${scoreCount} real scores assigned, ${naCount} marked N/A.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
