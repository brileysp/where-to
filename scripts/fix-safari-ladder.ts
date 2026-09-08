import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Fixes the East African ladder: Kenya ~ Tanzania > Uganda > Ethiopia.
 *
 * Two separate faults, found by dumping contributions rather than
 * reasoning about them:
 *
 * 1. MY inconsistency. An earlier pass demoted the safari destinations'
 *    scenicLandscapes to 'casual', then a correction moved them to
 *    'strong' — but Uganda was never in either list, so it kept a derived
 *    'signature' worth the full 10.0 while the Mara and Serengeti sat at
 *    6.0 and 5.4. The famous ones were penalised and the obscure one was
 *    not. The Mara and Ngorongoro are iconic landscapes in their own
 *    right; Uganda's draw is gorillas, and its scenery is the setting.
 *
 * 2. Ethiopia is over-scored. It carried 10s for wildlifeViewing, hiking,
 *    religiousSites AND a 9 for scenery — four near-maximum claims. Lalibela
 *    genuinely is world-class sacred heritage and keeps its 10, but Ethiopia
 *    is not a wildlife destination in the sense Kenya is, and the Simien
 *    Mountains are not Nepal. Those two scores are corrected, not tier-gated:
 *    the numbers themselves were wrong.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';

const TIERS: Record<string, Record<string, Tier>> = {
  scenicLandscapes: {
    kenya: 'signature',    // the Mara is iconic landscape, not just a backdrop
    tanzania: 'signature', // Serengeti and Ngorongoro likewise
    uganda: 'strong',      // handsome, but people come for the gorillas
  },
};

const SCORES: Record<string, Record<string, number>> = {
  ethiopia: { wildlifeViewing: 5, hiking: 7 },
  // Serengeti, Ngorongoro and Kilimanjaro scored 6 for scenery while Kenya
  // held 8 — indefensible for the same ecosystem, and the one-point gap in
  // the top contribution was worth 45 ranks on this compressed scale.
  tanzania: { scenicLandscapes: 8 },
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
    console.log(`  ${id.padEnd(12)} ${[...Object.entries(e.tiers).map(([k, v]) => `${k}:${v}`), ...Object.entries(e.scores).map(([k, v]) => `${k}=${v}`)].join(' ')}`);
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
