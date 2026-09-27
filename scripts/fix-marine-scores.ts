import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * whaleWatching and diving corrections, prompted by external top-20 lists
 * and then checked against the catalogue.
 *
 * DIVING needed almost nothing — the existing top sixteen matched the list
 * destination for destination (Raja Ampat, Palau, Egypt, Maldives, the
 * Great Barrier Reef and Belize at 10; Komodo, Fiji, Borneo for Sipadan,
 * Palawan for Tubbataha, Riviera Maya for both Cozumel and the cenotes at
 * 9). Whoever authored that slider knew the subject. Three adjustments
 * only, all for named sites the catalogue reaches but wasn't crediting.
 *
 * WHALE WATCHING was the opposite, and the cause is the same over-broad N/A
 * sweep that buried the Camargue: 170 of 200 destinations marked
 * inapplicable. That wrote off Cape Cod (Stellwagen Bank is among the most
 * reliable humpback grounds in North America), the St Lawrence at Quebec
 * (blue whales and belugas at Tadoussac), Kaikoura (year-round sperm whales
 * on a deep offshore trench, reachable from Marlborough), and the Big
 * Island, which shares Maui's humpback season while Maui scored 8.
 *
 * Not changed: Tonga, Dominica, Hervey Bay, Peninsula Valdes, Bonaire,
 * Socorro, Lembeh and Cocos are not destinations in this catalogue. Cocos
 * is credited indirectly through Costa Rica, which is where the liveaboards
 * leave from.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';

const SCORES: Record<string, Record<string, number>> = {
  'marlborough-abel-tasman': { whaleWatching: 8 }, // Kaikoura
  'vancouver-island': { whaleWatching: 9 },        // the global orca reference
  'cape-town': { whaleWatching: 7 },               // Hermanus, land-based southern rights
  galapagos: { diving: 10 },                       // hammerhead schools; belongs with the 10s
  'costa-rica': { diving: 7 },                     // Cocos Island, Cano, the Catalinas
};

const UN_NA: Record<string, Array<[string, number]>> = {
  'cape-cod-islands': [['whaleWatching', 8]],  // Stellwagen Bank
  'quebec-city': [['whaleWatching', 7]],       // St Lawrence estuary, Tadoussac
  'big-island': [['whaleWatching', 7]],        // Kona coast, same season Maui scores 8 for
};

const TIERS: Record<string, Record<string, Tier>> = {
  whaleWatching: {
    'cape-cod-islands': 'strong', 'quebec-city': 'strong',
    'marlborough-abel-tasman': 'strong', 'vancouver-island': 'signature',
  },
  diving: { galapagos: 'signature', 'costa-rica': 'strong' },
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
      ...Object.entries(TIERS).filter(([, p]) => p[id]).map(([k, p]) => `${k}:${p[id]}`),
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
