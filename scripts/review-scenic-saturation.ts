import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * The scenicLandscapes saturation review — the first real use of authored
 * curves (see places.authoredCurves).
 *
 * 117 of 200 destinations peaked at a perfect 10 for scenery, which made
 * the top of the scale meaningless: Angkor, Beijing, Venice and Quebec City
 * all sat at 10 while the GRAND CANYON sat at 9. None of those 10s were
 * anybody's judgement — they are what the old formula produced by adding a
 * flat seasonal bonus to a base and clamping at the ceiling.
 *
 * Each destination below gets an authored PEAK. rescaleCurve keeps the
 * existing floor and seasonal shape and moves only the ceiling, so a
 * destination's month-to-month character is untouched; only its claim about
 * how good it gets is revised.
 *
 * The scale this applies:
 *   10  the global reference for landscape — the scenery IS the trip
 *    9  spectacular, a primary reason to go, not quite the world's best
 *    8  genuinely beautiful, a real part of the draw
 *    7  attractive, but people come for something else
 *    6  pleasant backdrop to a city or cultural destination
 *
 * Nothing is raised. This pass only removes 10s that were never claimed,
 * so destinations already at 9 or below are left entirely alone — the
 * Grand Canyon and Banff arguably deserve 10s, but adding them is a
 * separate decision and would work against the point of this pass.
 */

const TARGET: Record<number, string[]> = {
  10: [
    'torres-del-paine', 'el-chalten', 'dolomites', 'milford-sound-fiordland', 'chamonix',
    'swissalps', 'fjords', 'iceland', 'guilin-yangshuo', 'uyuni', 'atacama', 'nepal',
    'yosemite', 'lofoten', 'greenland',
  ],
  9: [
    'faroe-islands', 'antarctica', 'zion-bryce', 'arches-canyonlands', 'denali-interior',
    'glacier-waterton', 'pakistan', 'ladakh', 'ecuadorian-andes', 'monterey-big-sur',
    'scottish-highlands-skye', 'lake-district', 'snowdonia', 'sedona', 'namibia', 'cape-town',
    'north-cascades', 'olympic', 'southeast-alaska', 'marlborough-abel-tasman',
    'argentine-lake-district', 'chilean-lake-district', 'big-island', 'azores', 'kyrgyzstan',
    'tuscany', 'bhutan', 'canaries', 'svalbard', 'tierra-del-fuego',
  ],
  8: [
    'acadia', 'badlands-black-hills', 'bend-crater-lake', 'belize', 'borneo', 'botswana',
    'colombian-andes', 'cornwall', 'death-valley', 'ethiopia', 'galapagos', 'gbr', 'guatemala',
    'joshua-tree', 'kenya', 'komodo', 'lapland', 'madagascar', 'mongolia', 'mallorca', 'maui',
    'north-island', 'palau', 'palawan', 'papua-new-guinea', 'peruvian-amazon', 'rajaampat',
    'redwood', 'rwanda', 'sardinia', 'sicily', 'srilanka', 'tanzania', 'tasmania',
    'tbilisi-caucasus', 'uganda', 'uluru', 'vermont', 'zambia', 'zimbabwe', 'borabora',
  ],
  7: [
    'fiji', 'colombian-caribbean', 'kerala', 'puerto-rico', 'great-smoky-mountains', 'hokkaido',
    'ireland', 'churchill', 'mauritius', 'nicaragua', 'morocco', 'taiwan', 'sydney', 'provence',
    'bali', 'douro-valley-porto', 'belfast-giants-causeway', 'okinawa', 'nice-riviera',
  ],
  6: [
    'angkor', 'beijing', 'venice', 'chiang-mai', 'quebec-city', 'hudson-valley',
    'bavaria-munich', 'black-forest', 'basque-country', 'piedmont', 'puglia', 'mendoza',
  ],
};

const KEY = 'scenicLandscapes';

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
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Imported dynamically, AFTER the line above: db/client.ts reads
  // process.env at module load and silently falls back to the local PGlite
  // sandbox when DATABASE_URL is unset. A static import here loads it too
  // early and the script quietly runs against stale local data.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const scored = await getAllScoredPlaces();

  // The set under review is computed, not hand-listed, so nothing can be
  // silently missed if content shifts before this runs.
  const saturated = scored
    .filter((d) => Math.max(...(d.monthly[KEY] ?? [0])) >= 9.99)
    .map((d) => d.id);

  const assigned = new Map<string, number>();
  for (const [peak, ids] of Object.entries(TARGET)) {
    for (const id of ids) {
      if (assigned.has(id)) { console.error(`${id} assigned twice`); process.exit(1); }
      assigned.set(id, Number(peak));
    }
  }

  const missing = saturated.filter((id) => !assigned.has(id));
  const extra = [...assigned.keys()].filter((id) => !saturated.includes(id));
  if (missing.length || extra.length) {
    if (missing.length) console.error(`Unassigned peak-10 destinations (${missing.length}):\n  ${missing.join(' ')}`);
    if (extra.length) console.error(`Assigned but not at peak 10 (${extra.length}):\n  ${extra.join(' ')}`);
    process.exit(1);
  }

  const counts: Record<number, number> = {};
  let written = 0;
  for (const id of saturated) {
    const target = assigned.get(id)!;
    counts[target] = (counts[target] ?? 0) + 1;
    if (target >= 10) continue; // already there; nothing to write

    const row = byId.get(id)!;
    const d = scored.find((x) => x.id === id)!;
    const floor = Math.min(...(d.monthly[KEY] ?? [0]));
    const rawCurve = (row.sliderCurves as Record<string, unknown>)[KEY];
    if (rawCurve === undefined) { console.error(`${id}: no ${KEY} curve to reshape`); process.exit(1); }

    const rescaled = rescaleCurve(parseSliderCurve(rawCurve), floor, target);
    const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: rescaled };
    const authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), KEY]));
    const after = { ...row, sliderCurves, authoredCurves };

    console.log(`  ${id.padEnd(26)} peak 10 -> ${target}   (floor ${floor.toFixed(0)} kept)`);
    if (dryRun) { written++; continue; }

    await db.transaction(async (tx) => {
      await tx
        .update(places)
        .set({ sliderCurves: sliderCurves as typeof places.$inferInsert.sliderCurves, authoredCurves, updatedAt: new Date() })
        .where(eq(places.id, id));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: id,
        action: 'update',
        beforeValue: row,
        afterValue: after,
      });
    });
    written++;
  }

  console.log(`\ntarget distribution: ` + Object.entries(counts).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => `${k}:${v}`).join('  '));
  console.log(dryRun ? `\ndry run — ${written} would change.` : `\ndone: ${written} destinations reshaped, 15 kept at 10.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
