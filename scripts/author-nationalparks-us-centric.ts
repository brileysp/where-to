import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';
import { INTEREST_THRESHOLDS, DEFAULT_THRESHOLD } from '../src/lib/scoring/interestThresholds';

/**
 * Notches every NON-US destination's nationalParks claim down one tier.
 *
 * Editorial call: "national parks" as a trip category is US-centric. When
 * someone picks a destination because they want national parks, they
 * overwhelmingly mean the US system — Yellowstone, Yosemite, Zion, the
 * Grand Canyon. Plitvice and Teide are excellent parks, but almost nobody
 * chooses Croatia or the Canaries *for national parks* the way people
 * choose Utah for them.
 *
 * This is precisely the judgment the percentile derivation cannot make: it
 * sees Plitvice scoring 8 among park-authored destinations and calls that
 * strong, with no concept that the category itself carries a nationality.
 * So it goes in as authored signatureTier, which always wins over derived.
 *
 * Applied to the EFFECTIVE tier — authored where one exists, derived
 * otherwise — so a hand-authored 'strong' notches to 'casual' the same way
 * a derived one does. Destinations already at 'none' stay there.
 *
 * Judgment call worth revisiting: Banff and Jasper are marketed to, and
 * visited by, Americans as part of the same road-trip category, so Canada
 * arguably belongs on the US side of this line. Treated as non-US here
 * because that is what was asked for. Glacier & Waterton straddles the
 * border and is treated as US, since its region string says so.
 */

const US_REGION = /USA|Alaska|Hawaii/;
const NOTCH_DOWN: Record<string, 'signature' | 'strong' | 'casual' | 'none'> = {
  signature: 'strong',
  strong: 'casual',
  casual: 'none',
  none: 'none',
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

function derivedTier(score: number): 'signature' | 'strong' | 'casual' | 'none' {
  const t = INTEREST_THRESHOLDS.nationalParks ?? DEFAULT_THRESHOLD;
  if (score >= t.signature) return 'signature';
  if (score >= t.strong) return 'strong';
  if (score >= t.casual) return 'casual';
  return 'none';
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const targets = rows.filter((r) => {
    if (US_REGION.test(r.region)) return false;
    const score = (r.baseScores as Record<string, number>).nationalParks;
    return score !== undefined && score > 0 && !(r.naSliders ?? []).includes('nationalParks');
  });

  console.log(`\n${targets.length} non-US destinations with an authored nationalParks score\n`);
  const plan = targets.map((r) => {
    const score = (r.baseScores as Record<string, number>).nationalParks;
    const authored = (r.signatureTier as Record<string, string>).nationalParks as
      | 'signature' | 'strong' | 'casual' | 'none' | undefined;
    const before = authored ?? derivedTier(score);
    return { row: r, score, before, after: NOTCH_DOWN[before], wasAuthored: Boolean(authored) };
  });

  for (const p of plan.filter((p) => p.before !== p.after).slice(0, 12)) {
    console.log(`  ${p.row.name.padEnd(34)} ${String(p.score).padStart(2)}  ${p.before} -> ${p.after}${p.wasAuthored ? '  (was authored)' : ''}`);
  }
  const changing = plan.filter((p) => p.before !== p.after);
  console.log(`  ... ${changing.length} changing, ${plan.length - changing.length} already at 'none'`);

  if (dryRun) {
    console.log('\ndry run — nothing written.');
    process.exit(0);
  }

  let written = 0;
  for (const p of changing) {
    const row = p.row;
    const signatureTier = { ...(row.signatureTier as Record<string, string>), nationalParks: p.after };
    const after = { ...row, signatureTier };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ signatureTier, updatedAt: new Date() }).where(eq(places.id, row.id));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: row.id,
        action: 'update',
        beforeValue: row,
        afterValue: after,
      });
      const curves = fitDestinationCurves(toScoringPlace(after as Parameters<typeof toScoringPlace>[0]));
      await tx.update(places).set({ sliderCurves: curves }).where(eq(places.id, row.id));
    });
    written++;
  }

  console.log(`\ndone: ${written} destinations notched down.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
