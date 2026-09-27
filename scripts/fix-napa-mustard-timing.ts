import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

// Research (Napa Valley Mustard Celebration / visitnapavalley.com) puts the
// real peak in mid-February, with the season running Jan-Mar and the
// festival finale (a marketing event, not the bloom itself) in late March.
// The existing event peaked in March instead — fixed so the score matches
// the real bloom, not the festival date.

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

  const [row] = await db.select().from(places).where(eq(places.id, 'napa'));
  const scoring = toScoringPlace(row);
  const event = { label: 'Wild mustard bloom (vineyard cover crop)', weight: 3, months: { 1: 0.3, 2: 1, 3: 0.6 } };
  const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), wildflowerBlooms: [event] } };
  const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly['wildflowerBlooms'];
  const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly['wildflowerBlooms'];
  console.log('before:', before.map((v: number) => v.toFixed(0)).join(','));
  console.log('after: ', after.map((v: number) => v.toFixed(0)).join(','));

  const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
  const patch: Record<string, unknown> = {
    sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), wildflowerBlooms: [event] },
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), wildflowerBlooms: fit.curve },
  };

  if (!dryRun) {
    const afterRow = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'napa'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'napa',
        action: 'update', beforeValue: row, afterValue: afterRow,
      });
    });
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
