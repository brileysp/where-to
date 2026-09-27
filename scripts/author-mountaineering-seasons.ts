import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * mountaineering's anchor tier (Chamonix, Nepal, Pakistan, Yosemite, El
 * Chalten, Denali/Interior, Swiss Alps, Dolomites) was already well-judged
 * — real, distinct, genuinely world-class alpinism centers, no mechanism-
 * artifact ties like golf/fishing had. But zero events existed anywhere,
 * despite mountaineering being unusually precisely seasonal — a wrong-
 * season attempt on these mountains isn't just a worse trip, it's
 * genuinely dangerous, so an accurate season window carries more weight
 * here than for most sliders.
 *
 * Denali and Pakistan (K2/Karakoram) get the narrowest, most dramatic
 * windows — both are famously tight, weather-critical seasons where the
 * mountain is essentially closed outside a few months. Nepal gets the
 * two-window pre/post-monsoon shape that defines Himalayan climbing
 * (spring is the main Everest season; monsoon summer is when the range is
 * genuinely at its most dangerous — avalanche risk, zero visibility).
 * Chamonix/Swiss Alps/Dolomites get the classic summer alpine season;
 * Yosemite and El Chalten get broader windows reflecting how much more
 * climbable they are outside their single narrowest month.
 */

const KEY = 'mountaineering';

const EDITS: { id: string; target: number; label: string; months: number[]; newBase: number }[] = [
  { id: 'nepal', target: 10, label: 'Pre/post-monsoon climbing season', months: [4, 5, 9, 10, 11], newBase: 7 },
  { id: 'yosemite', target: 10, label: 'Big-wall climbing season', months: [4, 5, 6, 7, 8, 9, 10], newBase: 8 },
  { id: 'denali-interior', target: 10, label: 'Denali summit season', months: [5, 6, 7], newBase: 6 },
  { id: 'pakistan', target: 10, label: 'Karakoram summer climbing window', months: [6, 7, 8], newBase: 6 },
  { id: 'el-chalten', target: 10, label: 'Patagonian summer climbing season', months: [12, 1, 2, 3], newBase: 7 },
  { id: 'chamonix', target: 10, label: 'Alpine summer climbing season', months: [6, 7, 8, 9], newBase: 7 },
  { id: 'swissalps', target: 10, label: 'Alpine summer climbing season', months: [6, 7, 8, 9], newBase: 6 },
  { id: 'dolomites', target: 10, label: 'Via ferrata & alpine climbing season', months: [5, 6, 7, 8, 9, 10], newBase: 6 },
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
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const originalBase = scoring.base[KEY];
    const base = e.newBase;

    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: e.label, weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents, base: { ...scoring.base, [KEY]: base } };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${e.id.padEnd(18)} base=${originalBase}->${base}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: base },
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
