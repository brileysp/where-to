import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Corrections across wildflowerBlooms, birding, coffeeTea, allInclusive and
 * yogaRetreats, prompted by external top-20 lists and checked against the
 * catalogue.
 *
 * 1. wildflowerBlooms WAS SYSTEMATICALLY BROKEN. A cluster of destinations
 *    sat at the floor value 2 while carrying 'signature' or 'strong' tiers:
 *    Kyoto at 2 [signature] for cherry blossom, Provence at 2 [signature]
 *    for lavender, Texas Hill Country at 2 [signature] for bluebonnets,
 *    Hokkaido at 2 [strong] for the Furano fields. That is the same
 *    score/tier contradiction found on Whistler's mountain biking, but
 *    repeated a dozen times — it reads like a backfill that wrote 2 as a
 *    placeholder and authored the tiers in a separate pass that was never
 *    reconciled. Sakura is the most famous seasonal bloom on earth and the
 *    catalogue scored it 2.
 *
 * 2. BIRDING UNDERSCORED THE TWO MOST BIRD-RICH COUNTRIES ON EARTH.
 *    Colombia has more bird species than any country (1,900+) and Peru is
 *    second; they held 7 and 5 while Papua New Guinea and the Peruvian
 *    Amazon held 10.
 *
 * 3. Kyoto/Uji is the most famous tea destination in the world and held
 *    coffeeTea 6 ['casual'].
 *
 * 4. The Maldives is the definitive luxury all-inclusive and held 6
 *    ['casual']; Zanzibar's market was invisible because tanzania was
 *    swept to N/A.
 *
 * NOT CHANGED: safari. Its ordering already matches the external list
 * almost exactly (Serengeti, Maasai Mara, Okavango, Kruger, South Luangwa,
 * Hwange, Etosha, then the gorilla destinations) — it is the best-authored
 * slider found so far alongside diving. Rishikesh, Melbourne, Darjeeling,
 * Bonaire, St Lucia, the Valley of Flowers and Western Australia are not
 * destinations in this catalogue and were ignored rather than approximated.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';

const SCORES: Record<string, Record<string, number>> = {
  // The floor-value-2 cluster. Scores now match the tiers already claimed.
  'tokyo-kyoto': { wildflowerBlooms: 10, coffeeTea: 8 }, // sakura; Uji matcha
  provence: { wildflowerBlooms: 9 },                     // lavender
  hokkaido: { wildflowerBlooms: 8 },                     // Furano
  'texas-hill-country': { wildflowerBlooms: 7 },         // bluebonnets
  tuscany: { wildflowerBlooms: 6 },                      // poppy fields
  namibia: { wildflowerBlooms: 6 },                      // desert bloom
  'great-smoky-mountains': { wildflowerBlooms: 6 },      // spring ephemerals, rhododendron
  dolomites: { wildflowerBlooms: 6 },                    // alpine meadows
  'joshua-tree': { wildflowerBlooms: 6 },                // California superbloom
  'death-valley': { wildflowerBlooms: 6 },               // California superbloom
  ladakh: { wildflowerBlooms: 4 },
  kyrgyzstan: { wildflowerBlooms: 4 },

  // Birding: the two most species-rich countries on earth.
  'colombian-andes': { birding: 9 },
  'colombian-caribbean': { birding: 8 },
  peru: { birding: 7 },
  'costa-rica': { birding: 8 },

  maldives: { allInclusive: 8 },
};

const UN_NA: Record<string, Array<[string, number]>> = {
  tanzania: [['allInclusive', 5]],       // Zanzibar's resort market
  tuscany: [['yogaRetreats', 4]],
  maui: [['yogaRetreats', 5]],
  tasmania: [['wildflowerBlooms', 5]],
  'north-island': [['wildflowerBlooms', 4]],
};

const TIERS: Record<string, Record<string, Tier>> = {
  wildflowerBlooms: {
    'tokyo-kyoto': 'signature', provence: 'signature', hokkaido: 'strong',
    'texas-hill-country': 'strong', dolomites: 'strong', 'joshua-tree': 'strong',
    'death-valley': 'strong', 'great-smoky-mountains': 'strong',
  },
  birding: { 'colombian-andes': 'signature', 'costa-rica': 'strong', peru: 'strong' },
  coffeeTea: { 'tokyo-kyoto': 'strong' },
  allInclusive: { maldives: 'strong' },
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
