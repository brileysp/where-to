import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Found auditing whaleWatching's NA list: 29 coastal destinations were
 * marked NA despite having real, researchable whale presence and (in
 * many cases) real commercial tour operators. Researched each via
 * parallel web search (species present, named tour operators, season,
 * tourism maturity) before scoring — per the user's framework, "are
 * there regular tours, how many companies, when do they run" — not
 * NA'd just because a place touches saltwater, but not scored high
 * just because a whale has ever passed by either.
 *
 * Three tiers:
 * - Essentially no tourism (0-1 operators, purely incidental/research
 *   sightings): low flat base, no event — real presence, no season to
 *   claim.
 * - Real but small-scale (a handful of named operators, a genuine but
 *   modest season): modest base + modest event.
 * - Established multi-operator industries: higher base + a real event
 *   matching the actual season found.
 */

const KEY = 'whaleWatching';

type Fix = { base: number; events?: Array<{ label: string; weight: number; months: Record<number, number> }> };

const FIXES: Record<string, Fix> = {
  // --- Essentially no commercial tourism: flat, low, honest ---
  bahamas: { base: 2 },
  jamaica: { base: 1 },
  palau: { base: 2 },
  'papua-new-guinea': { base: 2 },
  'colombian-caribbean': { base: 1 },
  'st-andrews-fife': { base: 1 },
  hongkong: { base: 1 },
  mallorca: { base: 2 },
  'milford-sound-fiordland': { base: 2 },
  aruba: { base: 2 },
  // Bali carries a wildlifePeakMonths flag (Apr-Oct) set for general
  // wildlife/dry-season conditions — with no whaleWatching-specific
  // event, the shared 'wildlife' formula's generic fallback leaks that
  // same flag into a false +3 whale "season," contradicting the
  // research finding (Lovina's boats are dolphin tours; no credible
  // regular whale presence). A weight-0 placeholder event forces the
  // formula down the events branch instead, suppressing the leak and
  // keeping this genuinely flat.
  bali: { base: 2, events: [{ label: 'No dedicated whale season (Lovina\'s boat tours are dolphin-focused)', weight: 0, months: {} }] },

  // --- Real but small-scale / niche ---
  'charleston-savannah': {
    base: 2,
    events: [{ label: 'North Atlantic right whale calving season (no boat tours approach them)', weight: 1, months: { 12: 0.5, 1: 1, 2: 1, 3: 0.7 } }],
  },
  barbados: {
    base: 3,
    events: [{ label: 'Humpback migration, visible from the North Point cliffs', weight: 2, months: { 12: 0.5, 1: 0.8, 2: 1, 3: 0.8, 4: 0.4 } }],
  },
  fiji: {
    base: 3,
    events: [{ label: 'Humpback whale migration season', weight: 2, months: { 6: 0.5, 7: 0.8, 8: 1, 9: 1, 10: 0.5 } }],
  },
  'nice-riviera': {
    base: 3,
    events: [{ label: 'Pelagos Sanctuary whale season', weight: 2, months: { 5: 0.6, 6: 0.8, 7: 1, 8: 1, 9: 0.6 } }],
  },
  'falklands': {
    base: 3,
    events: [{ label: 'Whale season alongside the wider wildlife season', weight: 1, months: { 6: 0.6, 7: 1, 8: 0.8 } }],
  },
  seychelles: {
    base: 3,
    events: [{ label: 'Humpback whale season around the Outer Islands', weight: 2, months: { 8: 0.4, 9: 0.6, 10: 1, 11: 0.7 } }],
  },

  // --- Real, established, multi-operator ---
  'basque-country': {
    base: 4,
    events: [{ label: 'Bay of Biscay whale season', weight: 3, months: { 4: 0.4, 5: 0.6, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.7 } }],
  },
  namibia: {
    base: 4,
    events: [{ label: 'Humpback and southern right whale season off Walvis Bay', weight: 3, months: { 6: 0.5, 7: 0.8, 8: 1, 9: 1, 10: 0.8, 11: 0.5 } }],
  },
  cornwall: {
    base: 4,
    events: [{ label: 'Minke whale season off Penzance', weight: 3, months: { 2: 0.3, 5: 0.5, 6: 0.7, 7: 1, 8: 1, 9: 0.7, 10: 0.5, 11: 0.3 } }],
  },
  'puerto-rico': {
    base: 4,
    events: [{ label: 'Humpback whale breeding season off Rincón', weight: 3, months: { 1: 0.7, 2: 1, 3: 1 } }],
  },
  nyc: {
    base: 4,
    events: [{ label: 'Humpback whale feeding season in the New York Bight', weight: 3, months: { 5: 0.4, 6: 0.6, 7: 0.8, 8: 1, 9: 1, 10: 0.8, 11: 0.5, 12: 0.3 } }],
  },
  'scottish-highlands-skye': {
    base: 5,
    events: [{ label: 'Minke whale season off the Hebrides', weight: 2, months: { 5: 0.5, 6: 1, 7: 1, 8: 0.7, 9: 0.5, 10: 0.3 } }],
  },
  'turks-caicos': {
    base: 5,
    events: [{ label: 'Humpback breeding season off Salt Cay', weight: 3, months: { 1: 0.7, 2: 1, 3: 1, 4: 0.4 } }],
  },
  sardinia: {
    base: 5,
    events: [{ label: 'Whale season at Caprera Canyon', weight: 2, months: { 4: 0.5, 5: 0.7, 6: 0.8, 7: 1, 8: 1, 9: 0.7, 10: 0.5 } }],
  },
  algarve: {
    base: 5,
    events: [{ label: 'Fin and humpback whale migration', weight: 3, months: { 3: 1, 4: 1, 5: 0.7 } }],
  },

  // --- Major, established ---
  borabora: {
    base: 6,
    events: [{ label: 'Humpback whale season', weight: 2, months: { 7: 0.3, 8: 0.7, 9: 1, 10: 1, 11: 0.5 } }],
  },
  andalucia: {
    base: 7,
    events: [{ label: 'Orca season hunting migrating tuna in the Strait of Gibraltar', weight: 2, months: { 4: 0.4, 5: 0.5, 6: 0.6, 7: 1, 8: 1, 9: 1, 10: 0.5 } }],
  },
  sydney: {
    base: 8,
    events: [{ label: 'Humpback whale migration past Sydney Heads', weight: 2, months: { 5: 0.6, 6: 1, 7: 1, 8: 0.7, 9: 0.7, 10: 1, 11: 0.6 } }],
  },
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

  for (const [id, fix] of Object.entries(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: NOT FOUND`); process.exit(1); }
    const currentNA = (row.naSliders as string[]) ?? [];
    if (!currentNA.includes(KEY)) { console.error(`${id}: whaleWatching wasn't in naSliders — unexpected, check manually`); process.exit(1); }
    const newNA = currentNA.filter((k) => k !== KEY);
    const newBase = { ...(row.baseScores as Record<string, number>), [KEY]: fix.base };

    const patchedRow = { ...row, naSliders: newNA, baseScores: newBase, sliderEvents: fix.events ? { ...(row.sliderEvents as Record<string, unknown>), [KEY]: fix.events } : row.sliderEvents };
    const scoring = toScoringPlace(patchedRow);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });

    console.log(`  ${id.padEnd(24)} base=${fix.base}  peak=${Math.max(...monthly[KEY]).toFixed(1)}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      naSliders: newNA,
      baseScores: newBase,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (fix.events) {
      patch.sliderEvents = { ...(row.sliderEvents as Record<string, unknown>), [KEY]: fix.events };
    }

    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
