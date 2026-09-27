import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Corrects over-demotions from the iconic signatureTier pass.
 *
 * Two mistakes, both mine, both visible once the actual contribution lists
 * were dumped rather than reasoned about:
 *
 * 1. Yellowstone's scenicLandscapes was forced to 'strong' on the argument
 *    that people come for geysers and wildlife. Its July score is 9, which
 *    derives to signature, so the override cost it 3.6 points of
 *    contribution and dropped it below Grand Canyon — which banks the full
 *    9.0 for exactly the same kind of landscape. Grand Prismatic, the Lower
 *    Falls and the Lamar Valley are a reason people go.
 *
 * 2. The safari destinations were demoted to 'casual' for scenery on the
 *    argument that the animals are the draw. True, but the Mara and the
 *    Serengeti are visually iconic in their own right, and with safari
 *    capped at enthusiast weight and nationalParks notched for being
 *    non-US, casual scenery left Kenya 185th of 200 — below the Cotswolds.
 *    A destination cannot have every one of its draws capped at once.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';
const FIXES: Record<string, Record<string, Tier>> = {
  scenicLandscapes: {
    yellowstone: 'signature',
    // Safari country: the landscape is genuinely half the picture.
    kenya: 'strong', tanzania: 'strong', botswana: 'strong', zambia: 'strong', kruger: 'strong',
    // Mountains and volcanoes ARE the scenery at these; casual was wrong.
    whistler: 'strong', sicily: 'strong', srilanka: 'strong',
  },
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

  const edits = new Map<string, Record<string, Tier>>();
  for (const [interest, picks] of Object.entries(FIXES)) {
    for (const [id, tier] of Object.entries(picks)) {
      const row = byId.get(id);
      if (!row) { console.error(`unknown destination: ${id}`); process.exit(1); }
      if (!edits.has(id)) edits.set(id, {});
      edits.get(id)![interest] = tier;
    }
  }

  for (const [id, e] of edits) {
    const row = byId.get(id)!;
    const signatureTier = { ...(row.signatureTier as Record<string, Tier>), ...e };
    const after = { ...row, signatureTier };
    console.log(`  ${id.padEnd(24)} ${Object.entries(e).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    await db.transaction(async (tx) => {
      await tx.update(places).set({ signatureTier, updatedAt: new Date() }).where(eq(places.id, id));
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
  console.log(`\ndone: ${edits.size} destinations corrected.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
