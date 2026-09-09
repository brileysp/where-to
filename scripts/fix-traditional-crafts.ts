import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * traditionalCrafts had a real, well-judged top tier (Morocco/Oaxaca at 9,
 * Peru/Guatemala/Rajasthan/Bali/Uzbekistan at 8) but had never reached a
 * genuine 10 — Morocco and Oaxaca are each plausibly THE reference for a
 * distinct craft tradition (North African/Islamic vs. Mesoamerican/
 * indigenous Mexican), promoted here. That left a gap straight from 10 to
 * 8 with nothing at 9 — Peru, Guatemala, and Rajasthan's craft-tourism fame
 * (Cusco/Sacred Valley weaving, Maya textile markets, Jaipur's UNESCO
 * Creative City of Crafts status) is genuinely a notch above Bali/
 * Uzbekistan's, so those three move up to fill it; Bali and Uzbekistan stay
 * at 8 — real, but craft isn't quite either destination's headline claim
 * the way it is for the other three.
 *
 * Also found five genuine misses among the 165 N/A destinations, checked
 * against real craft-tourism fame rather than "does some craft exist
 * here": Panama's Kuna Yala mola textiles (museum-quality indigenous
 * reverse-appliqué art, globally recognized), Rwanda's Agaseke "peace
 * baskets" (a real, marketed craft-tourism product), Mongolia's nomadic
 * felt/leather/silverwork tradition, Finnish Lapland's Sámi duodji craft,
 * and Seoul's hanji paper/celadon tradition with a dedicated craft
 * district (Insadong). All modest-to-good tier, not anchor-adjacent —
 * none rivals Morocco/Oaxaca/Peru/Guatemala/Rajasthan in prominence.
 */

const KEY = 'traditionalCrafts';

// Base-only bumps for already-scored destinations — the culture formula's
// dry/wet fallback still applies on top, so these just shift the whole
// shape up by the same amount rather than flattening it.
const BASE_BUMPS: { id: string; newBase: number }[] = [
  { id: 'morocco', newBase: 9 },
  { id: 'oaxaca', newBase: 9 },
  { id: 'peru', newBase: 8 },
  { id: 'guatemala', newBase: 8 },
  { id: 'rajasthan-golden-triangle', newBase: 8 },
];

// New additions — currently N/A, being un-N/A'd with a genuine base score.
const NEW_ADDITIONS: { id: string; base: number }[] = [
  { id: 'panama', base: 6 },
  { id: 'rwanda', base: 5 },
  { id: 'mongolia', base: 5 },
  { id: 'lapland', base: 4 },
  { id: 'seoul', base: 4 },
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

  async function applyBase(id: string, newBase: number, clearNA: boolean) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const naSliders: string[] = row.naSliders ?? [];
    if (clearNA && !naSliders.includes(KEY)) { console.error(`${id}: expected to be N/A but isn't`); process.exit(1); }
    if (!clearNA && isSliderNA(scoring, KEY)) { console.error(`${id}: unexpectedly N/A`); process.exit(1); }
    const nextNA = clearNA ? naSliders.filter((k) => k !== KEY) : naSliders;

    const patchedScoring = { ...scoring, base: { ...scoring.base, [KEY]: newBase }, naSliders: nextNA };
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const peak = Math.max(...values);

    console.log(`  ${id.padEnd(28)} base->${newBase}  peak=${peak.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]${clearNA ? '  (un-N/A)' : ''}`);

    const patch: Record<string, unknown> = {
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: newBase },
    };
    if (clearNA) patch.naSliders = nextNA;
    const after = { ...row, ...patch };
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  console.log('Base bumps:');
  for (const e of BASE_BUMPS) await applyBase(e.id, e.newBase, false);

  console.log('\nNew additions:');
  for (const e of NEW_ADDITIONS) await applyBase(e.id, e.base, true);

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
