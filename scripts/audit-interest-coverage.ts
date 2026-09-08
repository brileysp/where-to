import { readFileSync } from 'fs';
import { join } from 'path';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Coverage report for the 25 interests authored this session's Phase 2
 * (20 brand-new + 5 split-secondaries): for each, how many of the 200
 * destinations have real content (base > 0) vs. none at all (base === 0
 * or missing — deriveDestinationScores treats both identically). Each
 * author-*.ts script only touched a hand-picked, deliberately narrow list
 * of destinations, so near-total gaps are expected for genuinely niche
 * interests (safari, whaleWatching) — this report exists to catch the
 * OTHER case: a broad interest, or a specific destination, where a zero
 * looks like an oversight rather than a real "doesn't apply here."
 *
 * For landscapePhotography specifically (split-secondary of
 * scenicLandscapes), also cross-checks against scenicLandscapes — a
 * destination that scores well on scenic landscapes but has zero
 * landscape-photography content is the clearest possible authoring gap,
 * since the two are the same physical thing photographed vs. experienced.
 */

const SPLIT_SECONDARIES = ['auroraChasing', 'mountainBiking', 'historyArchaeology', 'landscapePhotography', 'allInclusive'] as const;
const NEW_INTERESTS = [
  'safari', 'whaleWatching', 'hotSprings', 'themeParks', 'spectatorSports',
  'cityExploration', 'familyFun', 'campingBackcountry',
  'nationalParks', 'geologyVolcanoes', 'wildflowerBlooms', 'mountaineering',
  'kayakingRafting', 'horsebackRiding', 'trailRunning',
  'indigenousCultures', 'religiousSites', 'traditionalCrafts', 'coffeeTea', 'yogaRetreats',
] as const;
const PHASE2_KEYS = [...SPLIT_SECONDARIES, ...NEW_INTERESTS];

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
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  const supabaseUrl = env.DATABASE_URL;
  if (!supabaseUrl) {
    console.error('No DATABASE_URL found in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const db = drizzlePostgres(postgres(supabaseUrl, { prepare: false }));
  // Place migration Phase 6 completed (2026-09-07): `destinations` no
  // longer exists — reads `places`, filtered to isPrimaryDestination (the
  // same 200-destination scope this report always covered).
  const rows = await db
    .select({ id: places.id, name: places.name, baseScores: places.baseScores })
    .from(places)
    .where(eq(places.isPrimaryDestination, true));

  console.log(`\n=== Phase 2 interest coverage — ${rows.length} destinations ===\n`);
  console.log('key'.padEnd(24), 'authored'.padStart(9), 'unauthored'.padStart(11), 'coverage'.padStart(10));

  const unauthoredByKey: Record<string, string[]> = {};
  for (const key of PHASE2_KEYS) {
    const unauthored: string[] = [];
    let authored = 0;
    for (const row of rows) {
      const v = (row.baseScores as Record<string, number>)[key];
      if (v === undefined || v === 0) unauthored.push(row.id);
      else authored++;
    }
    unauthoredByKey[key] = unauthored;
    const pct = ((authored / rows.length) * 100).toFixed(1);
    console.log(key.padEnd(24), String(authored).padStart(9), String(unauthored.length).padStart(11), `${pct}%`.padStart(10));
  }

  console.log(`\n=== landscapePhotography vs. scenicLandscapes cross-check ===`);
  console.log(`Destinations scoring well on scenicLandscapes (>=6) but with zero landscapePhotography content —`);
  console.log(`these are the clearest likely authoring gaps, not genuine "doesn't apply here" cases:\n`);
  let gapCount = 0;
  for (const row of rows) {
    const base = row.baseScores as Record<string, number>;
    const scenic = base.scenicLandscapes ?? 0;
    const photo = base.landscapePhotography ?? 0;
    if (scenic >= 6 && photo === 0) {
      console.log(`  ${row.id.padEnd(28)} ${row.name.padEnd(30)} scenicLandscapes=${scenic}`);
      gapCount++;
    }
  }
  console.log(`\n${gapCount} likely gaps found.`);

  /**
   * Same technique, generalized: for a target interest that's broad enough
   * that a strong showing on one or more correlated sliders is a real
   * signal (not just a coincidence), flag zero-content destinations for
   * hand review. Unlike the landscapePhotography check above, `anyOf`
   * lets a destination qualify via any one of several plausible signals
   * (e.g. a national park destination might read as wildlife-heavy,
   * scenery-heavy, or hiking-heavy — not all three).
   */
  function crossCheck(target: string, anyOf: Array<{ key: string; min: number }>) {
    console.log(`\n=== ${target} cross-check (vs. ${anyOf.map((c) => `${c.key}>=${c.min}`).join(' / ')}) ===`);
    let n = 0;
    for (const row of rows) {
      const base = row.baseScores as Record<string, number>;
      if ((base[target] ?? 0) !== 0) continue;
      const hit = anyOf.find((c) => (base[c.key] ?? 0) >= c.min);
      if (hit) {
        console.log(`  ${row.id.padEnd(28)} ${row.name.padEnd(30)} ${hit.key}=${base[hit.key]}`);
        n++;
      }
    }
    console.log(`${n} likely gaps found.`);
  }

  crossCheck('mountainBiking', [
    { key: 'hiking', min: 7 },
    { key: 'campingBackcountry', min: 7 },
  ]);
  crossCheck('historyArchaeology', [
    { key: 'museumsArt', min: 6 },
    { key: 'religiousSites', min: 6 },
    { key: 'architecture', min: 7 },
  ]);
  crossCheck('nationalParks', [
    { key: 'wildlifeViewing', min: 7 },
    { key: 'campingBackcountry', min: 7 },
  ]);
  crossCheck('cityExploration', [
    { key: 'architecture', min: 6 },
    { key: 'museumsArt', min: 6 },
    { key: 'nightlife', min: 6 },
  ]);
  crossCheck('trailRunning', [{ key: 'hiking', min: 7 }]);
  crossCheck('religiousSites', [
    { key: 'historyArchaeology', min: 6 },
    { key: 'architecture', min: 7 },
    { key: 'indigenousCultures', min: 6 },
  ]);
  crossCheck('familyFun', [
    { key: 'beachesSwimming', min: 7 },
    { key: 'wildlifeViewing', min: 6 },
  ]);
  crossCheck('mountaineering', [{ key: 'hiking', min: 8 }]);
  crossCheck('kayakingRafting', [
    { key: 'campingBackcountry', min: 7 },
    { key: 'wildlifeViewing', min: 7 },
  ]);

  console.log(`\n=== Sample unauthored destinations for the 5 split-secondaries (broadest, most likely under-covered) ===`);
  for (const key of SPLIT_SECONDARIES) {
    const list = unauthoredByKey[key];
    console.log(`\n${key} — ${list.length} of ${rows.length} unauthored:`);
    console.log('  ' + list.slice(0, 15).join(', ') + (list.length > 15 ? `, … +${list.length - 15} more` : ''));
  }

  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
