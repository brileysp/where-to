import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Second round of the whaleWatching NA audit — the first round (29
 * destinations) was compiled from memory/judgment in one pass, which
 * itself turned out to miss real destinations (Redwood, flagged by the
 * user). This round is a full manual re-scan of every remaining NA
 * destination against real geography, followed by parallel research on
 * every candidate that survived that scan (not just the ones that
 * seemed obvious).
 *
 * A few notable corrections found DURING research, not assumed going
 * in: Komodo's real blue-whale corridor is actually the Alor/Pantar
 * Strait, geographically distant and inaccessible from Komodo tourism
 * — so it stays low despite the initial hypothesis. Palawan's Tañon
 * Strait cetacean sanctuary is in a different island group entirely
 * (Cebu/Negros, ~575km away) — same story. Olympic National Park's
 * gray whale migration is real but has zero boat operators actually
 * there (shore-based viewing only, closest boat operator 90 miles away
 * on a different body of water). Hudson Valley's real whale activity
 * turned out to be the NYC-harbor phenomenon already captured under
 * "nyc" — it doesn't reach the upriver valley itself.
 */

const KEY = 'whaleWatching';

type Fix = { base: number; events?: Array<{ label: string; weight: number; months: Record<number, number> }> };

const FIXES: Record<string, Fix> = {
  // --- Essentially nonexistent as tourism, real presence or not ---
  komodo: { base: 2 },
  palawan: { base: 2 },
  'belfast-giants-causeway': { base: 2 },
  kerala: { base: 2 },
  'douro-valley-porto': { base: 1 },
  croatia: { base: 2 },
  amalfi: { base: 2 },
  ghana: { base: 2 },
  'hudson-valley': { base: 2 },
  rivieramaya: { base: 1 },
  santorini: { base: 2 },
  egypt: { base: 1 },
  'tokyo-kyoto': { base: 1 },

  // --- Modest, real but minor ---
  bordeaux: { base: 3, events: [{ label: 'Bay of Biscay whale season', weight: 2, months: { 5: 0.5, 6: 0.7, 7: 1, 8: 1, 9: 0.6 } }] },
  barcelona: { base: 3, events: [{ label: 'Fin whale season', weight: 2, months: { 2: 0.6, 3: 0.8, 4: 1, 5: 1, 6: 0.6 } }] },
  havana: { base: 3, events: [{ label: 'Humpback whale season', weight: 2, months: { 12: 0.5, 1: 0.7, 2: 0.8, 3: 1, 4: 0.5 } }] },
  belize: { base: 3, events: [{ label: 'Humpback whale season', weight: 2, months: { 12: 0.5, 1: 0.8, 2: 1, 3: 1, 4: 0.5 } }] },
  vietnam: { base: 2, events: [{ label: 'Recent, still-emerging Bryde\'s whale sightings near Quy Nhơn', weight: 1, months: { 6: 1, 7: 0.8 } }] },
  oaxaca: { base: 3, events: [{ label: 'Humpback whale season off the coast', weight: 2, months: { 12: 0.5, 1: 0.8, 2: 1, 3: 0.8 } }] },

  // --- Real, niche, moderate ---
  olympic: { base: 3, events: [{ label: 'Gray whale migration, visible from shore (no boat tours here)', weight: 1, months: { 3: 0.6, 4: 1, 5: 0.7, 10: 0.5, 11: 0.8 } }] },
  rajaampat: { base: 3, events: [{ label: 'Cetacean season in the Dampier Strait', weight: 2, months: { 12: 0.7, 1: 1, 2: 1, 3: 0.6 } }] },
  lisbon: { base: 3, events: [{ label: 'Minke, fin, and sei whale season off Sesimbra', weight: 2, months: { 4: 0.5, 5: 0.8, 6: 1, 7: 1, 8: 0.6 } }] },
  tuscany: { base: 3, events: [{ label: 'Pelagos Sanctuary whale season off Elba and Giglio', weight: 2, months: { 5: 0.5, 6: 0.7, 7: 1, 8: 1, 9: 0.6 } }] },
  sicily: { base: 3, events: [{ label: 'Whale season off Catania and the Aeolian Islands', weight: 2, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 0.7 } }] },
  nicaragua: { base: 3, events: [{ label: 'Humpback whale season off San Juan del Sur', weight: 2, months: { 12: 0.5, 1: 0.8, 2: 1, 3: 0.8 } }] },
  provence: { base: 3, events: [{ label: 'Pelagos Sanctuary whale season off Marseille and Cassis', weight: 2, months: { 5: 0.6, 6: 0.8, 7: 1, 8: 1, 9: 0.6 } }] },

  // --- Established, moderate-high ---
  rio: { base: 3, events: [{ label: 'Humpback whale season near the Cagarras Islands', weight: 3, months: { 6: 0.6, 7: 1, 8: 0.7 } }] },
  tanzania: { base: 4, events: [{ label: 'Humpback whale season off Zanzibar', weight: 2, months: { 6: 0.5, 7: 0.8, 8: 1, 9: 1, 10: 0.5 } }] },
  taiwan: { base: 4, events: [{ label: 'Whale season off Hualien (mostly dolphins; whales are a real but secondary sighting)', weight: 2, months: { 3: 0.4, 4: 0.6, 5: 0.8, 6: 0.8, 7: 1, 8: 1, 9: 0.8, 10: 0.5 } }] },
  mauritius: { base: 4, events: [{ label: 'Humpback whale season (a resident sperm whale population is present year-round, though "swim with" tours are illegal and contested)', weight: 3, months: { 7: 0.6, 8: 0.8, 9: 1, 10: 1, 11: 0.6 } }] },
  'north-island': { base: 6 },

  // --- Major ---
  madagascar: { base: 5, events: [{ label: 'Humpback whale breeding season at Île Sainte-Marie', weight: 4, months: { 6: 0.5, 7: 0.8, 8: 1, 9: 1, 10: 0.6 } }] },
  hokkaido: { base: 4, events: [{ label: 'Orca and sperm whale season in the Nemuro Strait off Rausu', weight: 4, months: { 5: 0.8, 6: 1, 7: 0.8, 8: 0.8, 9: 1, 10: 0.7 } }] },
  acadia: { base: 5, events: [{ label: 'Gulf of Maine whale season out of Bar Harbor', weight: 3, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.5 } }] },
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
