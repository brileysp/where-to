import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * African savanna & Rift Valley birding batch — found while cross-checking
 * Kenya and Tanzania (which are genuinely fine: both authored with the
 * real, distinct "Palearctic migrant arrivals" event) that most of the
 * rest of this batch shares IDENTICAL generic event labels across
 * countries with different real ecology:
 *
 *   - "Drier trails" (Uganda, Rwanda) reads borrowed from gorilla-trekking
 *     content — the real reason to visit either in the dry season is the
 *     Albertine Rift's endemic-rich forest birding, not "nicer trails".
 *     Timing/weight already look right; only the label was wrong.
 *
 *   - "Wet-season migratory bird arrivals" (Zambia, Botswana, Namibia) is
 *     word-for-word identical across three countries with genuinely
 *     different hydrology:
 *       - Zambia's real spectacle (southern carmine bee-eaters nesting in
 *         riverbank cliffs) is a DRY-season event (Aug-Oct, when low water
 *         exposes the nesting banks) — the opposite half of the year from
 *         what was authored.
 *       - Botswana's Okavango Delta has an inverted flood pulse — Angolan
 *         headwater rains take months to arrive, so the Delta actually
 *         floods in the dry season (Jun-Sep), the same window already
 *         correctly used for this destination's kayakingRafting score.
 *       - Namibia is Africa's most arid country outside the Sahara; its
 *         real story is Etosha Pan's dry-season (May-Oct) waterhole
 *         concentration, not a wet-season migrant narrative borrowed from
 *         wetter East Africa.
 *
 *   - Zimbabwe had no event at all, despite sharing the same Zambezi
 *     corridor and carmine bee-eater colonies as Zambia (visible from
 *     either bank) plus Hwange's own dry-season waterhole concentration.
 */

const KEY = 'birding';

// Relabel only — timing/weight already correct, just describes the wrong reason.
const RELABEL: { id: string; label: string }[] = [
  { id: 'uganda', label: 'Dry-season forest access (Albertine Rift endemics)' },
  { id: 'rwanda', label: 'Dry-season forest access (Albertine Rift endemics)' },
];

// Real retiming/new events, preserving each destination's existing peak
// (a mechanism/timing fix, not a re-judgment of deservedness) except
// Zimbabwe, which gains genuinely new content.
const RETIME: { id: string; target: number; label: string; months: number[] }[] = [
  { id: 'zambia', target: 7, label: 'Carmine bee-eater colonies (dry season)', months: [8, 9, 10] },
  { id: 'zimbabwe', target: 8, label: 'Carmine bee-eater colonies & Hwange waterhole season (dry season)', months: [8, 9, 10] },
  { id: 'botswana', target: 9, label: 'Okavango Delta flood season', months: [6, 7, 8, 9] },
  { id: 'namibia', target: 9, label: 'Etosha Pan dry-season waterhole concentration', months: [5, 6, 7, 8, 9, 10] },
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

  console.log('Relabeling (also refitting the stored curve, since it may be stale):');
  for (const e of RELABEL) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    const existing = scoring.sliderEvents?.[KEY]?.[0];
    if (!existing) { console.error(`${e.id}: no existing event to relabel`); process.exit(1); }
    const events = [{ ...existing, label: e.label }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const { monthly } = deriveDestinationScores({ ...scoring, sliderEvents: patchedEvents }, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    console.log(`  ${e.id.padEnd(10)} "${existing.label}" -> "${e.label}"  live-derived peak=${Math.max(...values).toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);
    if (!dryRun) {
      const patch = {
        sliderEvents: patchedEvents,
        sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
        authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      };
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: e.id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  console.log('\nRetiming / new events:');
  for (const e of RETIME) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const base = scoring.base[KEY];
    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: e.label, weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const { monthly } = deriveDestinationScores({ ...scoring, sliderEvents: patchedEvents }, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const peak = Math.max(...values);
    console.log(`  ${e.id.padEnd(10)} base=${base}  target=${e.target}  actual peak=${peak.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);
    if (!dryRun) {
      const patch = {
        sliderEvents: patchedEvents,
        sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
        authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      };
      const after = { ...row, ...patch };
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
