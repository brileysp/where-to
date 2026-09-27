import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Surfing peak-tier review: Bali, Maui, and Lisbon are genuine world-reference
 * waves (Bali's Bukit Peninsula is the definitive tropical surf-culture
 * destination; Maui's Pe'ahi/Jaws anchors big-wave surfing; Lisbon/Nazaré
 * holds the world record for largest wave ever surfed) — surfing had no
 * peak-10 anchor at all before this, unlike every other authored interest.
 * Fiji's Cloudbreak is a genuine WSL-tour reef break, badly underrated at 7 —
 * raised to 9, a notch below the three world-reference waves.
 * Sydney and Rio were tied with/above Fiji purely from generic base+event
 * math, never from an actual claim that their surf rivals Cloudbreak or the
 * anchors — both are solid, accessible city surf, not elite waves; lowered
 * along with their off-season base (same target<base pattern as Lapland).
 * GBR's surf claim was a mechanism artifact — GBR's real fame is diving/reef,
 * not surfing, and it had no business challenging real surf destinations.
 * Dropped to a flat, unremarkable peak.
 */

const EDITS: { id: string; target: number; label?: string; newBase?: number }[] = [
  { id: 'bali', target: 10 },
  { id: 'maui', target: 10 },
  { id: 'lisbon', target: 10 },
  { id: 'fiji', target: 9 },
  { id: 'sydney', target: 7, newBase: 6 },
  { id: 'rio', target: 6, newBase: 5 },
  { id: 'gbr', target: 5 },
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

  const KEY = 'surfing';
  for (const e of EDITS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const originalBase = scoring.base[KEY];
    const base = e.newBase ?? originalBase;
    const existing = scoring.sliderEvents?.[KEY]?.[0];
    if (!existing) { console.error(`${e.id}: no existing surfing event to preserve months/label from`); process.exit(1); }

    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: e.label ?? existing.label, weight, months: existing.months }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = {
      ...scoring,
      sliderEvents: patchedEvents,
      base: { ...scoring.base, [KEY]: base },
    };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${e.id.padEnd(10)} base=${originalBase}${e.newBase ? `->${base}` : ''}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (e.newBase !== undefined) {
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: e.newBase };
    }
    const after = { ...row, ...patch };
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: e.id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
