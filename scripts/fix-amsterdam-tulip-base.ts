import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

// Found via db:audit:scoring while finalizing wildflowerBlooms content:
// Amsterdam's flat base=8 (event weight only 1) meant wildflowerBlooms
// scored 8/9 ("Excellent") every month including December, when Keukenhof
// — the ONLY real wildflowerBlooms experience here — is literally closed.
// That was inflating Amsterdam's overall winter score ("general=8.1 vs
// comfort=6.4, driven by wildflowerBlooms:8"). Amsterdam's wildflowerBlooms
// experience genuinely IS a single seasonal garden, not a year-round
// backdrop — base should be low like every other single-event destination
// (Napa=2, Death Valley=2), with the event carrying the signal, matching
// exactly the "don't send someone to zero blooms" principle just raised.

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

  const [row] = await db.select().from(places).where(eq(places.id, 'amsterdam'));
  const scoring = toScoringPlace(row);
  const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly['wildflowerBlooms'];

  const newBase = 2;
  const event = { label: 'Tulip season (Keukenhof)', weight: 7, months: { 3: 0.4, 4: 1, 5: 0.5 } };
  const patched = { ...scoring, base: { ...(scoring.base ?? {}), wildflowerBlooms: newBase }, sliderEvents: { ...(scoring.sliderEvents ?? {}), wildflowerBlooms: [event] } };
  const after = deriveDestinationScores(patched, { skipHazards: true }).monthly['wildflowerBlooms'];
  console.log('before:', before.map((v: number) => v.toFixed(0)).join(','));
  console.log('after: ', after.map((v: number) => v.toFixed(0)).join(','));

  const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
  const patch: Record<string, unknown> = {
    baseScores: { ...(row.baseScores as Record<string, unknown>), wildflowerBlooms: newBase },
    sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), wildflowerBlooms: [event] },
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), wildflowerBlooms: fit.curve },
  };

  if (!dryRun) {
    const afterRow = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'amsterdam'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'amsterdam',
        action: 'update', beforeValue: row, afterValue: afterRow,
      });
    });
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
