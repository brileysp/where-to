import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Eleventh batch — the 13 destinations from the "missing" survey that
 * already carry real sliderEvents/curves (as opposed to the 103 flat
 * ones handled separately). Text is written to match each destination's
 * actual stored curve shape, not the event label alone — GBR and Kruger
 * both carry a zero-weight legacy event that doesn't move their score,
 * so both get honest near-flat treatment instead of a fabricated peak.
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  srilanka: 'Resident endemics — including several found only on the island — are joined each northern winter by large numbers of migrants arriving from breeding grounds across Asia.',
  everglades: 'As the dry season progresses, falling water levels concentrate fish into shrinking pools, drawing large wading-bird rookeries — wood storks, roseate spoonbills, herons — into dense, visible feeding aggregations.',
  'new-orleans': 'Sitting on the Gulf Coast migratory flyway, the region sees trans-Gulf migrant songbirds arrive in exhausted "fallout" waves after their overwater crossing each spring and autumn.',
  hokkaido: 'Red-crowned cranes gather at winter feeding stations near Kushiro, one of the most reliable large-bird spectacles in Japan.',
  gbr: 'Coral cays support nesting seabirds and shorebirds pass along the coast, though nothing here rises to a distinct scored spectacle for birding specifically.',
  galapagos: 'Extreme tameness and endemism make birding exceptional islands-wide year-round; land birds are most vocal and active during the warmer, wetter months when rain-driven plant growth supports breeding.',
  kaziranga: 'Monsoon floodwaters submerge the park each year; the following dry season reopens access to the floodplain grasslands that hold species like the Bengal florican.',
  rajaampat: 'Calmer seas during the dry season give reliable boat access to the remote forest islands where birds-of-paradise display; rougher seas during the wet monsoon limit reach to those same sites.',
  ethiopia: 'Ethiopia holds roughly 30 endemic bird species restricted to its highland plateaus; the long summer rains limit access to those remote areas, and the following dry season reopens them.',
  algarve: 'Wetlands like the Ria Formosa sit on a major Western Palearctic flyway, drawing large numbers of migrant shorebirds and songbirds each spring and autumn.',
  'texas-hill-country': 'The Ashe juniper-oak woodlands here are the entire global breeding range of the golden-cheeked warbler, alongside broader Central Flyway migration each spring and autumn.',
  kruger: 'Dry-season conditions concentrate wildlife, including birds, around remaining water sources, with a tail of Palearctic migrants still present into the early dry season.',
  pantanal: 'As the dry season progresses, shrinking waterways concentrate fish and, in turn, hyacinth macaws, jabiru storks, and other wading birds along the exposed riverbanks.',
};

const MONTHLY: Record<string, string[]> = {
  srilanka: [
    'Northern-winter migrants are present in peak numbers alongside resident endemics.', // Jan
    'Northern-winter migrants are present in peak numbers alongside resident endemics.', // Feb
    'Migrants are beginning to depart for their breeding grounds; numbers are easing.', // Mar
    'Outside the migrant season, birding settles to the resident endemic baseline.', // Apr
    'Outside the migrant season, birding settles to the resident endemic baseline.', // May
    'Outside the migrant season, birding settles to the resident endemic baseline.', // Jun
    'Outside the migrant season, birding settles to the resident endemic baseline.', // Jul
    'Outside the migrant season, birding settles to the resident endemic baseline.', // Aug
    'Outside the migrant season, birding settles to the resident endemic baseline.', // Sep
    'Outside the migrant season, birding settles to the resident endemic baseline.', // Oct
    'Migrants are beginning to arrive from their northern breeding grounds.', // Nov
    'Migrant numbers build toward the winter peak.', // Dec
  ],
  everglades: [
    'Falling water levels are concentrating wading birds into dense rookeries.', // Jan
    'Water levels are at their lowest, concentrating wading-bird rookeries at their fullest.', // Feb
    'Water levels are at their lowest, concentrating wading-bird rookeries at their fullest.', // Mar
    'Rookeries remain active as the dry season continues, though rains may begin returning.', // Apr
    'Rains are returning and water levels beginning to rise, dispersing the concentrations.', // May
    'Higher water levels have dispersed birds across a wider area; sightings are less concentrated.', // Jun
    'Higher water levels have dispersed birds across a wider area; sightings are less concentrated.', // Jul
    'Higher water levels have dispersed birds across a wider area; sightings are less concentrated.', // Aug
    'Higher water levels have dispersed birds across a wider area; sightings are less concentrated.', // Sep
    'Water levels are beginning to fall as the dry season returns.', // Oct
    'Water levels continue falling, gradually re-concentrating birds into feeding areas.', // Nov
    'Falling water levels are concentrating wading birds into dense rookeries.', // Dec
  ],
  'new-orleans': [
    'Outside the migration windows, birding settles to a common Gulf Coast baseline.', // Jan
    'Outside the migration windows, birding settles to a common Gulf Coast baseline.', // Feb
    'Spring trans-Gulf migration is beginning to build.', // Mar
    'Peak spring migration — trans-Gulf migrants arrive in fallout waves after their overwater crossing.', // Apr
    'Peak spring migration — trans-Gulf migrants arrive in fallout waves after their overwater crossing.', // May
    'Outside the migration windows, birding settles to a common Gulf Coast baseline.', // Jun
    'Outside the migration windows, birding settles to a common Gulf Coast baseline.', // Jul
    'Outside the migration windows, birding settles to a common Gulf Coast baseline.', // Aug
    'Peak autumn migration brings large numbers of songbirds back through the region.', // Sep
    'Peak autumn migration brings large numbers of songbirds back through the region.', // Oct
    'Outside the migration windows, birding settles to a common Gulf Coast baseline.', // Nov
    'Outside the migration windows, birding settles to a common Gulf Coast baseline.', // Dec
  ],
  hokkaido: [
    'Red-crowned cranes gather at winter feeding stations near Kushiro, at their most reliable and visible.', // Jan
    'Red-crowned cranes remain at the feeding stations, though numbers begin easing later in the month.', // Feb
    'Cranes are dispersing back to breeding territories as winter ends.', // Mar
    'Outside the winter crane season, birding settles to a common baseline.', // Apr
    'Outside the winter crane season, birding settles to a common baseline.', // May
    'Outside the winter crane season, birding settles to a common baseline.', // Jun
    'Outside the winter crane season, birding settles to a common baseline.', // Jul
    'Outside the winter crane season, birding settles to a common baseline.', // Aug
    'Outside the winter crane season, birding settles to a common baseline.', // Sep
    'Outside the winter crane season, birding settles to a common baseline.', // Oct
    'Outside the winter crane season, birding settles to a common baseline.', // Nov
    'Cranes are beginning to gather at the winter feeding stations near Kushiro.', // Dec
  ],
  gbr: Array(12).fill('Coral cays support nesting seabirds and shorebirds pass along the coast; nothing here is tied to a specific scored spectacle for birding.'),
  galapagos: [
    'Warm, wet-season conditions support land-bird breeding activity across the islands.', // Jan
    'Warm, wet-season conditions support land-bird breeding activity across the islands.', // Feb
    'Warm, wet-season conditions support land-bird breeding activity across the islands.', // Mar
    'Conditions are transitioning toward the cooler, drier garua season.', // Apr
    'Warm-season land-bird activity continues at a strong baseline alongside seabird breeding.', // May
    'Cooler, drier garua-season conditions bring seabird breeding activity to the fore.', // Jun
    'Cooler, drier garua-season conditions bring seabird breeding activity to the fore.', // Jul
    'Cooler, drier garua-season conditions bring seabird breeding activity to the fore.', // Aug
    'Cooler, drier garua-season conditions bring seabird breeding activity to the fore.', // Sep
    'Conditions are transitioning back toward the warmer, wetter season.', // Oct
    'Conditions are transitioning back toward the warmer, wetter season.', // Nov
    'Warm, wet-season conditions support land-bird breeding activity across the islands.', // Dec
  ],
  kaziranga: [
    'Dry-season access to the floodplain grasslands is at its best.', // Jan
    'Dry-season access to the floodplain grasslands is at its best.', // Feb
    'Access remains good as the dry season continues, though conditions are warming.', // Mar
    'Access is narrowing as the season turns toward the pre-monsoon heat.', // Apr
    'Rising monsoon waters are beginning to limit access to the floodplain.', // May
    'Monsoon floodwaters submerge much of the park, closing off access.', // Jun
    'Monsoon floodwaters submerge much of the park, closing off access.', // Jul
    'Monsoon floodwaters submerge much of the park, closing off access.', // Aug
    'Floodwaters are receding but access remains limited.', // Sep
    'Floodwaters continue to recede, gradually reopening the floodplain grasslands.', // Oct
    'The dry season is returning, reopening good access to the floodplain.', // Nov
    'Dry-season access to the floodplain grasslands is at its best.', // Dec
  ],
  rajaampat: [
    'Calm dry-season seas give reliable boat access to the remote islands where birds-of-paradise display.', // Jan
    'Calm dry-season seas give reliable boat access to the remote islands where birds-of-paradise display.', // Feb
    'Seas remain workable, though beginning to turn toward the wetter monsoon.', // Mar
    'Rougher, wet-monsoon seas are starting to limit reach to the more remote sites.', // Apr
    'Rougher wet-monsoon seas limit boat access to the more remote display sites.', // May
    'Rougher wet-monsoon seas limit boat access to the more remote display sites.', // Jun
    'Rougher wet-monsoon seas limit boat access to the more remote display sites.', // Jul
    'Rougher wet-monsoon seas limit boat access to the more remote display sites.', // Aug
    'Seas remain unsettled, though conditions are beginning to ease.', // Sep
    'Seas are beginning to calm as the dry season approaches.', // Oct
    'Calming seas are restoring access to the remote display sites.', // Nov
    'Calm dry-season seas give reliable boat access to the remote islands where birds-of-paradise display.', // Dec
  ],
  ethiopia: [
    'Dry-season access to the highland plateaus is at its best, with endemics on full display.', // Jan
    'Dry-season access to the highland plateaus is at its best, with endemics on full display.', // Feb
    'Access remains good, though conditions are warming ahead of the rains.', // Mar
    'Access is narrowing as the season turns toward the belg rains.', // Apr
    'Access is narrowing as the season turns toward the belg rains.', // May
    'The long summer rains are limiting access to remote highland areas.', // Jun
    'The long summer rains are limiting access to remote highland areas.', // Jul
    'The long summer rains are limiting access to remote highland areas.', // Aug
    'Rains are easing, though access to remote highland areas remains limited.', // Sep
    'The dry season is returning, reopening access to the highland plateaus.', // Oct
    'Dry-season access to the highland plateaus is strong, with endemics on full display.', // Nov
    'Dry-season access to the highland plateaus is at its best, with endemics on full display.', // Dec
  ],
  algarve: [
    'Outside the migration windows, birding settles to a quieter resident baseline.', // Jan
    'Outside the migration windows, birding settles to a quieter resident baseline.', // Feb
    'Spring migration brings large numbers of migrant shorebirds and songbirds through the wetlands.', // Mar
    'Spring migration brings large numbers of migrant shorebirds and songbirds through the wetlands.', // Apr
    'Outside the migration windows, birding settles to a quieter resident baseline.', // May
    'Outside the migration windows, birding settles to a quieter resident baseline.', // Jun
    'Outside the migration windows, birding settles to a quieter resident baseline.', // Jul
    'Outside the migration windows, birding settles to a quieter resident baseline.', // Aug
    'Autumn migration brings large numbers of migrant shorebirds and songbirds through the wetlands.', // Sep
    'Autumn migration continues to bring strong numbers through the wetlands.', // Oct
    'Autumn migration continues to bring strong numbers through the wetlands.', // Nov
    'Outside the migration windows, birding settles to a quieter resident baseline.', // Dec
  ],
  'texas-hill-country': [
    'Outside the breeding and migration windows, birding settles to a quieter baseline.', // Jan
    'Outside the breeding and migration windows, birding settles to a quieter baseline.', // Feb
    'Golden-cheeked warblers and other breeding specialists are arriving in the Ashe juniper woodlands.', // Mar
    'Peak spring migration coincides with golden-cheeked warbler breeding season in the juniper-oak woodlands.', // Apr
    'Peak spring migration coincides with golden-cheeked warbler breeding season in the juniper-oak woodlands.', // May
    'Breeding specialists remain present through the summer, alongside a quieter migration baseline.', // Jun
    'Outside the migration windows, birding settles to a quieter baseline.', // Jul
    'Outside the migration windows, birding settles to a quieter baseline.', // Aug
    'Peak autumn migration brings large numbers of songbirds back through the Hill Country.', // Sep
    'Peak autumn migration brings large numbers of songbirds back through the Hill Country.', // Oct
    'Outside the breeding and migration windows, birding settles to a quieter baseline.', // Nov
    'Outside the breeding and migration windows, birding settles to a quieter baseline.', // Dec
  ],
  kruger: [
    'Palearctic migrants remain present into the early dry season, alongside resident wildlife.', // Jan
    'Palearctic migrants remain present into the early dry season, alongside resident wildlife.', // Feb
    'Migrants are departing as the dry season sets in, concentrating wildlife around water.', // Mar
    'Dry-season conditions concentrate wildlife, birds included, around remaining water sources.', // Apr
    'Dry-season conditions concentrate wildlife, birds included, around remaining water sources.', // May
    'Dry-season conditions concentrate wildlife, birds included, around remaining water sources.', // Jun
    'Dry-season conditions concentrate wildlife, birds included, around remaining water sources.', // Jul
    'Dry-season conditions concentrate wildlife, birds included, around remaining water sources.', // Aug
    'Dry-season conditions concentrate wildlife, birds included, around remaining water sources.', // Sep
    'Dry-season conditions concentrate wildlife, birds included, around remaining water sources.', // Oct
    'Rains are returning, dispersing wildlife and easing the water-source concentration.', // Nov
    'Palearctic migrants are arriving for the wet season alongside resident wildlife.', // Dec
  ],
  pantanal: [
    'Rains have dispersed water across the floodplain; wildlife is spread out and less concentrated.', // Jan
    'Rains have dispersed water across the floodplain; wildlife is spread out and less concentrated.', // Feb
    'Water levels are beginning to fall as the dry season approaches.', // Mar
    'Falling water levels are starting to concentrate fish and wading birds along the waterways.', // Apr
    'The dry season is setting in, drawing wildlife toward shrinking water sources.', // May
    'Shrinking waterways are concentrating fish and, with them, wading birds along the riverbanks.', // Jun
    'Riverbank concentrations of hyacinth macaws, jabiru storks, and other wading birds are at their peak.', // Jul
    'Riverbank concentrations of hyacinth macaws, jabiru storks, and other wading birds are at their peak.', // Aug
    'Riverbank concentrations of hyacinth macaws, jabiru storks, and other wading birds are at their peak.', // Sep
    'The dry season is easing; concentrations along the riverbanks are beginning to disperse.', // Oct
    'Rains are returning, dispersing water and wildlife back across the floodplain.', // Nov
    'Rains have dispersed water across the floodplain; wildlife is spread out and less concentrated.', // Dec
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
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
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
    console.log(`  ${id}: writing overview + 12 monthly entries`);
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
