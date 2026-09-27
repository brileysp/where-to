import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Corrects two score-inflation patterns on the great archaeological
 * destinations, found while investigating why Bagan ranked 20th.
 *
 * 1. SCENERY CONFLATED WITH SPECTACLE. Bagan carried scenicLandscapes 9 at
 *    signature. Bagan is a flat, dry plain on the Irrawaddy; what is
 *    breathtaking there is two thousand temples at sunrise, which is
 *    historyArchaeology — already correctly scored 10. Scoring the same
 *    magnificence twice, once as ruins and once as landscape, double-counts
 *    it and lets a single-purpose destination outrank Venice.
 *
 * 2. MUSEUMS SCORED FOR THE SITE, NOT THE MUSEUMS. Bagan and Angkor both
 *    held museumsArt 10 — level with Paris, Rome and New York. Bagan has one
 *    small archaeological museum; Siem Reap has a decent national museum but
 *    not a world-tier collection; Petra has a modest visitor museum. The
 *    monuments themselves are already captured by historyArchaeology and
 *    architecture. Egypt and Athens keep their 10s, because the Egyptian
 *    Museum and the Acropolis/National Archaeological museums genuinely are
 *    world-class collections in their own right.
 *
 * Neither correction touches what these places are actually celebrated for.
 * Bagan keeps historyArchaeology 10, architecture 10 and religiousSites 10.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';

const SCORES: Record<string, Record<string, number>> = {
  bagan: { scenicLandscapes: 5, museumsArt: 4 },
  angkor: { museumsArt: 6 },
  jordan: { museumsArt: 5 },
};

const TIERS: Record<string, Record<string, Tier>> = {
  scenicLandscapes: { bagan: 'casual' },
  museumsArt: { bagan: 'casual', angkor: 'casual', jordan: 'casual' },
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
  for (const [id, s] of Object.entries(SCORES)) {
    if (!byId.has(id)) { console.error(`unknown destination: ${id}`); process.exit(1); }
    Object.assign(get(id).scores, s);
  }
  for (const [interest, picks] of Object.entries(TIERS)) {
    for (const [id, tier] of Object.entries(picks)) {
      if (!byId.has(id)) { console.error(`unknown destination: ${id}`); process.exit(1); }
      get(id).tiers[interest] = tier;
    }
  }

  for (const [id, e] of edits) {
    const row = byId.get(id)!;
    const signatureTier = { ...(row.signatureTier as Record<string, Tier>), ...e.tiers };
    const baseScores = { ...(row.baseScores as Record<string, number>), ...e.scores };
    const after = { ...row, signatureTier, baseScores };
    console.log(`  ${id.padEnd(10)} ${[...Object.entries(e.scores).map(([k, v]) => `${k}=${v}`), ...Object.entries(e.tiers).map(([k, v]) => `${k}:${v}`)].join(' ')}`);
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
