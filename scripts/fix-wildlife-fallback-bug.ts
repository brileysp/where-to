import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Found while starting the wildlife content-authoring project: the
 * wildlifePeak fallback bonus was +7, matching nothing else in the
 * codebase (hiking/birding's identical fallback both use +3). Fixed in
 * destinations.ts. Barbados, Thailand, and Bali all carried a stale
 * sliderCaps.wildlifeViewing=4 that was clearly a defensive patch for
 * this exact overshoot — removed here now that the root formula is
 * fixed, then every non-NA slider using the shared 'wildlife' formula
 * is refit from raw data so stored curves match the corrected live
 * formula (same always-refit discipline used for the birding fix).
 */

const AFFECTED_SLIDERS = ['wildlifeViewing', 'safari', 'whaleWatching', 'wildflowerBlooms'];
const REMOVE_STALE_CAP: Record<string, string[]> = {
  barbados: ['wildlifeViewing'],
  thailand: ['wildlifeViewing'],
  bali: ['wildlifeViewing'],
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
  const { toScoringPlace, getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores, isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const allRows = await db.select().from(places);
  let changed = 0;

  for (const row of allRows) {
    const scoring = toScoringPlace(row);
    let patch: Record<string, unknown> | null = null;

    for (const key of AFFECTED_SLIDERS) {
      if (isSliderNA(scoring, key)) continue;
      const capsToRemove = REMOVE_STALE_CAP[row.id] ?? [];
      const effectiveScoring = capsToRemove.includes(key)
        ? { ...scoring, sliderCaps: { ...(scoring.sliderCaps ?? {}), [key]: undefined } }
        : scoring;
      const { monthly } = deriveDestinationScores(effectiveScoring, { skipHazards: true });
      const livePeak = Math.max(...monthly[key]);
      const storedCurve = (row.sliderCurves as Record<string, { anchors?: Array<{ value: number }> }>)?.[key];
      const storedPeak = storedCurve?.anchors?.length ? Math.max(...storedCurve.anchors.map((a) => a.value)) : null;
      if (storedPeak !== null && Math.abs(storedPeak - livePeak) < 0.6 && !capsToRemove.includes(key)) continue;

      const fit = fitMonthlyToCurve(monthly[key], { maxSteepness: 4, errorTolerance: 0.5 });
      console.log(`  ${row.id.padEnd(28)} ${key.padEnd(16)} storedPeak=${storedPeak}  livePeak=${livePeak.toFixed(1)}  monthly=[${monthly[key].map((v: number) => v.toFixed(0)).join(',')}]`);
      patch = patch ?? {};
      patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), ...(patch.sliderCurves as Record<string, unknown> ?? {}), [key]: fit.curve };
      if (capsToRemove.includes(key)) {
        const caps = { ...(row.sliderCaps as Record<string, unknown>) };
        delete caps[key];
        patch.sliderCaps = caps;
      }
    }

    if (patch) {
      changed++;
      if (!dryRun) {
        const after = { ...row, ...patch };
        await db.transaction(async (tx) => {
          await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, row.id));
          await tx.insert(adminAuditLog).values({
            actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: row.id,
            action: 'update', beforeValue: row, afterValue: after,
          });
        });
      }
    }
  }

  console.log(`\n${changed} destinations refit.`);
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
