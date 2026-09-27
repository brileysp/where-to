import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve } from '../src/lib/scoring/curve';

/**
 * Sets sunbathing by what a place actually offers a sunbather, rather than
 * by its weather flags.
 *
 * Two problems the sun formula cannot solve on its own:
 *
 * 1. SHAPE. Destinations classified `hotSeverity: 'severe'` still collapse
 *    in their own summer — Rome scored 0 for sunbathing in June, July and
 *    August and 4 in April. Rome in August is hot, but "severe" in this
 *    catalogue should mean Rajasthan in May, not a Mediterranean summer.
 *    Rather than reclassify severity globally (which would ripple into
 *    hiking and every other formula that reads it), sunbathing is authored
 *    directly for the affected places.
 *
 * 2. LEVEL. Whether you can lie in the sun somewhere pleasant is a leisure
 *    fact, not a weather fact, and no combination of hot/dry/wet flags
 *    encodes it. A wine region where every hotel has a pool beats a dense
 *    city at the same latitude with the same weather. That is why Piedmont
 *    and Rioja sat at 2 while Rome sat at 4 — backwards.
 *
 * The scale:
 *   8-9  coastal or resort-dense and reliably hot — the beach or the pool
 *        IS the day (Barcelona, Lisbon, Napa, Provence)
 *   6-7  countryside with hot dry summers and a pool at every hotel
 *        (Tuscany, Piedmont, Rioja, the Douro, Sedona)
 *   4-5  a city with real outdoor sun culture — lake beaches, harbour
 *        baths, park lawns, some hotel pools (Copenhagen, Berlin, Chicago,
 *        Budapest)
 *   2-3  a dense city where sun is incidental to the visit (Rome, Paris,
 *        London, New York, Vienna)
 *
 * Every curve peaks in local summer with a shoulder either side, which is
 * the part the formula kept getting wrong.
 */

type Level = { id: string; peak: number; south?: boolean; why: string };

const LEVELS: Level[] = [
  // --- dense cities: low, but peaking in summer like everywhere else -----
  { id: 'rome', peak: 3, why: 'a dense city; was 0 in July and 4 in April' },
  { id: 'paris', peak: 3, why: 'Paris Plages aside, sun is incidental here' },
  { id: 'london', peak: 3, why: 'park lawns, and not much else' },
  { id: 'nyc', peak: 3, why: 'Central Park and a few hotel pools — below Copenhagen in summer' },
  { id: 'vienna', peak: 3, why: 'dense city; the Danube island is the exception' },
  { id: 'prague', peak: 3, why: 'dense city' },
  { id: 'seoul', peak: 3, why: 'dense city, and a wet summer' },
  { id: 'tokyo-kyoto', peak: 3, why: 'dense city, oppressive humid summer' },
  { id: 'mexicocity', peak: 3, why: 'high altitude, afternoon rain all summer' },
  { id: 'istanbul', peak: 4, why: 'dense, but the Bosphorus and the Princes Islands are real' },
  { id: 'uzbekistan', peak: 4, why: 'genuinely hot, but nowhere built for lying in it' },

  // --- cities that actually do sun properly ------------------------------
  { id: 'copenhagen', peak: 5, why: 'harbour baths and a city that empties onto the water in July' },
  { id: 'berlin', peak: 5, why: 'the lakes, and Berliners who need no encouragement' },
  { id: 'amsterdam', peak: 4, why: 'canal banks and Vondelpark' },
  { id: 'budapest', peak: 5, why: 'the outdoor thermal baths are the whole point' },
  { id: 'chicago', peak: 5, why: 'Lake Michigan has actual beaches' },

  // --- countryside and wine country: pools, space, hot dry summers -------
  { id: 'piedmont', peak: 6, why: 'hot dry summers and a pool at every agriturismo; was 2' },
  { id: 'rioja', peak: 6, why: 'hot dry Ebro valley summers; was 2' },
  { id: 'bordeaux', peak: 6, why: 'hot summers, chateau pools, the Atlantic an hour away' },
  { id: 'douro-valley-porto', peak: 6, why: 'the Douro bakes in August; quinta pools throughout. Was 2' },
  { id: 'sedona', peak: 6, why: 'red rock resort pools; was collapsing to 0 in high summer' },
  { id: 'texas-hill-country', peak: 6, why: 'pools, swimming holes and a long hot season' },
  { id: 'hudson-valley', peak: 4, why: 'warm summers and country-hotel pools; was 1' },
  { id: 'vermont', peak: 4, why: 'lake swimming and inn pools in July; was 2' },
  { id: 'cotswolds', peak: 3, why: 'English summer, occasionally' },
  { id: 'champagne', peak: 4, why: 'warm continental summers; was 1' },
  { id: 'oaxaca', peak: 4, why: 'reliable highland sun, few places built for lounging' },
  { id: 'mendoza', peak: 6, south: true, why: 'high desert sun and bodega pools' },
];

/**
 * A summer-peaked curve: peak across the three core summer months, a
 * shoulder either side, and a winter floor. Northern by default.
 */
function summerCurve(peak: number, south: boolean) {
  const shoulder = Math.max(0.5, Math.round(peak * 0.6 * 10) / 10);
  const floor = Math.max(0.5, Math.round(peak * 0.25 * 10) / 10);
  return south
    ? [
        { month: 1, value: peak, steepness: 1 },
        { month: 2, value: peak, steepness: 1 },
        { month: 3, value: shoulder, steepness: 2 },
        { month: 5, value: floor, steepness: 2 },
        { month: 8, value: floor, steepness: 1 },
        { month: 10, value: shoulder, steepness: 2 },
        { month: 12, value: peak, steepness: 2 },
      ]
    : [
        { month: 1, value: floor, steepness: 1 },
        { month: 3, value: floor, steepness: 2 },
        { month: 5, value: shoulder, steepness: 2 },
        { month: 6, value: peak, steepness: 2 },
        { month: 8, value: peak, steepness: 1 },
        { month: 9, value: shoulder, steepness: 2 },
        { month: 11, value: floor, steepness: 2 },
      ];
}

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

const KEY = 'sunbathing';

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  for (const e of LEVELS) {
    const row = byId.get(e.id);
    if (!row) { console.error(`${e.id}: not a primary destination`); process.exit(1); }
    const was = Math.max(...(scored.find((x) => x.id === e.id)?.monthly[KEY] ?? [0]));
    const curve = parseSliderCurve({ anchors: summerCurve(e.peak, e.south ?? false) });
    const patch = {
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    console.log(`  ${e.id.padEnd(22)} ${was.toFixed(0)} -> ${e.peak}   ${e.why}`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: e.id,
          action: 'update',
          beforeValue: row,
          afterValue: { ...row, ...patch },
        });
      });
    }
    byId.set(e.id, { ...row, ...patch } as typeof row);
  }

  console.log(dryRun ? `\ndry run — ${LEVELS.length} would change.` : `\ndone: ${LEVELS.length} authored.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
