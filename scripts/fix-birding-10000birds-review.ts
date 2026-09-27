import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Fixes to birding content/scores found by reading real 10,000birds.com
 * articles (Location Profiles + Birding Lodges of the World, both of which
 * ask an explicit "best time" question) and comparing against our stored
 * content. Several places had NO sliderEvents.birding at all, meaning any
 * monthly variation in their stored text was pure prose with nothing
 * numerically backing it — a real score/content mismatch, fixed here by
 * adding events, not just rewriting text.
 *
 * Namibia is the standout: our content treated the dry season (shrinking
 * Etosha waterholes) as the peak. Multiple independent sources
 * (10,000birds' own profile, BirdForum, exoticbirding.com,
 * birdingecotours.com) agree the wet/green season (Nov-Apr) is actually
 * best — migrants arrive, the pan floods, flamingos and cranes breed. The
 * dry season is real but secondary: easier access to resident species at
 * shrinking water, not the peak. This is a genuine inversion, not an
 * addition.
 */

const KEY = 'birding';

type Event = { label: string; weight: number; months: Record<number, number> };

const FIXES: Record<string, { events: Event[]; overview: string; monthly: string[] }> = {
  namibia: {
    events: [{ label: 'Green-season migrant influx (Etosha pans flood)', weight: 4, months: { 11: 0.5, 12: 0.7, 1: 1, 2: 1, 3: 0.9, 4: 0.6 } }],
    overview: 'Etosha\'s best birding is actually during the wet season (November-April) — the vast pan floods, drawing flamingos and blue cranes to breed, and Palearctic migrants arrive in force alongside desert specialists like the Damara tern and dune lark. The dry season (May-October) is the easier, more reliable time to spot resident species concentrated at shrinking waterholes, but it lacks the wet season\'s migrant influx and breeding spectacle.',
    monthly: [
      'Etosha\'s pans are flooded and at their peak — flamingos and blue cranes arrive to breed alongside a full complement of Palearctic migrants.',
      'Etosha\'s pans are flooded and at their peak — flamingos and blue cranes arrive to breed alongside a full complement of Palearctic migrants.',
      'Etosha\'s pans are flooded and at their peak — flamingos and blue cranes arrive to breed alongside a full complement of Palearctic migrants.',
      'The green season easing as the pans begin to dry, though migrants and breeding activity are still present.',
      'The dry season — resident species concentrate at Etosha\'s shrinking waterholes, easier to find but without the wet season\'s migrant influx.',
      'The dry season — resident species concentrate at Etosha\'s shrinking waterholes, easier to find but without the wet season\'s migrant influx.',
      'The dry season — resident species concentrate at Etosha\'s shrinking waterholes, easier to find but without the wet season\'s migrant influx.',
      'The dry season — resident species concentrate at Etosha\'s shrinking waterholes, easier to find but without the wet season\'s migrant influx.',
      'The dry season — resident species concentrate at Etosha\'s shrinking waterholes, easier to find but without the wet season\'s migrant influx.',
      'The dry season — resident species concentrate at Etosha\'s shrinking waterholes, easier to find but without the wet season\'s migrant influx.',
      'The green season beginning to build as the first rains arrive.',
      'Etosha\'s pans filling again as the green season approaches its peak.',
    ],
  },
  hongkong: {
    events: [{ label: 'Autumn migration peak (Mai Po)', weight: 4, months: { 9: 0.6, 10: 1, 11: 0.8, 12: 0.6, 1: 0.5, 2: 0.4, 3: 0.5, 4: 0.6, 5: 0.3 } }],
    overview: 'Mai Po, just outside the city, is a globally significant stopover on the East Asian-Australasian Flyway — autumn migration (September-November) is the real peak, when species like the Amur Falcon and Yellow-breasted Bunting pass through in the largest numbers of the year. Winter brings wintering waterfowl and gulls; summer is genuinely the quietest stretch.',
    monthly: [
      'Wintering waterfowl and gulls at Mai Po, building toward the spring passage.',
      'Wintering waterfowl and gulls at Mai Po, building toward the spring passage.',
      'Wintering waterfowl and gulls at Mai Po, building toward the spring passage.',
      'Wintering waterfowl and gulls at Mai Po, building toward the spring passage.',
      'Spring migration easing at Mai Po as summer approaches.',
      'The quietest stretch of the year at Mai Po — few migrants pass through in summer.',
      'The quietest stretch of the year at Mai Po — few migrants pass through in summer.',
      'The quietest stretch of the year at Mai Po — few migrants pass through in summer.',
      'Autumn migration building at Mai Po.',
      'Peak autumn migration at Mai Po — the largest numbers of the year, including Amur Falcon and Yellow-breasted Bunting.',
      'Still within peak autumn migration at Mai Po, easing from October\'s high.',
      'Wintering waterfowl and gulls arriving at Mai Po as autumn migration tapers off.',
    ],
  },
  bhutan: {
    events: [
      { label: 'Black-necked crane winter (Phobjikha)', weight: 3, months: { 11: 0.7, 12: 1, 1: 1, 2: 0.7 } },
      { label: 'Spring altitudinal migration & breeding', weight: 3, months: { 3: 0.7, 4: 1, 5: 0.8 } },
    ],
    overview: 'Bhutan splits into two real peak seasons: spring (March-May), when birds move upslope to breed and become highly active and vocal — widely considered the single best time for a comprehensive birding trip — and the black-necked crane\'s winter residency (November-February) in the Phobjikha Valley, one of the most celebrated wildlife spectacles in the Himalayas.',
    monthly: [
      'Black-necked cranes at their winter peak in the Phobjikha Valley.',
      'Black-necked cranes still present in the Phobjikha Valley, easing from the winter peak.',
      'Spring altitudinal migration beginning — birds moving upslope to breed, increasingly active and vocal.',
      'Peak spring season — widely considered the single best time for birding in Bhutan, with birds highly active and vocal across the elevation gradient.',
      'Still within the spring breeding season, easing from April\'s peak.',
      'Monsoon rains make trail conditions harder across the country.',
      'Monsoon rains make trail conditions harder across the country.',
      'Monsoon rains make trail conditions harder across the country.',
      'Rains easing; forest birding returns to a solid baseline.',
      'A solid baseline ahead of the black-necked cranes\' return.',
      'Black-necked cranes arriving in the Phobjikha Valley for the winter.',
      'Black-necked cranes at their winter peak in the Phobjikha Valley.',
    ],
  },
  buenosaires: {
    events: [
      { label: 'Austral summer breeding activity', weight: 3, months: { 11: 0.6, 12: 1, 1: 1, 2: 0.8, 3: 0.5 } },
      { label: 'Southern winter visitor arrivals', weight: 3, months: { 5: 0.6, 6: 1, 7: 1, 8: 0.7 } },
    ],
    overview: 'The Reserva Ecológica wetland reserve near the city center has two real, distinct seasons: the austral summer (November-March) brings breeding activity among flycatchers, swallows, and grassland birds, while autumn and winter (May-August) bring a completely different set of arrivals from further south, including the Austral Negrito and White-banded Mockingbird.',
    monthly: [
      'Peak austral summer breeding season at the Reserva Ecológica — flycatchers, swallows, and grassland birds at their most active.',
      'Still within the summer breeding season at the Reserva Ecológica, easing from January\'s peak.',
      'Summer breeders winding down at the Reserva Ecológica ahead of the autumn transition.',
      'A quiet transitional month at the Reserva Ecológica, between the summer breeders and the arriving winter visitors.',
      'Southern winter visitors beginning to arrive at the Reserva Ecológica, including species like the Austral Negrito.',
      'Peak winter-visitor season at the Reserva Ecológica — species like the White-banded Mockingbird and Dark-faced Ground-Tyrant have arrived from further south.',
      'Still peak winter-visitor season at the Reserva Ecológica.',
      'Winter visitors beginning to ease at the Reserva Ecológica.',
      'A quiet transitional month at the Reserva Ecológica, between the winter visitors and the returning summer breeders.',
      'Still a quiet transitional month at the Reserva Ecológica, ahead of summer\'s return.',
      'Summer breeders returning to the Reserva Ecológica.',
      'Peak austral summer breeding season at the Reserva Ecológica.',
    ],
  },
  'charleston-savannah': {
    events: [
      { label: 'Spring migratory stopover (rookery peak)', weight: 4, months: { 3: 0.7, 4: 1, 5: 0.8 } },
      { label: 'Fall migration', weight: 2, months: { 9: 0.6, 10: 0.8 } },
    ],
    overview: 'Little St. Simons Island, on the Georgia coast, is a real migratory stopover — spring (March-May) is the prime season, when shorebirds, raptors, and warblers pass through in their brightest breeding plumage on the way north, with a wading-bird rookery at Norm\'s Pond a real highlight. A smaller fall migration (September-October) follows the same birds south.',
    monthly: [
      'A quiet baseline along the Lowcountry marshes, ahead of the spring migration.',
      'A quiet baseline along the Lowcountry marshes, ahead of the spring migration.',
      'Spring migration building along the Georgia coast — shorebirds, raptors, and warblers arriving in their brightest plumage.',
      'Peak spring migration at Little St. Simons Island, including the wading-bird rookery at Norm\'s Pond.',
      'Still within spring migration, easing from April\'s peak.',
      'A quiet baseline along the Lowcountry marshes, between the spring and fall migrations.',
      'A quiet baseline along the Lowcountry marshes, between the spring and fall migrations.',
      'A quiet baseline along the Lowcountry marshes, between the spring and fall migrations.',
      'Fall migration building along the Georgia coast.',
      'Fall migration at its peak, as the same species that passed through in spring head back south.',
      'A quiet baseline along the Lowcountry marshes, after the fall migration has passed.',
      'A quiet baseline along the Lowcountry marshes, after the fall migration has passed.',
    ],
  },
  'costa-rica': {
    events: [
      { label: 'Resplendent quetzal breeding display season', weight: 1, months: { 1: 1, 2: 1, 3: 1, 4: 0.5, 12: 0.6 } },
      { label: 'Migration season (despite rain)', weight: 2, months: { 8: 0.3, 9: 0.6, 10: 0.6, 11: 0.3 } },
    ],
    overview: 'Roughly 900 recorded species packed into a small area — Pacific and Caribbean slopes plus a full elevation gradient from lowland rainforest to cloud forest. Resplendent quetzals display in the cloud forest canopy from December through April; despite the rain, August through November is a genuinely exceptional migration season, and Boca Tapada\'s Great Green Macaws breed from February through August.',
    monthly: [
      'Quetzal breeding display season in the cloud forest — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.',
      'Quetzal breeding display season in the cloud forest — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.',
      'Quetzal breeding display season in the cloud forest — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.',
      'Quetzal breeding display season in the cloud forest — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.',
      'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline, with Great Green Macaws still breeding at Boca Tapada.',
      'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline, with Great Green Macaws still breeding at Boca Tapada.',
      'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline, with Great Green Macaws still breeding at Boca Tapada.',
      'Migration season beginning — genuinely exceptional birding despite the rain, and the tail end of Boca Tapada\'s Great Green Macaw breeding season.',
      'Peak migration season — exceptional birding despite being one of the wetter months of the year.',
      'Still peak migration season, exceptional birding despite the rain.',
      'Migration season easing, still excellent birding as the dry season approaches.',
      'Quetzal display season begins again as the dry season returns.',
    ],
  },
  athens: {
    events: [
      { label: 'Spring migration (peak season)', weight: 3, months: { 3: 0.7, 4: 1, 5: 0.7 } },
      { label: 'Autumn migration', weight: 2, months: { 9: 0.7, 10: 1, 11: 0.5 } },
      { label: 'Winter wetland birding', weight: 2, months: { 12: 0.6, 1: 0.6, 2: 0.6 } },
    ],
    overview: 'Athens sits on a real Mediterranean migration corridor — spring (March-May) is the best overall season for migration and breeding activity, including the resident Eastern Black-eared Wheatear in the rocky hills around the city. Autumn (September-November) brings a second, smaller migration peak, and winter is genuinely good for wetland species and waterfowl.',
    monthly: [
      'Winter wetland birding around Athens — waterfowl and occasional rarities.',
      'Still within the winter wetland season around Athens.',
      'Spring migration building around Athens.',
      'Peak spring migration around Athens — the best overall season, including breeding activity from residents like the Eastern Black-eared Wheatear.',
      'Still within spring migration, easing from April\'s peak.',
      'The quietest stretch of the year around Athens — hot, though still productive for breeding specialties.',
      'The quietest stretch of the year around Athens — hot, though still productive for breeding specialties.',
      'The quietest stretch of the year around Athens — hot, though still productive for breeding specialties.',
      'Autumn migration building around Athens.',
      'Peak autumn migration around Athens, especially for raptors and passerines.',
      'Autumn migration easing around Athens.',
      'Winter wetland birding around Athens beginning — waterfowl and occasional rarities.',
    ],
  },
  rio: {
    events: [{ label: 'Atlantic Forest breeding-season activity', weight: 2, months: { 9: 0.5, 10: 0.7, 11: 0.9, 12: 1, 1: 1, 2: 0.9, 3: 0.6 } }],
    overview: 'Atlantic Forest remnants within the city, including Tijuca, hold toucans and other Brazilian forest species — the same forest\'s breeding season (roughly September through March) brings real, if modest, extra activity, with the cooler months (May-August) noticeably quieter.',
    monthly: [
      'Peak Atlantic Forest breeding-season activity in Tijuca\'s remnants.',
      'Still within the breeding season, easing from January\'s peak.',
      'Breeding-season activity winding down in Tijuca\'s forest remnants.',
      'A quiet baseline in Tijuca\'s forest remnants, ahead of the cooler months.',
      'The cooler, quieter months for Tijuca\'s Atlantic Forest remnants.',
      'The cooler, quieter months for Tijuca\'s Atlantic Forest remnants.',
      'The cooler, quieter months for Tijuca\'s Atlantic Forest remnants.',
      'The cooler, quieter months for Tijuca\'s Atlantic Forest remnants.',
      'Breeding-season activity beginning to build in Tijuca\'s forest remnants.',
      'Breeding-season activity continuing to build.',
      'Breeding-season activity approaching its peak in Tijuca\'s forest remnants.',
      'Peak Atlantic Forest breeding-season activity in Tijuca\'s remnants.',
    ],
  },
  'marlborough-abel-tasman': {
    events: [{ label: 'Summer migratory season', weight: 2, months: { 11: 0.6, 12: 1, 1: 1, 2: 0.8, 3: 0.5 } }],
    overview: 'The Marlborough Sounds are the only home of the king shag, a cormorant found nowhere else in the world — present year-round, though summer and early autumn (November-March) bring better weather and migratory species to the wider Abel Tasman area.',
    monthly: [
      'Peak summer season — the king shag is present as always, alongside migratory species and the best weather of the year.',
      'Still peak summer season in the Marlborough Sounds.',
      'Summer easing into autumn, still good conditions.',
      'A quieter baseline as autumn sets in; the king shag remains present.',
      'A quieter baseline; the king shag remains present.',
      'The coldest, quietest stretch of the year.',
      'The coldest, quietest stretch of the year.',
      'Conditions improving as winter eases.',
      'A quieter baseline ahead of summer\'s return.',
      'A quieter baseline ahead of summer\'s return.',
      'Summer season and migratory species beginning to return.',
      'Peak summer season building — the king shag is present as always, alongside migratory species and the best weather of the year.',
    ],
  },
  morocco: {
    events: [
      { label: 'Spring passage', weight: 2, months: { 3: 1, 4: 1, 5: 0.5 } },
      { label: 'Autumn passage', weight: 2, months: { 9: 1, 10: 1, 11: 1 } },
      { label: 'Winter resident & wintering-migrant season', weight: 2, months: { 12: 0.6, 1: 0.6, 2: 0.6 } },
    ],
    overview: 'Morocco sits on a major Western Palearctic-African migration flyway. September through May is genuinely the good season overall — spring (March-April) and autumn (September-November) bring the heaviest migration passage, while winter (December-February) still holds real wintering species; only June through August, the hottest stretch, is a genuine off-season.',
    monthly: [
      'Wintering species present in the High Atlas foothills, a real, if quieter, season.',
      'Still within the wintering season, a real if quieter time.',
      'Spring migration passage adds significant numbers to the resident population.',
      'Peak spring migration passage.',
      'Spring migration easing, still a real, good season before summer\'s heat sets in.',
      'The genuine off-season — summer heat brings the quietest birding of the year.',
      'The genuine off-season — summer heat brings the quietest birding of the year.',
      'The genuine off-season — summer heat brings the quietest birding of the year.',
      'Autumn migration passage adds significant numbers to the resident population.',
      'Peak autumn migration passage.',
      'Still peak autumn migration passage.',
      'Wintering species arriving in the High Atlas foothills, a real, if quieter, season.',
    ],
  },
};

// Content-only: no score change (sources on the Ecuadorian Andes actively
// contradict each other on which months are best; the existing dry/wet
// access-based curve stays, but the current framing implies wetter =
// simply worse birding, when several real sources say the opposite for
// bird ACTIVITY specifically — a real nuance worth stating honestly.
const ECUADORIAN_ANDES_OVERVIEW =
  'Over 130 hummingbird species recorded in Ecuador alone, alongside Andean condors soaring over páramo grassland. The elevational range from high páramo down through cloud forest concentrates an exceptional diversity into a small area. Dry-season months make trails easier, but many species are actually most active — displaying and breeding — during the wetter months, so a quieter trail isn\'t necessarily a quieter bird.';

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
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, fix] of Object.entries(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (fix.monthly.length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }

    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: fix.events } };
    const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`  ${id}`);
    console.log(`    before: [${before.map((v: number) => v.toFixed(0)).join(',')}]`);
    console.log(`    after:  [${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);

    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: fix.events },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: fix.overview },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, string[]>), [KEY]: fix.monthly },
    };
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

  // Ecuadorian Andes: content-only, no event/score change.
  const [eaRow] = await db.select().from(places).where(eq(places.id, 'ecuadorian-andes'));
  if (!eaRow) { console.error('ecuadorian-andes: not found'); process.exit(1); }
  console.log('  ecuadorian-andes (content-only, no score change)');
  if (!dryRun) {
    const patch = { sliderOverview: { ...(eaRow.sliderOverview as Record<string, string>), [KEY]: ECUADORIAN_ANDES_OVERVIEW } };
    const after = { ...eaRow, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'ecuadorian-andes'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'ecuadorian-andes',
        action: 'update', beforeValue: eaRow, afterValue: after,
      });
    });
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
