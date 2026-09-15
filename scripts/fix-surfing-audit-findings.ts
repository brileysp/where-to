import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'surfing';

// Fixes found by cross-checking our surfing content against Surfline
// (and equivalents) for every destination with a real named-break event.
// Barbados and Sydney's real-world shoulder-season nuances were also
// checked but produced zero net score change once rounded, so left as-is.

type Entry = { base?: number; label: string; weight: number; months: Record<number, number> };

const EVENTS: Record<string, Entry> = {
  // Real peak consistency is Mar-May (up to 99%), broader south-swell
  // season runs May-Oct/Nov — our old Jun-Oct window skipped the
  // strongest months and started a month late.
  'los-cabos': { label: 'Pacific south swell (Costa Azul)', weight: 1, months: { 3: 0.6, 4: 1, 5: 1, 6: 0.8, 7: 0.8, 8: 0.8, 9: 0.8, 10: 0.8, 11: 0.4 } },
  // Real typhoon season/low season split: May-Jul is explicitly the low
  // season, Sep-Nov is the standout stretch, not Jun-Sep as coded.
  okinawa: { label: 'Typhoon-season groundswell', weight: 2, months: { 7: 0.5, 8: 0.8, 9: 1, 10: 1, 11: 0.5 } },
  // Barra da Tijuca's individually-best month is March, outside our old
  // Apr-Aug window.
  rio: { label: 'South Atlantic winter storm swell', weight: 1, months: { 3: 0.4, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 0.4 } },
  // Oaxaca was fully NA for surfing despite Zicatela (Puerto Escondido) —
  // a real World Surfing Reserve, "Mexican Pipeline" — being ~3hrs/195km
  // from Oaxaca City on the coastal highway completed 2024. Real peak
  // season May-Sep on the south swell.
  oaxaca: { base: 6, label: 'South swell season (Zicatela)', weight: 2, months: { 5: 0.6, 6: 0.8, 7: 1, 8: 1, 9: 0.6 } },
};

const OVERVIEWS: Record<string, string> = {
  oaxaca: 'Zicatela, nicknamed the "Mexican Pipeline," is one of the world\'s heaviest, most powerful beach breaks — a real World Surfing Reserve and a serious, advanced-only wave, not a beginner destination. It\'s on the Oaxaca coast, about a 3-hour drive from Oaxaca City on the coastal highway completed in 2024.',
  'cape-town': 'Muizenberg is the easy, beginner-friendly win — gentle, sandy-bottomed waves right in the city. Jeffreys Bay, one of the world\'s best right-hand point breaks, is a genuinely separate trip — about a 7-hour drive east along the coast, not a day trip from Cape Town — best in the region\'s cooler winter months.',
};

const MONTHLY: Record<string, string[]> = {
  'los-cabos': [
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
    "Costa Azul's groundswell turning more consistent, ahead of hurricane season proper.",
    'Hurricane-season south swell — the more consistent window for Costa Azul, with April-May typically the most reliable groundswell.',
    'Hurricane-season south swell — the more consistent window for Costa Azul, with April-May typically the most reliable groundswell.',
    'Hurricane-season south swell — the more consistent window for Costa Azul.',
    'Hurricane-season south swell — the more consistent window for Costa Azul.',
    'Hurricane-season south swell — the more consistent window for Costa Azul.',
    'Hurricane-season south swell — the more consistent window for Costa Azul.',
    'Hurricane-season south swell — the more consistent window for Costa Azul.',
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
  ],
  okinawa: [
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
    "The quietest stretch of the year for swell — real typhoon season hasn't arrived yet.",
    "The quietest stretch of the year for swell — real typhoon season hasn't arrived yet.",
    'Typhoon season beginning to build — bigger swell arriving, though not yet at its most reliable.',
    'Typhoon season sends real groundswell to the reefs — the best waves of the year, with real storm-disruption risk alongside them.',
    'Typhoon season sends real groundswell to the reefs — the best waves of the year, with real storm-disruption risk alongside them.',
    'Typhoon season sends real groundswell to the reefs — the best waves of the year, with real storm-disruption risk alongside them.',
    'Typhoon season fading, still bringing solid swell some years.',
    'Baseline conditions — modest, inconsistent surf.',
  ],
  rio: [
    'Summer — the calmest, smallest, least consistent stretch of the year.',
    'Summer — the calmest, smallest, least consistent stretch of the year.',
    "Barra da Tijuca's individually-best month, even as Arpoador is still building toward its own winter peak.",
    'Winter south swell — the more consistent season.',
    'Winter south swell — the more consistent season.',
    'Winter south swell — the more consistent season.',
    'Winter south swell — the more consistent season.',
    'Winter south swell — the more consistent season.',
    'Conditions ease as summer approaches.',
    'Conditions ease as summer approaches.',
    'Conditions ease as summer approaches.',
    'Summer — the calmest, smallest, least consistent stretch of the year.',
  ],
  oaxaca: [
    'Outside the main south-swell season — Zicatela stays heavy and powerful, but less consistent.',
    'Outside the main south-swell season — Zicatela stays heavy and powerful, but less consistent.',
    'Outside the main south-swell season — Zicatela stays heavy and powerful, but less consistent.',
    'Outside the main south-swell season — Zicatela stays heavy and powerful, but less consistent.',
    'South-swell season beginning, building toward peak.',
    'Peak season at Zicatela — some of the most powerful, consistent surf in the world, for experienced surfers only.',
    'Peak season at Zicatela — some of the most powerful, consistent surf in the world, for experienced surfers only.',
    'Peak season at Zicatela — some of the most powerful, consistent surf in the world, for experienced surfers only.',
    'South-swell season fading, still good.',
    'Outside the main south-swell season.',
    'Outside the main south-swell season.',
    'Outside the main south-swell season.',
  ],
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

  // Score-affecting fixes (los-cabos, okinawa, rio, oaxaca)
  for (const id of Object.keys(EVENTS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const entry = EVENTS[id];
    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const patchedScoring = {
      ...scoring,
      naSliders: (scoring.naSliders ?? []).filter((s: string) => s !== KEY),
      base: entry.base !== undefined ? { ...(scoring.base ?? {}), [KEY]: entry.base } : scoring.base,
      sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [{ label: entry.label, weight: entry.weight, months: entry.months }] },
    };
    const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`${id}`);
    console.log(`  before: [${before ? before.map((v: number) => v.toFixed(0)).join(',') : 'NA'}]`);
    console.log(`  after:  [${after.map((v: number) => v.toFixed(0)).join(',')}]`);

    const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      naSliders: (row.naSliders ?? []).filter((s: string) => s !== KEY),
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [{ label: entry.label, weight: entry.weight, months: entry.months }] },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      sliderOverview: OVERVIEWS[id] ? { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] } : row.sliderOverview,
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: MONTHLY[id] },
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

  // Content-only fix (cape-town — no score change, just honest distance framing)
  {
    const id = 'cape-town';
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
    };
    console.log(`\n${id} (content-only)`);
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
