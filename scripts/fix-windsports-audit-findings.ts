import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'windSports';

// windSports audit vs Wind-Hounds.com / Continentseven.

type Entry = { label: string; weight: number; months: Record<number, number> };

const EVENTS: Record<string, Entry> = {
  // Real wind (17-28kt trades) is equally strong Jan-Sep; the event only
  // covered May-Sep, leaving Jan-Apr flat despite the overview itself
  // saying "never a dead month here."
  aruba: { label: "Fisherman's Huts trade winds (Hi-Winds season)", weight: 3, months: { 1: 0.7, 2: 0.7, 3: 0.8, 4: 0.8, 5: 0.6, 6: 0.9, 7: 1, 8: 0.9, 9: 0.6 } },
  // Overview explicitly says "June through November"; event gave zero to
  // Oct/Nov, an internal contradiction.
  mauritius: { label: 'Le Morne trade-wind season', weight: 3, months: { 5: 0.7, 6: 0.9, 7: 1, 8: 1, 9: 0.7, 10: 0.5, 11: 0.3 } },
  // Overview claims "essentially year-round, 300 days/year"; event gave
  // zero to 5 of 12 months. Lo Stagnone is documented as one of the few
  // European spots with real winter wind too, and a March start.
  sicily: { label: 'Lo Stagnone thermal & winter-wind season', weight: 3, months: { 1: 0.3, 2: 0.3, 3: 0.4, 4: 0.6, 5: 0.8, 6: 0.9, 7: 1, 8: 1, 9: 0.8, 10: 0.5, 11: 0.3, 12: 0.3 } },
  // Overview says "roughly 10 months" reliable; event covered only 7,
  // giving zero to June despite sources confirming wind through late June.
  'turks-caicos': { label: 'Long Bay reliable trade-wind season', weight: 2, months: { 1: 0.8, 2: 0.9, 3: 1, 4: 1, 5: 0.9, 6: 0.6, 11: 0.4, 12: 0.6 } },
  // Feb/Mar sat at flat baseline despite being inside the same Atlantic
  // winter-storm season that gives Jan/Nov/Dec their peak — an authoring
  // gap, not a real seasonal difference.
  cornwall: { label: 'Watergate Bay Atlantic storm season (summer notably lighter)', weight: 3, months: { 1: 0.7, 2: 0.5, 3: 0.3, 5: 0.4, 6: 0.3, 9: 0.6, 10: 0.8, 11: 1, 12: 0.9 } },
  // Nov sat at zero, sandwiched between Oct(0.5) and Dec(0.7) despite being
  // inside the stated "comfort peaks Dec-Apr" winter season.
  dubai: { label: 'Kite Beach wind season (comfort peaks Dec-Apr)', weight: 3, months: { 1: 1, 2: 1, 3: 0.8, 4: 0.6, 6: 0.3, 7: 0.3, 8: 0.3, 9: 0.4, 10: 0.5, 11: 0.6, 12: 0.7 } },
  // Consensus (boat operators, kite schools) describes the season running
  // through October; event stopped at Aug.
  gbr: { label: 'Whitsundays trade-wind season', weight: 3, months: { 3: 0.6, 4: 0.9, 5: 1, 6: 1, 7: 0.8, 8: 0.6, 9: 0.4, 10: 0.3 } },
  // Real season is May-Oct (peak Jul/Aug); event started Jun and omitted
  // the May/Oct shoulders.
  lisbon: { label: 'Guincho "nortada" summer wind', weight: 3, months: { 5: 0.4, 6: 0.6, 7: 0.9, 8: 1, 9: 0.7, 10: 0.4 } },
  // Overview says "late October" start; event had zero weight in October.
  'los-cabos': { label: 'La Ventana "El Norte" season', weight: 4, months: { 1: 1, 2: 1, 3: 1, 4: 0.8, 5: 0.5, 10: 0.4, 11: 0.6, 12: 0.9 } },
  // Overview says May start; event started Jun. Sources also show Sep-Nov
  // still carries decent (15-20kt) wind, unlike the event's hard Sep cutoff.
  madagascar: { label: 'Ifaty trade-wind season', weight: 3, months: { 5: 0.5, 6: 0.7, 7: 0.9, 8: 1, 9: 0.7, 10: 0.4, 11: 0.3 } },
  // One source calls April "the ideal season," and the Embat commonly runs
  // to October; event omitted both shoulder months.
  mallorca: { label: 'Pollença Bay "Embat" thermal-wind season', weight: 2, months: { 4: 0.4, 5: 0.6, 6: 0.8, 7: 1, 8: 1, 9: 0.7, 10: 0.4 } },
  // Season commonly cited as Sept/Oct-April; event omitted Sep/Oct
  // entirely, starting at Nov.
  namibia: { label: 'Walvis Bay Lagoon wind season', weight: 4, months: { 1: 1, 2: 1, 3: 0.9, 4: 0.6, 9: 0.4, 10: 0.5, 11: 0.6, 12: 0.9 } },
  // Sources say rideable from September; event/overview both started Oct.
  sydney: { label: "Kurnell nor'easter season", weight: 2, months: { 1: 1, 2: 0.9, 3: 0.6, 9: 0.4, 10: 0.5, 11: 0.7, 12: 0.9 } },
  // Overview says summer wind is "lighter... but genuinely rideable," but
  // event gave flat zero to all 6 summer months — an internal
  // inconsistency the score didn't reflect.
  vietnam: { label: 'Mui Ne winter wind season', weight: 3, months: { 1: 1, 2: 1, 3: 0.9, 4: 0.5, 6: 0.3, 7: 0.3, 8: 0.3, 11: 0.6, 12: 0.8 } },
  // Overview describes a documented stronger fall storm-wind season vs a
  // weaker summer, but the score was flat 3 all year (aside from the
  // existing Jan/Feb cold penalty) — never modeled. New event preserves
  // the Jan/Feb cold penalty explicitly (the swim formula doesn't
  // auto-reapply cold once an event exists, only wet does) and adds the
  // real Sep-Dec storm peak.
  'nova-scotia': { label: 'Lawrencetown Beach fall storm-wind season', weight: 1, months: { 1: -5, 2: -5, 9: 1.5, 10: 2.5, 11: 3, 12: 1.5 } },
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
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [entry] } };
    const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`${id}`);
    console.log(`  before: [${before ? before.map((v: number) => v.toFixed(0)).join(',') : 'NA'}]`);
    console.log(`  after:  [${after.map((v: number) => v.toFixed(0)).join(',')}]`);

    const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [entry] },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };

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
