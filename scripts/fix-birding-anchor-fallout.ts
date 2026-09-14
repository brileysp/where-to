import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Fixing the anchor fallout from the birdingPeak formula fix + model-based
 * base corrections: 13 destinations landed on a peak of 10 without being
 * anchors. Checked each against the anchor definition ("top-tier species
 * counts, endemism, or a bird nobody sees anywhere else") and the real
 * mechanism behind their score:
 *
 *   - 9 (antarctica, tasmania, borneo, panama, tierra-del-fuego, belize,
 *     palawan, colombian-caribbean, chiapas) hit 10 purely via the generic
 *     birdingPeak fallback flag — zero real curated content behind the
 *     peak, the same mechanism-artifact shape found and fixed on every
 *     other slider this session. Dialed back to a genuine 9.
 *   - Everglades and Sri Lanka DO have real authored events, but read as
 *     excellent regional/specialist destinations rather than true
 *     world-reference tier (Everglades' wading-bird spectacle is
 *     singular but regional; Sri Lanka is a respected specialist
 *     destination, not usually rated among the world's elite birding
 *     countries). Event weight trimmed to land at 9 instead of 10.
 *   - Tanzania and Ethiopia both have genuine, deliberate authored events
 *     and real-world claims matching the existing anchor set: Tanzania is
 *     essentially the same Rift Valley/Palearctic-migrant story already
 *     anchored via Kenya (found while starting the African savanna
 *     batch), and Ethiopia's highland endemism is a distinct, genuinely
 *     world-class claim. Added to the anchor list.
 *
 * Ethiopia's event label ("Dry-season trekking access") also got the same
 * borrowed-from-trekking-content treatment found on Uganda/Rwanda/Costa
 * Rica — relabeled to the real birding reason while keeping the timing.
 */

const KEY = 'birding';

const FALLBACK_DIALBACK = ['antarctica', 'tasmania', 'borneo', 'panama', 'tierra-del-fuego', 'belize', 'palawan', 'colombian-caribbean', 'chiapas'];
const TARGET_PEAK = 9;

const EVENT_TRIM: { id: string; newWeight: number }[] = [
  { id: 'everglades', newWeight: 3 },
  { id: 'srilanka', newWeight: 3 },
];

const ETHIOPIA_LABEL = 'Dry-season access to highland endemics';

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

  async function writePatch(id: string, patch: Record<string, unknown>) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
    return row;
  }

  console.log('Fallback dial-back to 9:');
  for (const id of FALLBACK_DIALBACK) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const newBase = TARGET_PEAK - 3;
    const scoring = toScoringPlace({ ...row, baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: newBase } } as typeof row);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    console.log(`  ${id.padEnd(22)} base -> ${newBase}  peak=${Math.max(...monthly[KEY]).toFixed(1)}`);
    await writePatch(id, { baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: newBase } });
  }

  console.log('\nEvent weight trim to land at 9:');
  for (const e of EVENT_TRIM) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const existing = (row.sliderEvents as any)[KEY][0];
    const events = [{ ...existing, weight: e.newWeight }];
    const scoring = toScoringPlace({ ...row, sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events } } as typeof row);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    console.log(`  ${e.id.padEnd(22)} weight -> ${e.newWeight}  peak=${Math.max(...monthly[KEY]).toFixed(1)}`);
    await writePatch(e.id, { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events } });
  }

  console.log('\nEthiopia relabel (no numeric change):');
  {
    const [row] = await db.select().from(places).where(eq(places.id, 'ethiopia'));
    const existing = (row.sliderEvents as any)[KEY][0];
    const events = [{ ...existing, label: ETHIOPIA_LABEL }];
    console.log(`  ethiopia   "${existing.label}" -> "${ETHIOPIA_LABEL}"`);
    await writePatch('ethiopia', { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events } });
  }

  // Refit curves for everything just touched.
  console.log('\nRefitting curves:');
  for (const id of [...FALLBACK_DIALBACK, ...EVENT_TRIM.map((e) => e.id), 'ethiopia']) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
    console.log(`  ${id.padEnd(22)} final peak=${Math.max(...monthly[KEY]).toFixed(1)}`);
    if (!dryRun) {
      await db.update(places).set({
        sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
        authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
        updatedAt: new Date(),
      }).where(eq(places.id, id));
    }
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
