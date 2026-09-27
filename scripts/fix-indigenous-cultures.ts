import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * indigenousCultures' top tier (Peru/Uluru/Papua New Guinea anchors, then
 * Guatemala/Ethiopia/Mongolia/Ecuadorian-Andes/Borneo/North-Island/Chiapas)
 * was already well-judged — real, distinct, no mechanism-artifact ties.
 * The real gap was in the 146-destination N/A list: checked it against
 * actual living-indigenous-culture tourism (not just "some history
 * exists") and found seven genuine misses.
 *
 * Morocco (Amazigh/Berber culture — Atlas Mountains villages, desert
 * nomad experiences) and Jordan (Bedouin culture, especially Wadi Rum's
 * iconic desert-camp tourism) are the strongest, most confident additions.
 * Hokkaido's Ainu are Japan's officially recognized indigenous people,
 * with real cultural infrastructure (the Upopoy national museum). Fiji's
 * iTaukei village culture and kava ceremony are a real, commonly-marketed
 * part of Fiji tourism, distinct from its beach/dive identity. Egypt's
 * Nubian culture (Aswan) and Uganda's Batwa forest communities (marketed
 * alongside gorilla trekking) are real but more secondary to each
 * destination's headline draw. Belize's Garifuna and Maya culture is real
 * but modest.
 *
 * All base-only — like traditionalCrafts, this isn't a seasonal activity,
 * so each destination's existing wet/dry flags (already set for other
 * sliders) shape it naturally rather than forcing an artificial event.
 */

const KEY = 'indigenousCultures';

const NEW_ADDITIONS: { id: string; base: number }[] = [
  { id: 'morocco', base: 6 },
  { id: 'jordan', base: 5 },
  { id: 'hokkaido', base: 4 },
  { id: 'fiji', base: 5 },
  { id: 'egypt', base: 4 },
  { id: 'uganda', base: 4 },
  { id: 'belize', base: 4 },
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
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const e of NEW_ADDITIONS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    const naSliders: string[] = row.naSliders ?? [];
    if (!naSliders.includes(KEY)) { console.error(`${e.id}: expected to be N/A but isn't`); process.exit(1); }
    const nextNA = naSliders.filter((k) => k !== KEY);

    const patchedScoring = { ...scoring, base: { ...scoring.base, [KEY]: e.base }, naSliders: nextNA };
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const peak = Math.max(...values);

    console.log(`  ${e.id.padEnd(10)} base->${e.base}  peak=${peak.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: e.base },
      naSliders: nextNA,
    };
    const after = { ...row, ...patch };
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: e.id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
