import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Found while surveying the surfing slider: 4 destinations had a
 * correctly-identified real swell event authored, but with weight: 0 —
 * a structural no-op, since bonus = weight * intensity. Three are genuine
 * phenomena (verified against current sources before fixing): Cornwall's
 * autumn/winter Atlantic swell (Fistral/Newquay), Mundaka's Oct-Feb
 * point-break season (one of Europe's most famous left points, real
 * despite worse general weather then), and Tofino's Nov-Mar storm swell
 * (extraordinary but advanced-only, vs. small beginner-friendly summer
 * waves). GBR's "East-coast autumn/winter swell" is the odd one out —
 * this catalog entry is specifically the reef itself (Cairns/Whitsundays/
 * Port Douglas), where the reef structurally blocks most incoming swell
 * (the same reason the water is calm enough for the diving this slider's
 * catalog entry is actually known for). Real East Australia surf culture
 * (Byron Bay, Noosa, the Gold Coast) is well south of the reef and not
 * really "GBR" — so instead of inventing a weight, this event is removed
 * as a stale mislabel, and content will honestly describe GBR as not a
 * real surf destination.
 */

const KEY = 'surfing';

const WEIGHT_FIXES: Record<string, number> = {
  cornwall: 2,
  // Kept under the anchor ceiling (surfing's "ten" anchors are exactly
  // bali/maui/lisbon, per src/lib/scoring/anchors.ts) rather than assuming
  // Mundaka/Tofino should join that set — db:audit:anchors flagged both at
  // weight 3 as unintended new 10s. Real-world case for adding Mundaka as
  // a 4th "world-reference wave" anchor is genuinely plausible (it's a
  // globally famous point break, former WSL tour stop) — flagged for the
  // user rather than decided here. Tofino is a real, extraordinary story
  // but not typically called a world-reference wave the way the existing
  // three are, so weight 2 (peak 9) reflects "very good," not "the best."
  'basque-country': 1,
  'vancouver-island': 2,
};
const REMOVE_EVENT_FROM = ['gbr'];

async function main() {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  const env: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, newWeight] of Object.entries(WEIGHT_FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const existingEvents = ((row.sliderEvents as Record<string, unknown>)?.[KEY] as Array<{ label: string; weight: number; months: Record<string, number> }>) ?? [];
    const newEvents = existingEvents.map((e) => ({ ...e, weight: newWeight }));
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: newEvents } };
    const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`  ${id}`);
    console.log(`    before: peak=${Math.max(...before).toFixed(1)}  monthly=[${before.map((v: number) => v.toFixed(0)).join(',')}]`);
    console.log(`    after:  peak=${Math.max(...monthly).toFixed(1)}  monthly=[${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);

    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: newEvents },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
  }

  for (const id of REMOVE_EVENT_FROM) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [] } };
    const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`  ${id} (removing inert/mislabeled event)`);
    console.log(`    before: peak=${Math.max(...before).toFixed(1)}  monthly=[${before.map((v: number) => v.toFixed(0)).join(',')}]`);
    console.log(`    after:  peak=${Math.max(...monthly).toFixed(1)}  monthly=[${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);

    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    const remainingEvents = { ...(row.sliderEvents as Record<string, unknown>) };
    delete remainingEvents[KEY];
    const patch: Record<string, unknown> = {
      sliderEvents: remainingEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
  }

  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
