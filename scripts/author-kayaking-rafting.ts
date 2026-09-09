import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * kayakingRafting had zero authored destinations in the entire catalog —
 * every score was generic base + the shared 'swim' formula's dry/wet/cold
 * fallback, with no real seasonal identity anywhere. Authored against three
 * real drivers (confirmed with the user before writing this):
 *
 *   1. Big-volume whitewater rivers with a real season — the bucket-list
 *      adrenaline trips.
 *   2. Multi-day sea kayaking / fjord & coastal paddling.
 *   3. Wilderness canoe/mokoro expeditions.
 *
 * Four anchors at 10, each for a genuinely distinct reason: Zambezi
 * (Zambia/Zimbabwe — the same world-famous rapids from opposite banks,
 * single-day extreme whitewater), Grand Canyon (multi-day wilderness
 * rafting expedition), Abel Tasman/Marlborough (world-class multi-day sea
 * kayaking).
 */

const EDITS: { id: string; target: number; label: string; months: number[]; newBase?: number }[] = [
  // Driver 1 — big-volume whitewater
  { id: 'zambia', target: 10, label: 'Zambezi low-water whitewater season', months: [8, 9, 10, 11, 12, 1] },
  { id: 'zimbabwe', target: 10, label: 'Zambezi low-water whitewater season', months: [8, 9, 10, 11, 12, 1] },
  { id: 'grandcanyon', target: 10, label: 'Colorado River rafting season', months: [4, 5, 6, 7, 8, 9, 10] },
  { id: 'nepal', target: 9, label: 'Whitewater rafting season (pre/post-monsoon)', months: [3, 4, 5, 10, 11, 12] },
  { id: 'uganda', target: 9, label: 'Nile whitewater season (dry months)', months: [12, 1, 2, 6, 7, 8] },
  { id: 'costa-rica', target: 9, label: 'Pacuare River big-water season', months: [6, 7, 8, 9, 10] },
  // North Island's base (8) already equalled its old flat score, leaving no
  // room for a positive event weight — the event would have landed on
  // exactly the months this destination's wet flag also covers, producing
  // a trough where a peak was intended. Lowering the base gives the event
  // real room to work.
  { id: 'north-island', target: 8, label: 'Kaituna Falls high-flow season', months: [6, 7, 8], newBase: 6 },
  { id: 'queenstown', target: 8, label: 'Snowmelt whitewater season', months: [11, 12, 1, 2], newBase: 6 },
  { id: 'ecuadorian-andes', target: 8, label: 'Amazon-basin whitewater season', months: [4, 5, 6, 7] },
  // Driver 2 — sea kayaking / fjord & coastal paddling
  { id: 'marlborough-abel-tasman', target: 10, label: 'Abel Tasman coastal kayaking season', months: [11, 12, 1, 2, 3, 4] },
  { id: 'southeast-alaska', target: 8, label: 'Inside Passage sea-kayaking season', months: [6, 7, 8] },
  { id: 'los-cabos', target: 8, label: 'Sea of Cortez calm-water kayaking season', months: [10, 11, 12, 1, 2, 3, 4] },
  // Milford Sound/Fiordland's base (8) sat ABOVE the 7 target — the same
  // target<base shape as Lapland's skiing fix: a negative event weight
  // would have pulled the intended peak months down to 7 while shoulder
  // months with no event stayed at the too-high base of 8, overshooting
  // the destination's actual peak. Lowering the base fixes it properly.
  { id: 'milford-sound-fiordland', target: 7, label: 'Fiordland calm-season kayaking', months: [12, 1, 2, 3], newBase: 5 },
  { id: 'vancouver-island', target: 7, label: 'Summer sea-kayaking season', months: [6, 7, 8, 9] },
  { id: 'fjords', target: 7, label: 'Fjord kayaking season', months: [5, 6, 7, 8], newBase: 5 },
  { id: 'croatia', target: 7, label: 'Dalmatian coast sea-kayaking season', months: [5, 6, 7, 8, 9] },
  // Driver 3 — wilderness canoe/mokoro expeditions
  { id: 'botswana', target: 8, label: 'Okavango Delta flood season (mokoro)', months: [6, 7, 8, 9] },
  { id: 'peruvian-amazon', target: 7, label: 'Dry-season canoe expeditions', months: [6, 7, 8, 9] },
  // Same target<base overshoot as Milford Sound — Everglades' base (8) was
  // above the 7 target. Also broadened to the real Dec–Apr dry season
  // rather than just Dec–Mar.
  { id: 'everglades', target: 7, label: 'Dry-season canoe trail (Wilderness Waterway)', months: [12, 1, 2, 3, 4], newBase: 5 },
];

const MAX_STEEPNESS = 4;
const ERROR_TOLERANCE = 0.5;

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
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores, isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const KEY = 'kayakingRafting';
  for (const e of EDITS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const originalBase = scoring.base[KEY];
    const base = e.newBase ?? originalBase;

    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: e.label, weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents, base: { ...scoring.base, [KEY]: base } };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${e.id.padEnd(24)} base=${originalBase}${e.newBase ? `->${base}` : ''}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (e.newBase !== undefined) {
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: e.newBase };
    }
    const after = { ...row, ...patch };
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
          afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
