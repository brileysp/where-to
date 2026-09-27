import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * spectatorSports and themeParks both had empty anchor lists and — like
 * kayakingRafting — zero real authored events anywhere, just generic
 * base-by-city-prominence math (plus 15 and 14 spurious "authored" flags
 * respectively, with nothing behind them; cleared alongside this).
 *
 * spectatorSports: most marquee sporting events (World Cup, Olympics, Super
 * Bowl) rotate host cities, so there are few genuinely fixed, single-
 * location "world sporting occasion" candidates in this catalog. The real
 * ones: Wimbledon (London, late Jun–early Jul — the single most iconic
 * recurring spectator event tied to one immovable location) and the US
 * Open Tennis (NYC, late Aug–early Sept). St Andrews & Fife was tied near
 * the top despite its real draw being PLAYING the Old Course (a golf
 * pilgrimage, already captured by the separate golf slider) — The Open
 * Championship only visits roughly once every five years, so it isn't a
 * fixed annual "occasion" the way Wimbledon or the US Open are. Corrected
 * down to a flat, modest score.
 *
 * themeParks: the 'luxury' formula case has no sliderEvents branch at all
 * (theme parks aren't calendar-event-driven the way a fishery or a sports
 * tournament is), so this is a base-only correction, not a real event.
 * Orlando — the actual world-reference theme park destination — isn't in
 * the catalog, so no anchor is being added; Dubai was tied with Tokyo and
 * Paris at the top, but Dubai's parks (IMG Worlds, Dubai Parks & Resorts)
 * don't carry the same iconic global reputation as Tokyo Disney Resort
 * (the world's #2 most-visited park, critically beloved) or Disneyland
 * Paris — lowered to a clear notch below.
 */

const KEY_SPECTATOR = 'spectatorSports';
const KEY_THEME = 'themeParks';

const SPECTATOR_EVENTS: { id: string; target: number; label: string; months: number[] }[] = [
  { id: 'london', target: 10, label: 'Wimbledon Fortnight', months: [6, 7] },
  { id: 'nyc', target: 9, label: 'US Open Tennis', months: [8, 9] },
];
const SPECTATOR_BASE_ONLY: { id: string; target: number }[] = [
  { id: 'st-andrews-fife', target: 5 },
];
const THEME_BASE_ONLY: { id: string; target: number }[] = [
  { id: 'dubai', target: 6 },
];

const SPURIOUS_AUTHORED_KEYS: ('spectatorSports' | 'themeParks')[] = ['spectatorSports', 'themeParks'];

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

  // --- Cleanup: spurious "authored" flags with no real content behind them.
  // Unconditional — the authoring step below re-adds the flag correctly for
  // whichever destination/key pairs actually get real content this run. ---
  const allRows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  let cleared = 0;
  for (const row of allRows) {
    const authored: string[] = row.authoredCurves ?? [];
    const toDrop = SPURIOUS_AUTHORED_KEYS.filter((k) => authored.includes(k));
    if (!toDrop.length) continue;
    const next = authored.filter((k) => !toDrop.includes(k as never));
    console.log(`  clear ${row.id.padEnd(18)} ${toDrop.join(', ')}`);
    if (!dryRun) {
      const after = { ...row, authoredCurves: next };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ authoredCurves: next, updatedAt: new Date() }).where(eq(places.id, row.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: row.id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
    cleared++;
  }
  console.log(`${cleared} spurious authored flags cleared.\n`);

  async function applyEdit(id: string, key: string, target: number, event: { label: string; months: number[] } | null) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, key)) { console.error(`${id}: ${key} is N/A`); process.exit(1); }
    const originalBase = scoring.base[key];
    const base = event ? originalBase : target; // base-only edits just set base directly to target
    const weight = event ? Math.round((target - originalBase) * 10) / 10 : 0;

    const events = event ? [{ label: event.label, weight, months: Object.fromEntries(event.months.map((m) => [m, 1])) }] : undefined;
    const patchedEvents = events ? { ...(scoring.sliderEvents ?? {}), [key]: events } : scoring.sliderEvents;
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents, base: { ...scoring.base, [key]: base } };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[key];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${id.padEnd(18)} ${key.padEnd(16)} base=${originalBase}${base !== originalBase ? `->${base}` : ''}  target=${target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [key]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), key])),
      baseScores: { ...(row.baseScores as Record<string, unknown>), [key]: base },
    };
    if (patchedEvents) patch.sliderEvents = patchedEvents;
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

  console.log('spectatorSports:');
  for (const e of SPECTATOR_EVENTS) await applyEdit(e.id, KEY_SPECTATOR, e.target, { label: e.label, months: e.months });
  for (const e of SPECTATOR_BASE_ONLY) await applyEdit(e.id, KEY_SPECTATOR, e.target, null);

  console.log('\nthemeParks:');
  for (const e of THEME_BASE_ONLY) await applyEdit(e.id, KEY_THEME, e.target, null);

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
