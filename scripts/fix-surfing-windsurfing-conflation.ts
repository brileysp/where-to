import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Windsurfing/kitesurfing was just split out of 'surfing' into its own
 * (unauthored) windSports interest. Audited the surfing base scores for
 * any destination whose score looked like it was reflecting wind-sport
 * fame rather than genuine wave-surfing quality.
 *
 * Aruba is the one clear case: its surfing base was 6 (peak 7, flat
 * year-round, no event) — but real research turned up that traditional
 * wave surfing there is "less developed," with only two known, rougher-
 * access North Shore spots (Andicuri, Wariruri). Aruba's actual fame is
 * windsurfing/kitesurfing at Fisherman's Huts (Hadicurari Beach), which
 * belongs to windSports now, not surfing. Lowered to base 3 (peak 4),
 * matching the tier of other real-but-secondary/niche surf destinations
 * already in the catalog (Thailand, Tasmania, Seychelles, Madagascar,
 * Komodo, Vietnam all sit at base 3 / peak 4 with no event).
 *
 * Checked several other wind-sport-famous destinations already in the
 * catalog (Maui/Ho'okipa, Mauritius/Le Morne) and did NOT find the same
 * conflation: both have genuine, independently-famous WAVE breaks
 * (Jaws/Pe'ahi; Le Morne's own "One Eye" reef wave) that justify their
 * current surfing scores on wave-surfing merit alone, unrelated to their
 * separate wind-sport reputations.
 */

const KEY = 'surfing';
const FIXES: Record<string, number> = { aruba: 3 };

async function main() {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  const env: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, newBase] of Object.entries(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const patchedScoring = { ...scoring, base: { ...scoring.base, [KEY]: newBase } };
    const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`  ${id}`);
    console.log(`    before: base=${scoring.base[KEY]}  peak=${Math.max(...before).toFixed(1)}`);
    console.log(`    after:  base=${newBase}  peak=${Math.max(...monthly).toFixed(1)}`);

    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      baseScores: { ...(row.baseScores as Record<string, number>), [KEY]: newBase },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
