import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

// db:audit:anchors flagged borneo (OVER — stored curve reaches 10 outside
// the anchor set) and zimbabwe (UNDER — stored curve's anchor destination
// doesn't reach 10), found while wrapping up the wildflowerBlooms audit —
// unrelated to that work. Both stored curves have drifted from what the
// live formula actually produces (borneo: stored anchors claim 10 at
// months 3/10, live formula tops out at 9; zimbabwe: stored anchors cap at
// 9, live formula reaches 10 at months 7-10) — the same
// stale-curve-vs-live-formula mismatch documented in
// fix-diving-refit-curves.ts. Re-deriving and refitting, not touching
// baseScores/sliderEvents at all.

const IDS = ['borneo', 'zimbabwe'];

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of IDS) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const scoring = toScoringPlace(row);
    const monthly = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    console.log(`${id}: [${monthly.map((v: number) => v.toFixed(0)).join(',')}] peak=${Math.max(...monthly)}`);

    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch = { sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve } };

    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
