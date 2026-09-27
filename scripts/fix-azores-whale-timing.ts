import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

// Deep-dive on the Azores whale conflict flagged during the wildlifeViewing
// cross-check: whaleWatching's content explicitly claimed "blue and fin
// whales pass through in large numbers" as the description for SEVEN
// straight months (Apr-Oct). Real research (azores.com, futurismo.pt,
// whalewatchingazores.com, azoreswhalewatch.com's 2025 season report)
// says otherwise:
//   - Blue whales: spring migrants, best odds April-May, largely gone by
//     mid-summer.
//   - Fin whales: spring migrants too, Mar-Jun, present "all months except
//     January" per one operator's multi-year data, but concentrated spring.
//   - Sei whales: the actual Jul-Sep headline species — arrive AFTER the
//     blue/fin whales have mostly moved on.
//   - Sperm whales + 20+ dolphin species: resident/reliable year-round —
//     the reason base is high regardless of season.
// So "peak season" for blue/fin specifically really is Apr-May (matching
// wildlifeViewing's existing event, whose months were already correct —
// only its label incorrectly bundled in "sperm" as if sperm whales were
// migratory, when they're resident) while Jul-Sep is a real, different
// peak built on sei whales and calm-seas dolphin/sperm-whale reliability,
// not a continuation of the blue/fin migration.
//
// Note: base=9 here means almost any positive event value clamps the
// derived score to 10 (Azores is a whaleWatching anchor) — the split-event
// shape below is mainly a data-honesty fix (so admin panel and any future
// base-score change reflect the two real, distinct seasons correctly),
// while the actual user-facing correction is in the overview/monthly text,
// which is what previously stated the wrong species for five of those
// months.

const WV_EVENTS = [
  { label: 'Blue whale spring migration', weight: 4, months: { 3: 0.4, 4: 1, 5: 1, 6: 0.7 } },
];

const WW_EVENTS = [
  { label: 'Spring blue & fin whale migration', weight: 5, months: { 3: 0.4, 4: 1, 5: 1, 6: 0.5 } },
  { label: 'Summer sei whale & dolphin season (calm seas)', weight: 4, months: { 7: 1, 8: 1, 9: 0.7, 10: 0.4 } },
];

const WW_OVERVIEW = "Resident sperm whales are present in the deep waters around the Azores year-round — one of the most reliable sperm-whale destinations on Earth. More than 20 other cetacean species pass through, but not evenly across the year: blue and fin whales move through heavily each spring, peaking in April and May, and have mostly left by mid-summer; sei whales take over as the headline seasonal visitor from July through September, alongside the calmest seas and largest dolphin pods of the year.";

const WW_MONTHLY = [
  'Resident sperm whales are present, though outside the main migration season, sightings settle to a quieter baseline.',
  'Resident sperm whales are present, though outside the main migration season, sightings settle to a quieter baseline.',
  'Migrating whale numbers are building as the spring passage begins — fin whales arrive first.',
  'Peak season — blue and fin whales pass through in large numbers on their spring migration, alongside resident sperm whales.',
  'Peak season — blue and fin whales pass through in large numbers on their spring migration, alongside resident sperm whales.',
  'The spring migration is easing — most blue whales have moved on, though fin whales and resident sperm whales remain a strong presence.',
  "Sei whales take over as the season's headline visitor, alongside calm seas and the year's largest dolphin pods; the spring's blue and fin whales have largely moved on.",
  "Sei whales take over as the season's headline visitor, alongside calm seas and the year's largest dolphin pods; the spring's blue and fin whales have largely moved on.",
  'Sei whales remain present alongside strong dolphin numbers, easing from peak as the season winds down.',
  'The season is winding down — sei whale numbers ease, though sperm whales and dolphins remain reliable.',
  'Resident sperm whales are present, though outside the main migration season, sightings settle to a quieter baseline.',
  'Resident sperm whales are present, though outside the main migration season, sightings settle to a quieter baseline.',
];

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

  const [row] = await db.select().from(places).where(eq(places.id, 'azores'));
  if (!row) { console.error('azores: not found'); process.exit(1); }

  const patch: Record<string, unknown> = {
    sliderEvents: {
      ...(row.sliderEvents as Record<string, unknown>),
      wildlifeViewing: WV_EVENTS,
      whaleWatching: WW_EVENTS,
    },
    sliderOverview: {
      ...(row.sliderOverview as Record<string, string>),
      whaleWatching: WW_OVERVIEW,
    },
    sliderMonthlyWeather: {
      ...(row.sliderMonthlyWeather as Record<string, unknown>),
      whaleWatching: WW_MONTHLY,
    },
  };

  const scoringRow = { ...row, ...patch };
  const scoring = toScoringPlace(scoringRow as typeof row);
  const newCurves = { ...(row.sliderCurves as Record<string, unknown>) };
  for (const key of ['wildlifeViewing', 'whaleWatching']) {
    const monthly = deriveDestinationScores(scoring, { skipHazards: true }).monthly[key];
    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    newCurves[key] = fit.curve;
    console.log(`azores/${key}: [${monthly.map((v: number) => v.toFixed(0)).join(',')}] peak=${Math.max(...monthly)}`);
  }
  patch.sliderCurves = newCurves;

  if (!dryRun) {
    const afterRow = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'azores'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'azores',
        action: 'update', beforeValue: row, afterValue: afterRow,
      });
    });
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
