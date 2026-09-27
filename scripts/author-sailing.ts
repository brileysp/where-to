import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * sailing had exactly one real anchor (Croatia) and zero authored events
 * anywhere else despite 139 destinations being able to carry the slider —
 * the same never-authored shape as kayakingRafting and spectatorSports.
 * Authored against four real drivers (confirmed with the user first):
 *
 *   1. Classic charter/flotilla cruising grounds — calm, protected,
 *      island-studded waters with an established charter industry.
 *   2. Excellent secondary charter grounds, real but not "the" reference.
 *   3. Good but more casual/regional sailing.
 *   4. Scenic/expedition sailing, where the sailing is secondary to
 *      reaching somewhere spectacular.
 *
 * Two new anchors join Croatia, each a distinct Mediterranean/Caribbean
 * icon: Santorini/Cyclades (the archetypal Aegean flotilla-sailing ground,
 * defined by the meltemi) and Bahamas/Exuma (the Caribbean's premier
 * cruising ground). Sydney sits a tier below despite its size — the
 * slider's own definition is "A world cruising ground," and Sydney's
 * global sailing fame is really about ocean RACING (Sydney–Hobart), not
 * the relaxed charter cruising this anchor tier is about; its harbor is
 * still genuinely excellent, just not the same claim.
 */

const EDITS: { id: string; target: number; label: string; months: number[]; newBase?: number }[] = [
  // Driver 1 — classic charter/flotilla cruising grounds (anchors)
  { id: 'santorini', target: 10, label: 'Meltemi sailing season (Cyclades)', months: [6, 7, 8, 9] },
  { id: 'bahamas', target: 10, label: 'Dry-season charter season (Exuma)', months: [12, 1, 2, 3, 4] },
  // Driver 2 — excellent secondary charter grounds
  { id: 'gbr', target: 9, label: 'Dry-season charter season (Whitsundays)', months: [5, 6, 7, 8, 9, 10] },
  { id: 'seychelles', target: 9, label: 'Inter-monsoon calm season', months: [4, 5, 10, 11] },
  { id: 'fiji', target: 9, label: 'Dry-season charter season', months: [5, 6, 7, 8, 9, 10] },
  { id: 'north-island', target: 9, label: 'Summer sailing season (Bay of Islands)', months: [12, 1, 2, 3] },
  // Driver 3 — good but more casual/regional sailing
  { id: 'thailand', target: 8, label: 'Dry-season sailing (Andaman coast)', months: [11, 12, 1, 2, 3, 4] },
  // Sydney's base (8) already equalled its target — same shape as North
  // Island/Queenstown/Fjords in the kayakingRafting pass: the event weight
  // lands on zero and the intended summer peak never shows. Lowering the
  // base gives it real room.
  { id: 'sydney', target: 8, label: 'Summer harbor sailing season', months: [11, 12, 1, 2, 3], newBase: 6 },
  { id: 'turks-caicos', target: 8, label: 'Dry-season charter season', months: [12, 1, 2, 3, 4] },
  // Driver 4 — scenic/expedition sailing
  { id: 'cape-town', target: 7, label: 'Summer sailing season', months: [11, 12, 1, 2, 3] },
  { id: 'southeast-alaska', target: 7, label: 'Inside Passage sailing season', months: [6, 7, 8] },
  // Fjords' base (8) sat ABOVE the 7 target — the same target<base
  // overshoot shape as Lapland/Milford Sound/Everglades: a negative event
  // weight would pull the intended summer peak DOWN to 7 while the
  // shoulder months (no event, no penalty) stayed at the too-high base of
  // 8, turning the intended peak into a trough. Lowering the base fixes it.
  { id: 'fjords', target: 7, label: 'Fjord sailing season', months: [5, 6, 7, 8], newBase: 5 },
  { id: 'galapagos', target: 7, label: 'Warm-season sailing comfort', months: [12, 1, 2, 3, 4, 5] },
  { id: 'antarctica', target: 6, label: 'Antarctic sailing season', months: [11, 12, 1, 2, 3] },
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

  const KEY = 'sailing';
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

    console.log(`  ${e.id.padEnd(18)} base=${originalBase}${e.newBase ? `->${base}` : ''}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

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
