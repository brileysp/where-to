import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * 18 destinations where recreational/sport fishing is a genuine, specific
 * travel draw (not just "fish technically live here") that the original
 * 35-destination fishing pass missed entirely — found by auditing the
 * post-bugfix baseline against real fishing-tourism reputation, not just
 * whatever generic base score each destination happened to already have.
 */

const EDITS: { id: string; target: number; label: string; months: number[] }[] = [
  { id: 'turks-caicos', target: 9, label: 'Dry-season bonefish flats', months: [12, 1, 2, 3, 4] },
  { id: 'gbr', target: 9, label: 'Cairns black marlin season', months: [9, 10, 11, 12] },
  { id: 'vancouver-island', target: 9, label: 'Pacific salmon run (Tofino/Campbell River)', months: [7, 8, 9, 10] },
  { id: 'tierra-del-fuego', target: 9, label: 'Sea-run brown trout season (Río Grande)', months: [11, 12, 1, 2, 3, 4] },
  { id: 'nova-scotia', target: 9, label: 'Giant bluefin tuna season', months: [8, 9, 10] },
  { id: 'cape-cod-islands', target: 8, label: 'Striped bass run', months: [5, 6, 9, 10] },
  { id: 'guatemala', target: 9, label: 'Pacific sailfish season', months: [11, 12, 1, 2, 3, 4] },
  { id: 'puerto-rico', target: 8, label: 'Blue marlin season', months: [7, 8, 9] },
  { id: 'azores', target: 8, label: 'Blue marlin season', months: [7, 8, 9] },
  { id: 'new-orleans', target: 8, label: 'Marsh redfish & Venice tuna season', months: [9, 10, 11] },
  { id: 'madeira', target: 7, label: 'Blue marlin season', months: [6, 7, 8, 9] },
  { id: 'zambia', target: 7, label: 'Zambezi tigerfish season', months: [8, 9, 10, 11] },
  { id: 'zimbabwe', target: 7, label: 'Zambezi tigerfish season', months: [8, 9, 10, 11] },
  { id: 'scottish-highlands-skye', target: 7, label: 'Salmon season (Spey/Tay, legally regulated)', months: [3, 4, 5, 9, 10] },
  { id: 'falklands', target: 7, label: 'Sea-run brown trout season', months: [11, 12, 1, 2, 3] },
  { id: 'charleston-savannah', target: 7, label: 'Redfish flats season', months: [9, 10, 11] },
  { id: 'mongolia', target: 7, label: 'Taimen fly-fishing season', months: [6, 7, 8, 9] },
  { id: 'ireland', target: 6, label: 'Salmon & trout season (legally regulated)', months: [3, 4, 5, 6] },
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

  const KEY = 'fishing';
  for (const e of EDITS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const base = scoring.base[KEY];

    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: e.label, weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${e.id.padEnd(24)} base=${base}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
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
