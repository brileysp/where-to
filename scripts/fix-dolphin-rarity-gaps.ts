import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Prompted by the user: dolphins and porpoises are a genuine draw for
 * serious cetacean enthusiasts, especially rare or localized species —
 * treating "it's just dolphins" as automatically lesser than whales
 * was wrong in several places tonight. Verified three candidates
 * rather than assuming:
 *
 * Hong Kong: real, established industry (HK DolphinWatch, running
 * since 1995, ~97% sighting rate) built around a genuinely rare,
 * sharply declining population (Chinese white dolphin, ~158
 * individuals in 2003 down to ~37 by 2020) — the rarity is itself
 * part of the draw for a conservation-minded visitor.
 *
 * Milford Sound & Fiordland: confirmed real — "one of the southernmost"
 * (not THE southernmost, a 2015 study found an even more southerly
 * population at Stewart Island) resident bottlenose dolphin
 * populations in the world. Kept more modest than Hong Kong/Croatia
 * because current DOC protocol has cruise operators NOT actively
 * pursuing dolphins to reduce disturbance — sightings are opportunistic,
 * not close to guaranteed.
 *
 * Croatia (Lošinj): the strongest case of the three — Blue World
 * Institute has run continuous research since 1987 (one of the
 * longest-running studies of resident coastal bottlenose dolphins in
 * the Mediterranean), ~180-200 individually known, named dolphins, and
 * commercial tours run in direct partnership with the research body.
 */

const KEY = 'whaleWatching';

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

  const FIXES: Record<string, { base: number; events?: Array<{ label: string; weight: number; months: Record<number, number> }> }> = {
    hongkong: {
      base: 5,
      events: [{ label: 'Chinese white dolphin tours — better water visibility in the cool, dry season', weight: 2, months: { 11: 0.7, 12: 1, 1: 1, 2: 1, 3: 0.7 } }],
    },
    'milford-sound-fiordland': { base: 4 },
    croatia: { base: 6 },
  };

  for (const [id, fix] of Object.entries(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const newBase = { ...(row.baseScores as Record<string, number>), [KEY]: fix.base };
    const patchedRow = { ...row, baseScores: newBase, sliderEvents: fix.events ? { ...(row.sliderEvents as Record<string, unknown>), [KEY]: fix.events } : row.sliderEvents };
    const scoring = toScoringPlace(patchedRow);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
    console.log(`  ${id.padEnd(28)} base=${fix.base}  peak=${Math.max(...monthly[KEY]).toFixed(1)}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);
    const patch: Record<string, unknown> = {
      baseScores: newBase,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (fix.events) patch.sliderEvents = { ...(row.sliderEvents as Record<string, unknown>), [KEY]: fix.events };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? 'dry run' : 'done');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
