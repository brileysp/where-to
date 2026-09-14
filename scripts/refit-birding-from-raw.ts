import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Fixes a widespread stale-curve bug found while starting the birding
 * content-authoring project: 59 of 200 non-NA birding destinations had a
 * stored curve whose peak didn't match what their own raw base +
 * sliderEvents + flags actually compute to (often by a lot — several
 * showed a stored peak of 4-6 when the raw data computes to 10).
 *
 * Root cause: smooth-curves.ts explicitly refits from "each destination's
 * CURRENT RENDERED monthly values — never the raw formula" (its own doc
 * comment), and refit-curves.ts rescales a freshly-computed shape back
 * onto the STORED min/max for any destination flagged authored=true.
 * Neither tool ever reconciles against the true current raw formula once
 * a curve has gone stale — they just keep re-smoothing around the wrong
 * number. This script is the one-time correction: derive fresh from raw
 * data for every non-NA birding destination and trust that peak, no
 * rescale-to-stale-ceiling step.
 *
 * This does NOT yet resolve the anchor-ceiling fallout — trusting raw
 * derivation is expected to push a large number of non-anchor
 * destinations up to a technical peak of 10 (event weights authored
 * without anchor-discipline review, the same class of issue found and
 * fixed for golf/horsebackRiding earlier this session, just at much
 * larger scale here). That gets triaged as a separate pass once we can
 * see the real "over" list from db:audit:anchors.
 */

const KEY = 'birding';
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
  const { toScoringPlace, getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores, isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const scored = await getAllScoredPlaces();
  let changed = 0, unchanged = 0;

  for (const p of scored as any[]) {
    const [row] = await db.select().from(places).where(eq(places.id, p.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) continue;

    const storedPeak = Math.max(...p.monthly[KEY]);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    const values = monthly[KEY];
    const livePeak = Math.max(...values);

    if (Math.abs(storedPeak - livePeak) <= 0.6) { unchanged++; continue; }

    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    console.log(`  ${p.id.padEnd(24)} storedPeak=${storedPeak.toFixed(1)} -> livePeak=${livePeak.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);
    if (!dryRun) {
      const patch = {
        sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
        authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      };
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, p.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: p.id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
    changed++;
  }

  console.log(`\n${changed} destinations refit from raw data, ${unchanged} already matched.`);
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
