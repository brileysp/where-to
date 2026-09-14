import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Found while surveying the "flat" long tail for content-authoring:
 * Andalucía, Provence, and Sicily all had zero sliderEvents for birding
 * despite each holding a genuinely major, real phenomenon — Doñana's
 * wetlands plus the Strait of Gibraltar raptor migration bottleneck (one
 * of the world's most significant, comparable to Panama's or the
 * Bosphorus'), the Camargue's greater-flamingo breeding stronghold, and
 * the Strait of Messina's spring raptor passage. Their stored curves
 * only had the mild generic wet/dry fallback bump (2-3 range) — a
 * mechanism artifact, not a deliberate judgment about these places.
 * Authoring real events, same pattern as this session's Istanbul/
 * Panama/Greenland fixes.
 */

const KEY = 'birding';

const FIXES: Record<string, { events: Array<{ label: string; weight: number; months: Record<number, number> }> }> = {
  andalucia: {
    events: [
      { label: 'Strait of Gibraltar raptor migration', weight: 5, months: { 4: 0.6, 5: 0.5, 8: 0.6, 9: 1, 10: 0.7 } },
      { label: 'Doñana wetland wintering waterfowl', weight: 2, months: { 12: 1, 1: 1, 2: 0.7 } },
    ],
  },
  provence: {
    events: [
      { label: 'Camargue wetland breeding season (greater flamingos, herons)', weight: 3, months: { 4: 0.5, 5: 0.8, 6: 1, 7: 0.8 } },
    ],
  },
  sicily: {
    events: [
      { label: 'Strait of Messina raptor migration', weight: 3, months: { 4: 0.7, 5: 1 } },
    ],
  },
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
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
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, fix] of Object.entries(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: fix.events } };
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
    console.log(`  ${id}  base=${scoring.base[KEY]}  peak=${Math.max(...monthly[KEY]).toFixed(1)}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: fix.events },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
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
