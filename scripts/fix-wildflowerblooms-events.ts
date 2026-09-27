import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildflowerBlooms';

// Phase 1 of the wildflowerBlooms sweep: score/event changes only (no
// content yet). Two categories:
//  - NEW: places currently NA for wildflowerBlooms, getting a base score +
//    event for the first time (real, verified bloom facts — see chat).
//  - FIX: places already non-NA whose existing event was wrong (Ladakh: the
//    real event is the April Apricot Blossom Festival, not a generic
//    Jun-Aug placeholder; Cape Town: the real event is the Namaqualand
//    daisy carpet, narrowed from an even Jul-Oct spread that was actually
//    describing fynbos/protea, which blooms on a much looser calendar).
// All peaks pre-verified via the real scoring pipeline before writing here.

type Entry = { base?: number; label: string; weight: number; months: Record<number, number> };

const NEW: Record<string, Entry> = {
  mallorca: { base: 2, label: 'Almond blossom', weight: 4, months: { 1: 0.5, 2: 1 } },
  'douro-valley-porto': { base: 2, label: 'Almond blossom (Douro Valley)', weight: 4, months: { 2: 0.7, 3: 1 } },
  nepal: { base: 3, label: 'Rhododendron bloom (Lali Gurans)', weight: 6, months: { 3: 0.6, 4: 1 } },
  bhutan: { base: 3, label: 'Rhododendron bloom', weight: 5, months: { 4: 1, 5: 0.6 } },
  istanbul: { base: 3, label: 'Istanbul Tulip Festival', weight: 6, months: { 4: 1 } },
  seoul: { base: 2, label: 'Cherry blossom (Yeouido)', weight: 7, months: { 4: 1 } },
  ethiopia: { base: 3, label: 'Meskel daisy bloom', weight: 3, months: { 9: 1 } },
  atacama: { base: 1, label: 'Desierto Florido (irregular)', weight: 3, months: { 8: 0.3, 9: 0.6, 10: 1 } },
  iceland: { label: 'Nootka lupine bloom', weight: 4, months: { 5: 0.3, 6: 1, 7: 1, 8: 0.3 } },
  // UK/NZ additions verified earlier this session (previously flat, base-only)
  'scottish-highlands-skye': { label: 'Heather bloom', weight: 4, months: { 8: 1, 9: 0.6 } },
  'lake-district': { label: 'Daffodil season (Ullswater)', weight: 4, months: { 2: 0.4, 3: 0.8, 4: 1 } },
  cotswolds: { label: 'Bluebell woods', weight: 3, months: { 4: 0.8, 5: 1 } },
  'north-island': { label: 'Pōhutukawa bloom', weight: 4, months: { 12: 1, 1: 0.7 } },
};

const FIX: Record<string, Entry> = {
  ladakh: { label: 'Apricot blossom (Nubra & Sham valleys)', weight: 5, months: { 4: 1, 5: 0.3 } },
  'cape-town': { label: 'Namaqualand daisy bloom', weight: 4, months: { 7: 0.15, 8: 1, 9: 0.7 } },
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

  const allIds = [...Object.keys(NEW), ...Object.keys(FIX)];
  const rows = await db.select().from(places).where(inArray(places.id, allIds));

  for (const id of allIds) {
    const row = rows.find((r) => r.id === id);
    if (!row) { console.error(`${id}: NOT FOUND`); process.exit(1); }
    const isNew = id in NEW;
    const entry = isNew ? NEW[id] : FIX[id];
    const scoring = toScoringPlace(row);

    const patchedScoring = {
      ...scoring,
      naSliders: (scoring.naSliders ?? []).filter((s: string) => s !== KEY),
      base: entry.base !== undefined ? { ...(scoring.base ?? {}), [KEY]: entry.base } : scoring.base,
      sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [{ label: entry.label, weight: entry.weight, months: entry.months }] },
    };
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`${id} (${isNew ? 'NEW' : 'FIX'})`);
    console.log(`  before: [${before ? before.map((v: number) => v.toFixed(0)).join(',') : 'NA'}]`);
    console.log(`  after:  [${after.map((v: number) => v.toFixed(0)).join(',')}]  peak=${Math.max(...after)}`);

    const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });

    const patch: Record<string, unknown> = {
      naSliders: (row.naSliders ?? []).filter((s: string) => s !== KEY),
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [{ label: entry.label, weight: entry.weight, months: entry.months }] },
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
