import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Full content pass for North Cascades — the only destination in the
 * catalogue that genuinely needed one.
 *
 * It held 7 authored interests of 51 against a national-park peer median
 * of 31, and was deliberately excluded from the zero-triage sweep because
 * marking its 39 untriaged interests N/A would have asserted it has no
 * scenery and no hiking. Both were in fact simply blank — the two things
 * the park is actually for.
 *
 * The place: the most heavily glaciated range in the contiguous United
 * States, over 300 glaciers, Cascade Pass and Sahale Arm, the turquoise of
 * Diablo and Ross Lakes, and serious alpine rock on Forbidden Peak and
 * Liberty Bell. Also one of the least-visited major US parks, because
 * almost none of it is reachable by road — which is why nationalParks
 * stays 'strong' rather than 'signature'. It is a wilderness, not a
 * windshield park.
 *
 * Season is unusually narrow and already described in the row's `about`:
 * the North Cascades Highway closes roughly December to March, and the
 * high country only opens up in July and August.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';

const SCORES: Record<string, number> = {
  // The reasons to go.
  scenicLandscapes: 9,       // jagged glaciated peaks; Diablo Lake's glacial flour
  hiking: 9,                 // Cascade Pass, Maple Pass, Sahale Arm
  mountaineering: 8,         // raised from 6 — Forbidden, Eldorado, Liberty Bell
  landscapePhotography: 8,
  roadtrip: 8,               // SR-20 is a classic American scenic drive
  // Real, secondary.
  wildflowerBlooms: 6,       // subalpine meadows, late July into August
  stargazing: 6,             // genuinely dark skies, no nearby city glow
  geologyVolcanoes: 6,       // glaciation, and Mount Baker next door
  skiingSnowboarding: 6,     // raised from 4 — Baker's record snowfall, per `about`
  wildlifeViewing: 5,        // black bear, mountain goat, marmot
  fishing: 5,
  cyclingRoad: 5,            // SR-20 is a well-known road ride
  adventureSports: 5,
  // Present but marginal.
  birding: 4,
  horsebackRiding: 4,        // stock use permitted in the backcountry
  familyFun: 4,              // roadside viewpoints; the rest is wilderness
  indigenousCultures: 3,     // Upper Skagit and Sauk-Suiattle history, little interpreted
  coffeeTea: 3,
  luxuryHotels: 2,           // Ross Lake Resort is rustic, not luxury
};

// Genuinely inapplicable — an alpine wilderness with no town inside it.
const NA = [
  'safari', 'whaleWatching', 'sailing', 'golf', 'beachesSwimming', 'sunbathing',
  'allInclusive', 'spaWellness', 'yogaRetreats', 'themeParks', 'shopping',
  'spectatorSports', 'cityExploration', 'historyArchaeology', 'religiousSites',
  'festivals', 'traditionalCrafts', 'streetFood', 'fineDining', 'wineSpirits',
  'hotSprings', // no developed springs in the park
  'auroraChasing', // 48.7°N — visible only in exceptional storms, not a draw
];

const TIERS: Record<string, Tier> = {
  scenicLandscapes: 'signature',
  hiking: 'signature',
  campingBackcountry: 'signature', // raised from strong — this is a backpacking park
  mountaineering: 'strong',
  landscapePhotography: 'strong',
  roadtrip: 'strong',
  wildflowerBlooms: 'strong',
  // nationalParks deliberately left at 'strong': hugely worthwhile, but not
  // one of the parks people plan a trip around the way they do Yellowstone.
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
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

  const [row] = await db.select().from(places).where(eq(places.id, 'north-cascades'));
  if (!row) { console.error('north-cascades not found'); process.exit(1); }

  const overlap = NA.filter((k) => SCORES[k] !== undefined);
  if (overlap.length) {
    console.error(`Cannot both score and N/A: ${overlap.join(', ')}`);
    process.exit(1);
  }

  const baseScores = { ...(row.baseScores as Record<string, number>), ...SCORES };
  const naSliders = Array.from(new Set([...(row.naSliders ?? []), ...NA]));
  const signatureTier = { ...(row.signatureTier as Record<string, Tier>), ...TIERS };
  const after = { ...row, baseScores, naSliders, signatureTier };

  console.log(`scores: ${Object.keys(SCORES).length}, N/A: ${NA.length}, tiers: ${Object.keys(TIERS).length}`);
  console.log(`authored total: ${Object.keys(baseScores).length}, N/A total: ${naSliders.length}`);
  if (dryRun) { console.log('\ndry run — nothing written.'); process.exit(0); }

  await db.transaction(async (tx) => {
    await tx.update(places).set({ baseScores, naSliders, signatureTier, updatedAt: new Date() }).where(eq(places.id, 'north-cascades'));
    await tx.insert(adminAuditLog).values({
      actorId: '00000000-0000-0000-0000-000000000000',
      entityType: 'destination',
      entityId: 'north-cascades',
      action: 'update',
      beforeValue: row,
      afterValue: after,
    });
    const curves = fitDestinationCurves(toScoringPlace(after as Parameters<typeof toScoringPlace>[0]));
    await tx.update(places).set({ sliderCurves: curves }).where(eq(places.id, 'north-cascades'));
  });

  console.log('\nwritten, curves refit.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
