import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Tuscany was under-authored in a way its own data contradicted, found via
 * scripts/audit-ranking-expectations.ts (ranked 134/200 in the default view
 * against an expectation of top-40).
 *
 * These are corrections of internal inconsistency, not tuning to make an
 * assertion pass:
 *  - scenicLandscapes 6 sat below Cotswolds (7), Puglia (7) and Sicily (8),
 *    while the SAME row scores landscapePhotography 8 and tags it
 *    signatureTier 'signature'. A signature landscape-photography
 *    destination cannot have mediocre scenery; Val d'Orcia is UNESCO-listed
 *    specifically as a cultural landscape.
 *  - historyArchaeology 5 ('casual') sat alongside architecture 9 and
 *    museumsArt 9 in the same row. Florence, Siena, Pisa and the Etruscan
 *    sites are not a 'casual' history offering.
 *
 * The two smaller bumps are lower-confidence and deliberately modest:
 * cityExploration for the density of hill towns beyond Florence, and
 * streetFood for market culture (Mercato Centrale, lampredotto) — NOT to
 * Sicily/Andalucía levels, which have genuinely stronger street-food
 * traditions.
 */

const EDITS: Record<string, number> = {
  scenicLandscapes: 9,
  historyArchaeology: 8,
  cityExploration: 8,
  streetFood: 7,
};
const TIER_EDITS: Record<string, 'signature' | 'strong' | 'casual' | 'none'> = {
  historyArchaeology: 'strong',
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const [row] = await db.select().from(places).where(eq(places.id, 'tuscany'));
  if (!row) {
    console.error('tuscany not found');
    process.exit(1);
  }

  const baseScores = { ...row.baseScores } as Record<string, number>;
  const signatureTier = { ...row.signatureTier };
  for (const [k, v] of Object.entries(EDITS)) {
    console.log(`  ${k.padEnd(20)} ${String(baseScores[k] ?? '-').padStart(3)} -> ${v}`);
    baseScores[k] = v;
  }
  for (const [k, v] of Object.entries(TIER_EDITS)) {
    console.log(`  tier:${k.padEnd(15)} ${String(signatureTier[k] ?? '-').padStart(3)} -> ${v}`);
    signatureTier[k] = v;
  }

  if (dryRun) {
    console.log('\ndry run — nothing written.');
    process.exit(0);
  }

  const after = { ...row, baseScores, signatureTier };
  await db.transaction(async (tx) => {
    await tx.update(places).set({ baseScores, signatureTier, updatedAt: new Date() }).where(eq(places.id, 'tuscany'));
    await tx.insert(adminAuditLog).values({
      actorId: '00000000-0000-0000-0000-000000000000',
      entityType: 'destination',
      entityId: 'tuscany',
      action: 'update',
      beforeValue: row,
      afterValue: after,
    });
    const curves = fitDestinationCurves(toScoringPlace(after as Parameters<typeof toScoringPlace>[0]));
    await tx.update(places).set({ sliderCurves: curves }).where(eq(places.id, 'tuscany'));
  });

  console.log('\nwritten, curves refit.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
