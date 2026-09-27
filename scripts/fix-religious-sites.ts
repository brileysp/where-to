import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * religiousSites' top tier (Rome/Bhutan/Ethiopia/Bagan anchors, then Nepal/
 * Istanbul/Andalucia/Tokyo-Kyoto/Uzbekistan/Bali) was already well-judged
 * — no mechanism-artifact ties. The two most significant pilgrimage
 * centers on Earth, Mecca and Jerusalem, aren't in the catalog at all —
 * the same shape as the Orlando gap for themeParks, flagged separately
 * rather than worked around here.
 *
 * Found two genuine misses scanning the 114-destination N/A list against
 * real pilgrimage significance: Kerala (Sabarimala Temple — one of the
 * largest annual pilgrimages in the world — plus one of the oldest
 * Christian communities outside the Holy Land) and Taiwan (the Dajia Mazu
 * pilgrimage, one of the largest religious processions on Earth, plus
 * Longshan Temple).
 *
 * Also added real, date-specific pilgrimage-season events (zero existed
 * anywhere) to two destinations with a genuinely fixed calendar driver:
 * Andalucia's Semana Santa (Seville's famous Holy Week processions,
 * March/April) and Ethiopia's Timkat (the Orthodox Epiphany celebration,
 * fixed in January). Ethiopia is an anchor — given a gentle shape since
 * Lalibela's rock-hewn churches remain a genuinely significant, visitable
 * pilgrimage site year-round; Timkat makes January exceptional, it doesn't
 * make the rest of the year bad.
 */

const KEY = 'religiousSites';

const NEW_ADDITIONS: { id: string; target: number; label: string; months: number[]; newBase: number }[] = [
  { id: 'kerala', target: 7, label: 'Sabarimala pilgrimage season', months: [11, 12, 1], newBase: 5 },
  // Lunar New Year (Jan/Feb) is included alongside the Mazu pilgrimage —
  // temples in Taiwan are genuinely busier, not closed, over New Year (a
  // major temple-visiting occasion), which is the opposite of what the
  // generic shopClosures fallback would otherwise apply to those months.
  { id: 'taiwan', target: 6, label: 'Lunar New Year temple visits & Dajia Mazu pilgrimage', months: [1, 2, 3, 4], newBase: 4 },
];

const EVENT_ADDITIONS: { id: string; target: number; label: string; months: number[]; newBase: number }[] = [
  { id: 'andalucia', target: 9, label: 'Semana Santa (Holy Week)', months: [3, 4], newBase: 8 },
  { id: 'ethiopia', target: 10, label: 'Timkat (Epiphany)', months: [1], newBase: 8 },
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

  async function applyEvent(e: { id: string; target: number; label: string; months: number[]; newBase: number }, clearNA: boolean) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    const naSliders: string[] = row.naSliders ?? [];
    if (clearNA && !naSliders.includes(KEY)) { console.error(`${e.id}: expected to be N/A but isn't`); process.exit(1); }
    if (!clearNA && isSliderNA(scoring, KEY)) { console.error(`${e.id}: unexpectedly N/A`); process.exit(1); }
    const nextNA = clearNA ? naSliders.filter((k) => k !== KEY) : naSliders;

    const weight = Math.round((e.target - e.newBase) * 10) / 10;
    const events = [{ label: e.label, weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents, base: { ...scoring.base, [KEY]: e.newBase }, naSliders: nextNA };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const peak = Math.max(...values);

    console.log(`  ${e.id.padEnd(10)} base->${e.newBase}  target=${e.target}  actual peak=${peak.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]${clearNA ? '  (un-N/A)' : ''}`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: e.newBase },
    };
    if (clearNA) patch.naSliders = nextNA;
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

  console.log('New additions:');
  for (const e of NEW_ADDITIONS) await applyEvent(e, true);

  console.log('\nEvent additions to existing destinations:');
  for (const e of EVENT_ADDITIONS) await applyEvent(e, false);

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
