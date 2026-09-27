import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

// Found while auditing whaleWatching against Sea Life Guide/2seewhales:
// North Island's Hauraki Gulf holds a genuinely reliable, year-round
// Bryde's whale population (confirmed via the Auckland Marine Mammal
// Ecology Group) — one of the world's few resident populations of the
// species. A flat base=6 undersold this relative to seasonal destinations
// hitting 9-10 despite being a LESS certain bet (a real migration peak
// can still be missed by timing; a resident population can't). No event
// needed — the whole story here is "reliable any month," not a season.

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

  const [row] = await db.select().from(places).where(eq(places.id, 'north-island'));
  const scoring = toScoringPlace(row);
  const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
  const patchedScoring = { ...scoring, base: { ...(scoring.base ?? {}), [KEY]: 8 } };
  const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
  console.log('before:', before.map((v: number) => v.toFixed(0)).join(','));
  console.log('after: ', after.map((v: number) => v.toFixed(0)).join(','));

  const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
  const patch: Record<string, unknown> = {
    baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: 8 },
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
    sliderOverview: {
      ...(row.sliderOverview as Record<string, string>),
      [KEY]: "The Hauraki Gulf near Auckland holds one of the world's few resident Bryde's whale populations, genuinely reliable in any month — confirmed by ongoing research from the Auckland Marine Mammal Ecology Group. A less flashy story than a big migration peak elsewhere, but a more certain one.",
    },
    sliderSources: {
      ...(row.sliderSources as Record<string, unknown>),
      [KEY]: [
        { url: 'https://sealifeguide.com/best-time-to-go-whale-watching/', label: 'Sea Life Guide', note: "Confirms year-round Hauraki Gulf Bryde's whale residency per Auckland Marine Mammal Ecology Group research, not a seasonal migration", addedAt: new Date().toISOString().slice(0, 10) },
      ],
    },
  };

  if (!dryRun) {
    const afterRow = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'north-island'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'north-island',
        action: 'update', beforeValue: row, afterValue: afterRow,
      });
    });
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
