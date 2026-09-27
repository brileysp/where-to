import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * First batch of the per-interest monthly-blurb authoring project (see
 * project plan) — 4 sample destinations across birding's full score range,
 * used to nail the format before scaling to the rest of the catalog.
 *
 * Also corrects Guilin & Yangshuo's birding base score: it was a flat 0
 * (the only destination in the catalog at literal zero), while every
 * comparable non-birding-destination city (Venice, Rome, Paris,
 * Copenhagen) sits at 2. Drafting the actual blurb surfaced that Guilin's
 * rice-paddy/river habitat (egrets, herons, kingfishers) is genuinely more
 * bird-relevant than a purely urban environment, so it belongs a notch
 * above that city floor, not merely equal to it or below.
 */

const KEY = 'birding';

const GUILIN_BASE_FIX = 3; // was 0, then briefly 2 (matching city floor); belongs above that floor.

const OVERVIEWS: Record<string, string> = {
  'guilin-yangshuo': 'Herons, egrets, and cormorants inhabit the rice paddies and river shallows around Yangshuo. No migration corridor or endemic species; sightings are incidental, not something organized around on their own.',
  grandcanyon: 'Golden eagles, ravens, and California condors present on the rim, with real seasonal structure: bald eagles concentrate at river confluences in winter, condors are most visible near nesting cliffs during spring courtship, and summer heat suppresses activity across the board. No dedicated lodges or guided birding circuit here.',
  belize: '590+ recorded species, including the keel-billed toucan (national bird), scarlet macaws at Red Bank, and jabiru storks in coastal wetlands. A real guided-birding circuit exists — lodges and local guides running dawn boat trips through wetland sanctuaries and forest-trail walks inland, commonly set up as a dedicated day or two within a broader itinerary.',
  peru: 'High-Andean puna and lower-elevation cloud-forest habitats around Cusco, including Abra Málaga\'s polylepis forest — home to some of South America\'s rarest birds, among them two critically endangered species found almost nowhere else. A serious guided-birding circuit exists, with cloud-forest lodges built specifically around it and multi-day trips descending from high-Andean terrain through cloud forest, timed to pre-dawn starts for lek displays.',
};

const MONTHLY: Record<string, string[]> = {
  'guilin-yangshuo': [
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Jan
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Feb
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Mar
    'Heavier rain raises water levels along the river and further floods the paddies, reducing visibility for the same egrets, herons, and kingfishers seen the rest of the year.', // Apr
    'Heavier rain raises water levels along the river and further floods the paddies, reducing visibility for the same egrets, herons, and kingfishers seen the rest of the year.', // May
    'Heavier rain raises water levels along the river and further floods the paddies, reducing visibility for the same egrets, herons, and kingfishers seen the rest of the year.', // Jun
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Jul
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Aug
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Sep
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Oct
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Nov
    'Egrets and herons stand in the flooded rice paddies around Yangshuo; kingfishers work the calmer stretches of the Li River. The cormorants often seen on bamboo rafts near the river are trained fishing birds, not wildlife sightings.', // Dec
  ],
  grandcanyon: [
    'Bald eagles gather at river confluences like Nankoweap Creek to feed on spawning trout, one of the most reliable wildlife concentrations of the year.', // Jan
    'Bald eagles gather at river confluences like Nankoweap Creek to feed on spawning trout, one of the most reliable wildlife concentrations of the year.', // Feb
    'California condors are most active near their nesting cliffs during courtship season, and peregrine falcons are nesting on canyon walls.', // Mar
    'California condors are most active near their nesting cliffs during courtship season, and peregrine falcons are nesting on canyon walls.', // Apr
    'California condors are most active near their nesting cliffs during courtship season, and peregrine falcons are nesting on canyon walls.', // May
    'Extreme heat suppresses activity through the day; most sightings cluster around dawn.', // Jun
    'Extreme heat suppresses activity through the day; most sightings cluster around dawn.', // Jul
    'Extreme heat suppresses activity through the day; most sightings cluster around dawn.', // Aug
    'Cooler temperatures return, and songbirds move through the riparian corridor along the river during fall migration.', // Sep
    'Cooler temperatures return, and songbirds move through the riparian corridor along the river during fall migration.', // Oct
    'Cooler temperatures return, and songbirds move through the riparian corridor along the river during fall migration.', // Nov
    'Bald eagles gather at river confluences like Nankoweap Creek to feed on spawning trout, one of the most reliable wildlife concentrations of the year.', // Dec
  ],
  belize: [
    'Wintering North American migrants settle in alongside residents. Falling water levels concentrate wading birds, including jabiru storks, around the shrinking wetlands.', // Jan
    'Wintering North American migrants settle in alongside residents. Falling water levels concentrate wading birds, including jabiru storks, around the shrinking wetlands.', // Feb
    'Spring migration passage adds transient species moving north. Scarlet macaws gather near Red Bank to feed on fruiting polewood trees.', // Mar
    'Spring migration passage adds transient species moving north. Scarlet macaws gather near Red Bank to feed on fruiting polewood trees.', // Apr
    'Rains return and water levels rise; wintering migrants and the macaw aggregation have both dispersed.', // May
    'Rains return and water levels rise; wintering migrants and the macaw aggregation have both dispersed.', // Jun
    'Rains return and water levels rise; wintering migrants and the macaw aggregation have both dispersed.', // Jul
    'Rains return and water levels rise; wintering migrants and the macaw aggregation have both dispersed.', // Aug
    'Fall migration passage begins, though rising water levels keep wetland birds more spread out than the dry-season concentration.', // Sep
    'Fall migration passage begins, though rising water levels keep wetland birds more spread out than the dry-season concentration.', // Oct
    'Fall migration passage begins, though rising water levels keep wetland birds more spread out than the dry-season concentration.', // Nov
    'Wintering North American migrants settle in alongside residents. Falling water levels concentrate wading birds, including jabiru storks, around the shrinking wetlands.', // Dec
  ],
  peru: [
    'Rain limits access into the diverse cloud forest habitats along the Manu road. Birding the high-Andean puna around Cusco remains possible for regional specialties.', // Jan
    'Rain limits access into the diverse cloud forest habitats along the Manu road. Birding the high-Andean puna around Cusco remains possible for regional specialties.', // Feb
    'Rain limits access into the diverse cloud forest habitats along the Manu road. Birding the high-Andean puna around Cusco remains possible for regional specialties.', // Mar
    'Rains ease, but cloud forest habitats along the Manu road remain difficult to reach. Andean passes around Cusco stay accessible for regional specialties.', // Apr
    'Drying conditions restore access to cloud forest habitats along the Manu road, adding significant range beyond the Andean passes around Cusco.', // May
    'Dry, stable conditions allow access to all habitats, from Andean passes to lower-elevation cloud forest along the Manu road.', // Jun
    'Peak dry-season access to all habitats, from Andean passes to lower-elevation cloud forest along the Manu road.', // Jul
    'Peak dry-season access to all habitats, from Andean passes to lower-elevation cloud forest along the Manu road.', // Aug
    'Dry conditions continue to allow access across all habitats, from Andean passes to lower-elevation cloud forest along the Manu road.', // Sep
    'Rains return and access into cloud forest habitats along the Manu road grows less reliable. Andean passes around Cusco remain accessible for regional specialties.', // Oct
    'Rains return and access into cloud forest habitats along the Manu road grows less reliable. Andean passes around Cusco remain accessible for regional specialties.', // Nov
    'Wet season resumes, limiting access into cloud forest habitats along the Manu road. Birding the high-Andean puna around Cusco remains possible for regional specialties.', // Dec
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace, getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    if (id === 'guilin-yangshuo') {
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: GUILIN_BASE_FIX };
    }
    const after = { ...row, ...patch };
    console.log(`  ${id}: writing overview (${OVERVIEWS[id].length} chars) + 12 monthly entries${id === 'guilin-yangshuo' ? ` + base fix -> ${GUILIN_BASE_FIX}` : ''}`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  // Re-derive + re-fit Guilin's curve since its base changed.
  if (!dryRun) {
    const [row] = await db.select().from(places).where(eq(places.id, 'guilin-yangshuo'));
    const scoring = toScoringPlace(row);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
    console.log(`  guilin-yangshuo new monthly: [${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);
    await db.update(places).set({
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      updatedAt: new Date(),
    }).where(eq(places.id, 'guilin-yangshuo'));
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
