import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Two corrections, both surfaced by `banff > north-cascades` failing.
 *
 * 1. THE CANADA CARVE-OUT. The "national parks is a US category" rule was
 *    applied literally to every non-US destination, which notched Banff's
 *    nationalParks from 'strong' to 'casual' and dropped Lake Louise and
 *    Moraine Lake out of its top six contributions entirely. Banff takes
 *    4M+ visitors a year, overwhelmingly from the same North American
 *    audience the rule was written about, and is marketed and travelled as
 *    part of the same road-trip park category as Glacier and Yellowstone —
 *    Glacier/Waterton literally straddles the border and was treated as US
 *    on the strength of its region string. The rule is right about
 *    Plitvice and Teide and wrong about the Canadian Rockies, so Canada
 *    moves to the US side of the line. Flagged as a judgment call when the
 *    rule was implemented; this is that call coming due.
 *
 * 2. I OVER-SCORED NORTH CASCADES. Its fresh content pass gave scenery and
 *    hiking 9s that peak at 10 monthly — above Banff's 9 and 8 — which put
 *    a park taking ~30k visitors a year ahead of one taking 4M. It is a
 *    genuinely spectacular wilderness, and it is not more scenic than the
 *    Canadian Rockies. Both drop a point.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';

const TIERS: Record<string, Record<string, Tier>> = {
  nationalParks: {
    banff: 'signature',        // Lake Louise and Moraine Lake are the draw
    'nova-scotia': 'strong',   // Cape Breton Highlands
    'vancouver-island': 'casual', // Pacific Rim is real but not why people come
  },
};

const SCORES: Record<string, Record<string, number>> = {
  'north-cascades': { scenicLandscapes: 8, hiking: 8 },
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

  const edits = new Map<string, { tiers: Record<string, Tier>; scores: Record<string, number> }>();
  const get = (id: string) => {
    if (!edits.has(id)) edits.set(id, { tiers: {}, scores: {} });
    return edits.get(id)!;
  };
  for (const [interest, picks] of Object.entries(TIERS)) {
    for (const [id, tier] of Object.entries(picks)) {
      if (!byId.has(id)) { console.error(`unknown destination: ${id}`); process.exit(1); }
      get(id).tiers[interest] = tier;
    }
  }
  for (const [id, s] of Object.entries(SCORES)) {
    if (!byId.has(id)) { console.error(`unknown destination: ${id}`); process.exit(1); }
    Object.assign(get(id).scores, s);
  }

  for (const [id, e] of edits) {
    const row = byId.get(id)!;
    const signatureTier = { ...(row.signatureTier as Record<string, Tier>), ...e.tiers };
    const baseScores = { ...(row.baseScores as Record<string, number>), ...e.scores };
    const after = { ...row, signatureTier, baseScores };
    console.log(`  ${id.padEnd(18)} ${[...Object.entries(e.tiers).map(([k, v]) => `${k}:${v}`), ...Object.entries(e.scores).map(([k, v]) => `${k}=${v}`)].join(' ')}`);
    await db.transaction(async (tx) => {
      await tx.update(places).set({ signatureTier, baseScores, updatedAt: new Date() }).where(eq(places.id, id));
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
  console.log(`\ndone: ${edits.size} destinations updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
