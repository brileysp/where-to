import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * North Cascades and Finnish Lapland both landed at a skiing peak of 9 —
 * tied with Banff — purely because base + the flat `cold` bonus (+3)
 * happened to land there. Nobody ever judged them to rival Banff; the tie
 * was coincidental, not a real comparison. Caught by review: North
 * Cascades (Mt. Baker/Stevens Pass) is a genuine powder cult destination
 * (Baker holds the world snowfall record) but nowhere near Banff's overall
 * resort caliber — moved to 7, alongside Rocky Mountain/Yellowstone.
 * Finnish Lapland (Levi/Ylläs/Ruka) is a pleasant, family-oriented Nordic
 * region whose real fame is cross-country skiing and the northern lights,
 * not downhill terrain — moved to 5, alongside Seoul.
 */

const EDITS: { id: string; target: number; months: number[]; newBase?: number; addNoSnow?: number[] }[] = [
  { id: 'north-cascades', target: 7, months: [11, 12, 1, 2, 3] },
  // Lapland's target (5) sits BELOW its existing base (6) — a negative-
  // weight event would have made its winter months score LOWER than its
  // off-season, which is nonsensical. The base itself was the thing
  // overstating it, not just the seasonal bonus: only Jun-Aug were ever
  // flagged noSnow, leaving Apr/May/Sep/Oct sitting at the bare (too high)
  // base with no winter bump and no summer floor. Lowering the base to 2
  // and extending noSnow across the full snow-free shoulder is the
  // complete fix — every other ski destination in the catalog already
  // works this way (low base, positive winter event, hard summer floor).
  { id: 'lapland', target: 5, months: [11, 12, 1, 2, 3], newBase: 2, addNoSnow: [4, 5, 9, 10] },
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

  const KEY = 'skiingSnowboarding';
  for (const e of EDITS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const originalBase = scoring.base[KEY];
    const base = e.newBase ?? originalBase;
    const noSnow = e.addNoSnow ? Array.from(new Set([...(scoring.noSnow ?? []), ...e.addNoSnow])) : scoring.noSnow;

    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: 'Ski season', weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = {
      ...scoring,
      sliderEvents: patchedEvents,
      base: { ...scoring.base, [KEY]: base },
      noSnow,
    };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${e.id.padEnd(20)} base=${originalBase}${e.newBase ? `->${base}` : ''}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (e.newBase !== undefined) {
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: e.newBase };
    }
    if (e.addNoSnow) {
      patch.noSnowMonths = noSnow;
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
