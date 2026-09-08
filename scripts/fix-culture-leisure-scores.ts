import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Corrections to hotSprings, fineDining, themeParks, cyclingRoad and
 * beachesSwimming, from a further eight external top-20 lists.
 *
 * Checked against the MONTHLY PEAK this time, not the base score — the
 * lesson from the wildflowerBlooms mistake, where a low base is the correct
 * off-season floor rather than a low opinion of the destination. Nothing
 * here is a seasonal-floor case: every change below is a destination whose
 * peak was genuinely too low.
 *
 * NEEDED NOTHING, and worth recording as well-authored:
 *  - streetFood. The top ten (Mexico City, Tokyo, Istanbul, Hong Kong,
 *    Singapore, Bangkok, Thailand, Taiwan, Vietnam, Oaxaca all at 10)
 *    matches the external list almost rank for rank.
 *  - skiingSnowboarding. Aspen and Whistler at 10, Zermatt/Chamonix/
 *    Dolomites/Banff at 9 with peaks of 10, Niseko via Hokkaido. Correct,
 *    and correctly seasonal.
 *  - luxuryHotels. Maldives, Paris, Tokyo, Dubai, Bora Bora, London and
 *    the safari lodges all at 10, matching the list's own top tier.
 *
 * Destinations on the lists that this catalogue simply does not contain
 * (Orlando, Anaheim, Penang, Lyon, Madrid, Jackson Hole, Park City, Lake
 * Como, St Barths, Girona, the Belgian Ardennes, Pamukkale) were ignored
 * rather than approximated onto a neighbour.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';

const SCORES: Record<string, Record<string, number>> = {
  // Hakone is the list's #1 hot-spring destination and onsen is the global
  // reference for the whole category; this held 5 ['casual'].
  'tokyo-kyoto': { hotSprings: 8 },
  // Noma and New Nordic put Copenhagen in most global top fives; it sat
  // below Rome, Barcelona and Napa.
  copenhagen: { fineDining: 9 },
  // Disneyland Paris is Europe's most-visited theme park at roughly 10m a
  // year. It scored 5, below Tivoli's 7.
  paris: { themeParks: 8 },
  // The French Alps are the sport's spiritual home (Alpe d'Huez, Croix de
  // Fer); the Swiss Alps likewise. Both were below Tuscany and Provence.
  chamonix: { cyclingRoad: 8 },
  swissalps: { cyclingRoad: 7 },
  'rocky-mountain': { cyclingRoad: 6 },  // Boulder and the Front Range
  algarve: { cyclingRoad: 6 },           // a well-established winter training base
  maldives: { beachesSwimming: 10 },     // the list's #1; Bora Bora already held 10
};

const UN_NA: Record<string, Array<[string, number]>> = {
  tuscany: [['hotSprings', 6]],                 // Saturnia
  'black-forest': [['themeParks', 7]],          // Europa-Park at Rust
  'great-smoky-mountains': [['themeParks', 5]], // Dollywood at Pigeon Forge
};

const TIERS: Record<string, Record<string, Tier>> = {
  hotSprings: { 'tokyo-kyoto': 'strong', tuscany: 'strong' },
  themeParks: { paris: 'strong', 'black-forest': 'strong' },
  cyclingRoad: { chamonix: 'strong', swissalps: 'strong' },
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const ids = new Set([...Object.keys(SCORES), ...Object.keys(UN_NA), ...Object.values(TIERS).flatMap((t) => Object.keys(t))]);
  for (const id of ids) if (!byId.has(id)) { console.error(`unknown destination: ${id}`); process.exit(1); }

  for (const id of ids) {
    const row = byId.get(id)!;
    const baseScores = { ...(row.baseScores as Record<string, number>), ...(SCORES[id] ?? {}) };
    let naSliders = row.naSliders ?? [];
    for (const [k, v] of UN_NA[id] ?? []) {
      naSliders = naSliders.filter((x) => x !== k);
      baseScores[k] = v;
    }
    const signatureTier = { ...(row.signatureTier as Record<string, Tier>) };
    for (const [interest, picks] of Object.entries(TIERS)) if (picks[id]) signatureTier[interest] = picks[id];

    const after = { ...row, baseScores, naSliders, signatureTier };
    console.log(`  ${id.padEnd(24)} ${[
      ...Object.entries(SCORES[id] ?? {}).map(([k, v]) => `${k}=${v}`),
      ...(UN_NA[id] ?? []).map(([k, v]) => `${k}=${v}(un-N/A)`),
    ].join(' ')}`);

    await db.transaction(async (tx) => {
      await tx.update(places).set({ baseScores, naSliders, signatureTier, updatedAt: new Date() }).where(eq(places.id, id));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: id,
        action: 'update',
        beforeValue: row,
        afterValue: after,
      });
      const curves = fitDestinationCurves(toScoringPlace(after as Parameters<typeof toScoringPlace>[0]));
      await tx.update(places).set({ sliderCurves: curves }).where(eq(places.id, id));
    });
  }
  console.log(`\ndone: ${ids.size} destinations updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
