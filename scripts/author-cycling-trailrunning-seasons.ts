import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * cyclingRoad and trailRunning both had well-judged anchor tiers already —
 * real, distinct, genuinely legendary destinations, no mechanism-artifact
 * ties like golf/horsebackRiding had. But zero events existed anywhere for
 * either, despite both being precisely seasonal for a hard physical
 * reason: the legendary high-mountain passes and trails that make most of
 * these anchors famous (Stelvio, Col des Montets, Furka, high Dolomites
 * trails) are literally snow-gated for months, not just less pleasant.
 *
 * The Mediterranean anchors (Mallorca, Tuscany, Andalucia) get the
 * opposite treatment — their event windows are deliberately spring/fall,
 * NOT high summer, because Jul/Aug is genuinely too hot there (all three
 * carry a real 'hot' flag; Andalucia's is flagged 'severe'). Mallorca and
 * Andalucia specifically are also real winter pro-cycling training hubs
 * (mild enough for base miles when the rest of Europe is snowed in), which
 * shapes their windows further. The Canaries — genuinely mild almost
 * year-round, no 'hot' flag at all — gets the gentlest shape of the
 * bunch, centered on when the actual Transgrancanaria trail race happens
 * (February) rather than a dramatic swing it doesn't have a real driver
 * for.
 */

const EDITS: { id: string; key: string; target: number; label: string; months: number[]; newBase: number }[] = [
  // --- cyclingRoad ---
  { id: 'mallorca', key: 'cyclingRoad', target: 10, label: 'Spring training & shoulder-season riding', months: [3, 4, 5, 6, 9, 10], newBase: 7 },
  { id: 'dolomites', key: 'cyclingRoad', target: 10, label: 'Snow-free high-pass season', months: [6, 7, 8, 9], newBase: 6 },
  { id: 'provence', key: 'cyclingRoad', target: 10, label: 'Shoulder-season Ventoux riding', months: [4, 5, 6, 9, 10], newBase: 7 },
  { id: 'tuscany', key: 'cyclingRoad', target: 10, label: 'Strade Bianche season', months: [3, 4, 5, 6, 9, 10, 11], newBase: 7 },
  { id: 'chamonix', key: 'cyclingRoad', target: 10, label: 'Snow-free high-pass season', months: [6, 7, 8, 9], newBase: 7 },
  { id: 'swissalps', key: 'cyclingRoad', target: 10, label: 'Snow-free high-pass season', months: [6, 7, 8, 9], newBase: 6 },
  { id: 'andalucia', key: 'cyclingRoad', target: 10, label: 'Winter training season', months: [11, 12, 1, 2, 3], newBase: 7 },
  { id: 'colombian-andes', key: 'cyclingRoad', target: 10, label: 'Dry-season climbing window', months: [12, 1, 2, 6, 7, 8], newBase: 7 },
  // --- trailRunning ---
  { id: 'el-chalten', key: 'trailRunning', target: 10, label: 'Patagonian summer trail season', months: [11, 12, 1, 2, 3], newBase: 7 },
  { id: 'lake-district', key: 'trailRunning', target: 10, label: 'Fell-running season', months: [4, 5, 6, 7, 8, 9, 10], newBase: 6 },
  { id: 'canaries', key: 'trailRunning', target: 10, label: 'Transgrancanaria season', months: [1, 2, 3], newBase: 8 },
  { id: 'cape-town', key: 'trailRunning', target: 10, label: 'Shoulder-season trail conditions', months: [3, 4, 5, 9, 10, 11], newBase: 7 },
  { id: 'dolomites', key: 'trailRunning', target: 10, label: 'Snow-free trail season', months: [6, 7, 8, 9], newBase: 7 },
  { id: 'chamonix', key: 'trailRunning', target: 10, label: 'Alpine trail season & UTMB', months: [6, 7, 8, 9], newBase: 7 },
  { id: 'swissalps', key: 'trailRunning', target: 10, label: 'Snow-free trail season', months: [6, 7, 8, 9], newBase: 6 },
  { id: 'rocky-mountain', key: 'trailRunning', target: 10, label: 'Snow-free trail season', months: [6, 7, 8, 9], newBase: 7 },
  { id: 'nepal', key: 'trailRunning', target: 10, label: 'Pre/post-monsoon trail season', months: [4, 5, 10, 11], newBase: 6 },
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

  for (const e of EDITS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, e.key)) { console.error(`${e.id}/${e.key}: is N/A`); process.exit(1); }
    const originalBase = scoring.base[e.key];
    const base = e.newBase;

    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: e.label, weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [e.key]: events };
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents, base: { ...scoring.base, [e.key]: base } };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[e.key];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${e.key.padEnd(14)} ${e.id.padEnd(18)} base=${originalBase}->${base}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [e.key]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), e.key])),
      baseScores: { ...(row.baseScores as Record<string, unknown>), [e.key]: base },
    };
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
