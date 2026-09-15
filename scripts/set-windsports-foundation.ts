import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * windSports (windsurfing & kitesurfing) is a brand-new slider — 0 of 200
 * places have baseScores, naSliders, or content for it. Unlike every other
 * interest authored this session, there is no existing score to build
 * content on top of, so this script builds the scoring foundation first:
 * NA determination for every place, plus base score + sliderEvents for the
 * real candidates. Every candidate below is backed by a real, verified
 * fact (a named spot, a competition, a documented wind season) — see the
 * plan for full research notes. Everything not listed here gets NA.
 */

const KEY = 'windSports';

type Event = { label: string; weight: number; months: Record<number, number> };
type Candidate = { base: number; event?: Event };

const CANDIDATES: Record<string, Candidate> = {
  // ---- Anchor tier: world-reference wind-sports coastlines ----
  maui: { base: 7, event: { label: 'Ho\'okipa trade-wind season', weight: 3, months: { 5: 0.7, 6: 0.9, 7: 1, 8: 1, 9: 0.8 } } },
  aruba: { base: 7, event: { label: 'Fisherman\'s Huts trade winds (Hi-Winds season)', weight: 3, months: { 5: 0.6, 6: 0.9, 7: 1, 8: 0.9, 9: 0.6 } } },
  mauritius: { base: 7, event: { label: 'Le Morne trade-wind season', weight: 3, months: { 5: 0.7, 6: 0.9, 7: 1, 8: 1, 9: 0.7 } } },
  'cape-town': { base: 6, event: { label: 'Cape Doctor season (King of the Air)', weight: 4, months: { 9: 0.5, 10: 0.6, 11: 0.8, 12: 1, 1: 1, 2: 1, 3: 0.8, 4: 0.5 } } },
  morocco: { base: 6, event: { label: 'Essaouira Alizée trade winds', weight: 4, months: { 4: 0.5, 5: 0.7, 6: 0.8, 7: 1, 8: 1, 9: 1, 10: 0.6 } } },
  canaries: { base: 6, event: { label: 'Sotavento trade-wind season (PWA World Cup)', weight: 4, months: { 4: 0.6, 5: 0.8, 6: 0.9, 7: 1, 8: 1, 9: 0.8, 10: 0.5 } } },
  andalucia: { base: 8, event: { label: 'Tarifa Levante/Poniente season', weight: 2, months: { 5: 0.6, 6: 0.8, 7: 1, 8: 1, 9: 0.7, 10: 0.4 } } },

  // ---- Strong tier ----
  oaxaca: { base: 5, event: { label: 'Tehuantepecer wind season', weight: 4, months: { 10: 0.5, 11: 0.8, 12: 1, 1: 1, 2: 1, 3: 0.8, 4: 0.5 } } },
  sicily: { base: 6, event: { label: 'Lo Stagnone thermal-wind season', weight: 3, months: { 4: 0.6, 5: 0.8, 6: 0.9, 7: 1, 8: 1, 9: 0.8, 10: 0.5 } } },
  sardinia: { base: 6, event: { label: 'Porto Pollo Maestrale season', weight: 3, months: { 4: 0.5, 5: 0.7, 6: 0.8, 7: 1, 8: 1, 9: 1, 10: 0.6, 11: 0.4 } } },
  'costa-rica': { base: 5, event: { label: 'Lake Arenal dry-season wind', weight: 4, months: { 12: 0.8, 1: 1, 2: 1, 3: 1, 4: 0.7 } } },
  'los-cabos': { base: 5, event: { label: 'La Ventana "El Norte" season', weight: 4, months: { 11: 0.6, 12: 0.9, 1: 1, 2: 1, 3: 1, 4: 0.8, 5: 0.5 } } },
  egypt: { base: 5, event: { label: 'Red Sea thermal-wind season', weight: 4, months: { 4: 0.5, 5: 0.7, 6: 0.8, 7: 0.9, 8: 0.9, 9: 1, 10: 0.8, 11: 0.5 } } },
  vietnam: { base: 6, event: { label: 'Mui Ne winter wind season', weight: 3, months: { 11: 0.6, 12: 0.8, 1: 1, 2: 1, 3: 0.9, 4: 0.5 } } },
  namibia: { base: 5, event: { label: 'Walvis Bay Lagoon wind season', weight: 4, months: { 11: 0.6, 12: 0.9, 1: 1, 2: 1, 3: 0.9, 4: 0.6 } } },
  provence: { base: 5, event: { label: 'Camargue Mistral season', weight: 3, months: { 11: 0.6, 12: 0.8, 1: 1, 2: 1, 3: 0.9, 4: 0.6 } } },
  'turks-caicos': { base: 7, event: { label: 'Long Bay reliable trade-wind season', weight: 2, months: { 11: 0.4, 12: 0.6, 1: 0.8, 2: 0.9, 3: 1, 4: 1, 5: 0.9 } } },

  // ---- Moderate tier ----
  dubai: { base: 4, event: { label: 'Kite Beach winter wind', weight: 3, months: { 12: 0.7, 1: 1, 2: 1, 3: 0.7, 4: 0.5 } } },
  croatia: { base: 4, event: { label: 'Viganj Maestral season', weight: 3, months: { 5: 0.6, 6: 0.8, 7: 1, 8: 1, 9: 0.7 } } },
  srilanka: { base: 3, event: { label: 'Kalpitiya wind season', weight: 4, months: { 5: 0.6, 6: 0.9, 7: 1, 8: 1, 9: 0.9, 10: 0.6, 12: 0.4, 1: 0.5, 2: 0.4 } } },
  tanzania: { base: 3, event: { label: 'Paje monsoon wind seasons (Kaskazi & Kusi)', weight: 4, months: { 12: 0.5, 1: 0.6, 2: 0.6, 3: 0.5, 5: 0.7, 6: 0.9, 7: 1, 8: 1, 9: 0.9, 10: 0.6 } } },
  barbados: { base: 4, event: { label: 'Silver Sands trade-wind season', weight: 3, months: { 11: 0.6, 12: 0.8, 1: 1, 2: 1, 3: 0.9, 4: 0.6 } } },
  lisbon: { base: 4, event: { label: 'Guincho "nortada" summer wind', weight: 3, months: { 6: 0.6, 7: 0.9, 8: 1, 9: 0.7 } } },
  ireland: { base: 4, event: { label: 'Brandon Bay Atlantic storm season', weight: 3, months: { 9: 0.6, 10: 0.8, 11: 1, 12: 0.9, 1: 0.7, 2: 0.6 } } },
  cornwall: { base: 4, event: { label: 'Watergate Bay Atlantic storm season', weight: 3, months: { 9: 0.6, 10: 0.8, 11: 1, 12: 0.9, 1: 0.7 } } },
  gbr: { base: 4, event: { label: 'Whitsundays trade-wind season', weight: 3, months: { 3: 0.6, 4: 0.9, 5: 1, 6: 1, 7: 0.8, 8: 0.6 } } },
  mallorca: { base: 4, event: { label: 'Pollença Bay "Embat" season', weight: 2, months: { 5: 0.6, 6: 0.8, 7: 1, 8: 1, 9: 0.7 } } },
  taiwan: { base: 4, event: { label: 'Kenting NE monsoon season', weight: 3, months: { 10: 0.6, 11: 0.9, 12: 1, 1: 1, 2: 0.8, 3: 0.6 } } },
  bordeaux: { base: 4, event: { label: 'Arcachon Bay wind season', weight: 2, months: { 4: 0.6, 5: 0.8, 6: 0.9, 7: 1, 8: 1, 9: 0.8, 10: 0.5 } } },
  'colombian-caribbean': { base: 4, event: { label: 'Cabo de la Vela trade-wind season', weight: 3, months: { 12: 0.6, 1: 0.8, 2: 0.9, 3: 1, 4: 1, 5: 0.9, 6: 0.7, 7: 0.5 } } },
  madagascar: { base: 3, event: { label: 'Ifaty trade-wind season', weight: 3, months: { 6: 0.7, 7: 0.9, 8: 1, 9: 0.7 } } },

  // ---- Modest / niche tier ----
  jamaica: { base: 2, event: { label: 'North Coast trade-wind season', weight: 3, months: { 12: 0.6, 1: 0.8, 2: 1, 3: 0.7 } } },
  rio: { base: 2, event: { label: 'Barra da Tijuca wind season', weight: 2, months: { 8: 0.5, 9: 0.6, 10: 0.8, 11: 1, 12: 0.9, 1: 0.8, 2: 0.7 } } },
  bahamas: { base: 2, event: { label: 'Exuma trade-wind season', weight: 3, months: { 11: 0.6, 12: 0.8, 1: 1, 2: 1, 3: 0.8, 4: 0.6 } } },
  bali: { base: 2, event: { label: 'Sanur dry-season wind', weight: 2, months: { 6: 0.7, 7: 1, 8: 1, 9: 0.6 } } },
  chicago: { base: 1, event: { label: 'Lake Michigan storm-wind season', weight: 3, months: { 9: 0.5, 10: 0.8, 11: 1, 12: 0.6 } } },
  'cape-cod-islands': { base: 2, event: { label: 'Cape Cod Bay summer wind', weight: 2, months: { 6: 0.6, 7: 0.9, 8: 1, 9: 0.6 } } },
  nyc: { base: 1, event: { label: 'Rockaway-area summer wind', weight: 3, months: { 6: 0.6, 7: 0.9, 8: 1, 9: 0.6 } } },
  'big-island': { base: 3 },
  copenhagen: { base: 2, event: { label: 'Amager Strandpark wind season', weight: 2, months: { 5: 0.6, 6: 0.8, 7: 1, 8: 0.9, 9: 0.6 } } },
  sydney: { base: 4, event: { label: 'Kurnell nor\'easter season', weight: 2, months: { 10: 0.5, 11: 0.7, 12: 0.9, 1: 1, 2: 0.9, 3: 0.6 } } },
  'nova-scotia': { base: 3 },
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

  const allRows = await db.select().from(places);
  const candidateIds = new Set(Object.keys(CANDIDATES));
  const missing = [...candidateIds].filter((id) => !allRows.some((r) => r.id === id));
  if (missing.length) { console.error('Unknown candidate ids:', missing); process.exit(1); }

  const naIds = allRows.map((r) => r.id).filter((id) => !candidateIds.has(id));

  console.log(`Candidates (non-NA): ${candidateIds.size}`);
  console.log(`NA: ${naIds.length}`);
  console.log(`Total: ${allRows.length}\n`);

  // ---- Candidates: base score + event, verified via the real pipeline ----
  for (const [id, cand] of Object.entries(CANDIDATES)) {
    const row = allRows.find((r) => r.id === id)!;
    const scoring = toScoringPlace(row);
    const patchedScoring = {
      ...scoring,
      base: { ...scoring.base, [KEY]: cand.base },
      sliderEvents: cand.event ? { ...(scoring.sliderEvents ?? {}), [KEY]: [cand.event] } : scoring.sliderEvents,
    };
    const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    const peak = Math.max(...monthly);
    console.log(`  ${id.padEnd(24)} base=${cand.base}  peak=${peak.toFixed(1)}  monthly=[${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      baseScores: { ...(row.baseScores as Record<string, number>), [KEY]: cand.base },
    };
    if (cand.event) {
      const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
      patch.sliderEvents = { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [cand.event] };
      patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve };
      patch.authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), KEY]));
    }
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
  }

  // ---- Everything else: NA ----
  console.log(`\nMarking ${naIds.length} places NA for ${KEY}...`);
  if (!dryRun) {
    const naRows = await db.select().from(places).where(inArray(places.id, naIds));
    for (const row of naRows) {
      const currentNA = (row.naSliders as string[]) ?? [];
      if (currentNA.includes(KEY)) continue;
      const patch = { naSliders: [...currentNA, KEY] };
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, row.id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: row.id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
