import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

// Whale-watching audit vs Sea Life Guide, 2seewhales.com, WDC, NOAA
// Fisheries, and species-specific research (EDMAKTUB, Falklands
// Conservation, Blue World Institute, Auckland Marine Mammal Ecology
// Group). Score-affecting fixes only here; content-only fixes are in the
// second script (fix-whalewatching-content-only.ts).

type Entry = { base?: number; label: string; weight: number; months: Record<number, number> };

const EVENTS: Record<string, Entry> = {
  // Real pattern is a double-peak (mid-Jan southbound to Baja, spring
  // northbound with mother-calf pairs close to shore) present Dec-May —
  // the old event had this almost entirely backwards (Apr/May + Oct/Nov)
  // and left the real Dec-Jan peak at flat baseline.
  'monterey-big-sur': { label: 'Gray whale double migration (Monterey Bay)', weight: 2, months: { 12: 0.7, 1: 1, 2: 0.5, 3: 0.6, 4: 0.6, 5: 1 } },
  // No credible source supports an actual season here — sightings are
  // documented as rare/incidental (a 2011 Turneffe Atoll sighting is
  // literally called out by name as "a truly rare sighting"). Downgraded
  // to the same flat "incidental" tier as Aruba/Bahamas (base 2, no event)
  // rather than carrying a real event weight for a season that isn't real.
  belize: { base: 2, label: '', weight: 0, months: {} },
  // NOAA/Stellwagen Bank data: peak season is Jun-Sep (98% sighting rate
  // Jul-Sep) — the old event zeroed Jul/Aug as a trough between "spring"
  // and "autumn" peaks, which is backwards.
  'cape-cod-islands': { label: 'Stellwagen Bank whale season', weight: 1, months: { 4: 0.7, 5: 0.9, 6: 1, 7: 1, 8: 1, 9: 1, 10: 0.7 } },
  // Old event (Jun-Aug) contradicted the destination's own overview text,
  // which ties whale sightings to "the wider wildlife season" — Oct-Mar,
  // the actual austral-summer penguin/seabird tourism season. Realigned to
  // that stated season (sei whales genuinely peak within it, Jan-May).
  falklands: { label: 'Whale season alongside the wider (austral summer) wildlife season', weight: 1, months: { 12: 0.5, 1: 0.8, 2: 0.6, 3: 0.4 } },
  // NOAA: real calving season is mid-Nov through mid-April; old event
  // missed both shoulder months.
  'charleston-savannah': { label: 'North Atlantic right whale calving season (no boat tours approach them)', weight: 1, months: { 11: 0.4, 12: 0.6, 1: 1, 2: 1, 3: 0.7, 4: 0.3 } },
  // Real minke season is Apr-Nov, peak Apr-May plus a secondary Jul-Oct
  // bump; old event started in May (missing the real April peak) and
  // included an unsupported Feb bump.
  cornwall: { label: 'Minke whale season off Penzance', weight: 3, months: { 4: 0.5, 5: 0.7, 6: 0.7, 7: 1, 8: 1, 9: 0.7, 10: 0.5, 11: 0.3 } },
  // Real season is Jun-Nov with peak often cited Aug-Oct/Nov; old event
  // cut off at Aug, underweighting the real Sep-Oct peak.
  rio: { label: 'Humpback whale season near the Cagarras Islands', weight: 3, months: { 6: 0.6, 7: 1, 8: 1, 9: 0.8, 10: 0.6 } },
  // Real open-water season is May-Sep; old event started in June, missing May.
  svalbard: { label: 'Walrus, whales & seabird cliffs (open-water season)', weight: 2.5, months: { 5: 0.4, 6: 0.6, 7: 1, 8: 1, 9: 0.6 } },
  // Real migration is broader than the old event: northbound peak Jun-Jul,
  // southbound peak Sep-Oct — old event omitted Jul (northbound tail) and
  // Sep (the actual peak of the southbound leg).
  tasmania: { label: 'Whale season', weight: 3, months: { 5: 0.3, 6: 0.6, 7: 0.4, 9: 0.5, 10: 0.7, 11: 0.3 } },
  // Sources give the real season as Oct/Nov-Apr/May with "best chance
  // Jan-Apr" explicitly naming April — old event excluded April entirely
  // while giving November (more of a shoulder) full weight, backwards.
  'tierra-del-fuego': { label: 'Austral summer whale season', weight: 4, months: { 12: 1, 1: 1, 2: 1, 3: 1, 4: 0.6, 11: 0.5 } },
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

  for (const id of Object.keys(EVENTS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const entry = EVENTS[id];
    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const isBelize = id === 'belize';
    const patchedScoring = {
      ...scoring,
      base: entry.base !== undefined ? { ...(scoring.base ?? {}), [KEY]: entry.base } : scoring.base,
      sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: isBelize ? [] : [{ label: entry.label, weight: entry.weight, months: entry.months }] },
    };
    const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`${id}`);
    console.log(`  before: [${before.map((v: number) => v.toFixed(0)).join(',')}]`);
    console.log(`  after:  [${after.map((v: number) => v.toFixed(0)).join(',')}]`);

    const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: isBelize ? [] : [{ label: entry.label, weight: entry.weight, months: entry.months }] },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (entry.base !== undefined) {
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: entry.base };
    }

    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
