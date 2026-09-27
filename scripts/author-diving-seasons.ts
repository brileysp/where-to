import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * diving's tier structure was already well-judged (10 real anchors, a
 * sensible tier below) — unlike fishing/kayakingRafting/sailing, this
 * wasn't a mechanism-artifact mess. But all 7 flat-10 anchors (Raja Ampat,
 * Palau, GBR, Galápagos, Egypt, Maldives, Belize) showed identically 10
 * every month, with zero seasonal shape, despite each having a real,
 * specific, often-famous best season. Giving them real shape — each still
 * reaches 10, just no longer claims to be equally perfect in its worst
 * month as its best.
 *
 * Galápagos is deliberately the OPPOSITE of its sailing-comfort season:
 * the cooler, choppier Humboldt-current season (Jun–Nov) is when the big
 * pelagic action serious divers actually go for (hammerhead schools and
 * whale sharks at Darwin/Wolf) peaks — a genuinely different priority than
 * sailing comfort, not an inconsistency.
 *
 * Egypt is deliberately given the gentlest shape of the seven: the Red Sea
 * is one of the least seasonal great dive destinations on Earth (20-40m
 * visibility nearly year-round) — forcing a dramatic shape onto it would
 * be less accurate, not more.
 */

const EDITS: { id: string; target: number; label: string; months: number[]; newBase: number }[] = [
  { id: 'rajaampat', target: 10, label: 'Dry-season liveaboard window', months: [10, 11, 12, 1, 2, 3, 4], newBase: 8 },
  { id: 'palau', target: 10, label: 'Dry-season calm window', months: [11, 12, 1, 2, 3, 4], newBase: 8 },
  { id: 'gbr', target: 10, label: 'Dry-season calm window', months: [5, 6, 7, 8, 9, 10], newBase: 8 },
  { id: 'galapagos', target: 10, label: 'Cool-current pelagic season (hammerheads/whale sharks)', months: [6, 7, 8, 9, 10, 11], newBase: 8 },
  { id: 'egypt', target: 10, label: 'Shoulder-season calm window', months: [4, 5, 9, 10, 11], newBase: 9 },
  { id: 'maldives', target: 10, label: 'Dry NE-monsoon window', months: [12, 1, 2, 3, 4], newBase: 8 },
  { id: 'belize', target: 10, label: 'Dry season & whale shark aggregation (Gladden Spit)', months: [12, 1, 2, 3, 4, 5, 6], newBase: 8 },
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

  const KEY = 'diving';
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

    console.log(`  ${e.id.padEnd(14)} base=${originalBase}->${base}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

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
