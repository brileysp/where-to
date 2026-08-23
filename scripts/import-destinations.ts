import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { destinations } from '../src/lib/db/schema';
import { destinationSchema, formatValidationErrors, type DestinationContent } from './content/destination-schema';

/**
 * The ongoing content-import pipeline for destinations (see
 * docs/content/adding-destinations.md Part 4). Replaces hand-editing
 * scripts/legacy/data.js plus a throwaway sync script per batch: authors
 * edit/add files under content/destinations/, then this one command
 * validates everything and pushes to both databases.
 *
 * "Both databases" because a local dev PGlite copy and the live Supabase
 * copy have historically drifted out of sync when someone forgot to run a
 * sync script twice with a different DATABASE_URL — this always does both,
 * in one run, so that class of mistake isn't possible anymore.
 */

const CONTENT_DIR = join(__dirname, '..', 'content', 'destinations');
const ENV_LOCAL_PATH = join(__dirname, '..', '.env.local');

/** No dotenv dependency needed for a handful of KEY=VALUE lines — `next
 * dev` loads .env.local automatically, but a bare tsx script doesn't. */
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

function toDbRow(d: DestinationContent) {
  return {
    id: d.id,
    name: d.name,
    region: d.region,
    emoji: d.emoji,
    climate: d.climate,
    about: d.about,
    overview: d.overview,
    costMin: d.costRange?.min ?? null,
    costOverview: d.costOverview,
    costMax: d.costRange?.max ?? null,
    costItems: d.costItems,
    baseScores: d.base,
    dryMonths: d.dry,
    wetMonths: d.wet,
    hotMonths: d.hot,
    coldMonths: d.cold,
    peakMonths: d.peak,
    lowMonths: d.low,
    peakIntensity: d.peakIntensity,
    wildlifePeakMonths: d.wildlifePeak,
    wildlifeClosedMonths: d.wildlifeClosed,
    birdingPeakMonths: d.birdingPeak,
    hikingBestMonths: d.hikingBest,
    hikingWorstMonths: d.hikingWorst,
    inaccessibleMonths: d.inaccessible,
    swimHazardMonths: d.swimHazard,
    noSnowMonths: d.noSnow,
    sliderCaps: d.sliderCaps,
    sliderEvents: d.sliderEvents,
    shopClosures: d.shopClosures,
    specialSeasons: d.specialSeasons,
    monthlyWeather: d.monthlyWeather,
    searchAliases: d.searchAliases,
    naSliders: d.naSliders,
    activityStyleTiers: d.activityStyleTiers,
    budgetBands: d.budgetBands,
    vibeBands: d.vibeBands,
    physicalBands: d.physicalBands,
  };
}

async function loadAndValidate(fileNames: string[]): Promise<DestinationContent[]> {
  const seenIds = new Map<string, string>(); // id -> first file that used it
  const valid: DestinationContent[] = [];
  let errorCount = 0;

  for (const fileName of fileNames) {
    const fullPath = join(CONTENT_DIR, fileName);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch (err) {
      console.error(`[${fileName}] invalid JSON: ${(err as Error).message}`);
      errorCount++;
      continue;
    }

    const result = destinationSchema.safeParse(raw);
    if (!result.success) {
      for (const line of formatValidationErrors((raw as { id?: string }).id, result.error)) {
        console.error('  ' + line);
      }
      errorCount++;
      continue;
    }

    const expectedFileName = `${result.data.id}.json`;
    if (fileName !== expectedFileName) {
      console.error(`[${fileName}] id "${result.data.id}" doesn't match its filename — expected ${expectedFileName}`);
      errorCount++;
      continue;
    }

    const firstFile = seenIds.get(result.data.id);
    if (firstFile) {
      console.error(`[${fileName}] duplicate id "${result.data.id}" — already used by ${firstFile}`);
      errorCount++;
      continue;
    }
    seenIds.set(result.data.id, fileName);

    valid.push(result.data);
  }

  if (errorCount > 0) {
    console.error(`\n${errorCount} file(s) failed validation — nothing was written to either database.`);
    process.exit(1);
  }

  return valid;
}

async function upsertAll(dbLabel: string, db: ReturnType<typeof drizzlePostgres> | ReturnType<typeof drizzlePglite>, rows: ReturnType<typeof toDbRow>[]) {
  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).insert(destinations).values(row).onConflictDoUpdate({ target: destinations.id, set: row });
  }
  console.log(`  ${dbLabel}: upserted ${rows.length} destination(s).`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const explicitFiles = args.filter((a) => !a.startsWith('--'));

  const fileNames = explicitFiles.length > 0 ? explicitFiles : readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'));

  console.log(`Validating ${fileNames.length} file(s) from ${CONTENT_DIR}...`);
  const rows = (await loadAndValidate(fileNames)).map(toDbRow);
  console.log(`All ${rows.length} destination(s) valid.`);

  if (dryRun) {
    console.log('\n--dry-run: skipping database writes.');
    process.exit(0);
  }

  const env = loadDotEnvLocal();
  const supabaseUrl = env.DATABASE_URL;

  console.log('\nWriting to both databases:');

  if (supabaseUrl) {
    const supabaseDb = drizzlePostgres(postgres(supabaseUrl));
    await upsertAll('Supabase', supabaseDb, rows);
  } else {
    console.warn('  Supabase: skipped — no DATABASE_URL found in .env.local');
  }

  const pgliteDb = drizzlePglite(new PGlite(join(__dirname, '..', 'pgdata')));
  await upsertAll('PGlite (local)', pgliteDb, rows);

  console.log(
    '\nDone. Restart the dev server so PGlite reloads its in-memory copy — it does not see external writes otherwise:' +
      '\n  lsof -i :3000 -sTCP:LISTEN -t | xargs kill; nohup npm run dev > /tmp/dev-server.log 2>&1 & disown',
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
