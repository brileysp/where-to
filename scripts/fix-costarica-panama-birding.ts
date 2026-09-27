import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Costa Rica's birding event was still labeled "Dry-season trail access &
 * birding activity" — flagged earlier this session as reading borrowed
 * from trekking content, never actually fixed. Relabeled to the real
 * reason (the resplendent quetzal's breeding display season genuinely
 * falls in this same window, Feb-Apr) — timing/weight unchanged.
 *
 * Panama had no real event at all, just the generic birdingPeak fallback
 * (Dec-Apr) — which completely misses Panama's single most famous
 * phenomenon: the fall raptor migration bottleneck (the "River of
 * Raptors"), when the narrow isthmus funnels an enormous concentration of
 * migrating broad-winged hawks, Swainson's hawks, and turkey vultures
 * south each October-November — one of the largest raptor migrations on
 * Earth. Authored a real two-season event: fall (the larger, more famous
 * push) and the existing spring/winter window as a secondary peak.
 */

const KEY = 'birding';

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
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL in .env.local'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  // --- Costa Rica: relabel only ---
  {
    const [row] = await db.select().from(places).where(eq(places.id, 'costa-rica'));
    const existing = (row.sliderEvents as any)[KEY][0];
    const events = [{ ...existing, label: 'Resplendent quetzal breeding display season' }];
    console.log(`  costa-rica  "${existing.label}" -> "Resplendent quetzal breeding display season"`);
    const patch = { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events } };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'costa-rica'));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'costa-rica',
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  // --- Panama: author a real two-season event ---
  {
    const [row] = await db.select().from(places).where(eq(places.id, 'panama'));
    const scoring = toScoringPlace(row);
    const base = scoring.base[KEY]; // 6
    const target = 9; // preserve existing model-fit peak
    const weight = target - base; // 3
    const events = [{
      label: 'Fall raptor migration bottleneck & spring passage',
      weight,
      months: { 10: 1, 11: 1, 2: 0.7, 3: 0.8, 4: 0.6, 1: 0.5, 12: 0.6 },
    }];
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: events } };
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
    console.log(`  panama      new event, peak=${Math.max(...monthly[KEY]).toFixed(1)}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, 'panama'));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'panama',
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
