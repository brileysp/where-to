import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Found while researching safari content for Nepal/Chitwan: the park
 * closes ENTIRELY during peak monsoon (July-August, reopening ~mid-Sep) —
 * a real, hard cutoff, not just "somewhat less reliable" access. Two bugs
 * this fixes:
 *
 * 1. `wildlifeClosedMonths` was empty for Nepal despite this real closure
 *    (Kaziranga and Ranthambore both correctly have theirs set — this is
 *    the same mechanism, just missing here). This is a shared per-
 *    destination flag read by every slider on the 'wildlife' formula
 *    (wildlifeViewing, safari, whaleWatching, wildflowerBlooms) — the
 *    latter two are already NA for Nepal, so only wildlifeViewing and
 *    safari are actually affected.
 * 2. wildlifeViewing's own Jul/Aug content for Nepal, authored earlier
 *    this session before this fact was known, said rhino sightings are
 *    merely "somewhat less reliable" during monsoon — directly
 *    contradicted by the park being fully closed those two months. Fixed
 *    alongside the flag so score and content don't drift apart.
 */

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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const [row] = await db.select().from(places).where(eq(places.id, 'nepal'));
  const scoring = toScoringPlace(row);

  for (const key of ['safari', 'wildlifeViewing']) {
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[key];
    const patched = { ...scoring, wildlifeClosed: [7, 8] };
    const after = deriveDestinationScores(patched, { skipHazards: true }).monthly[key];
    console.log(`  ${key}`);
    console.log(`    before: [${before.map((v: number) => v.toFixed(0)).join(',')}]`);
    console.log(`    after:  [${after.map((v: number) => v.toFixed(0)).join(',')}]`);
  }

  const currentWVOverview = (row.sliderOverview as Record<string, string>).wildlifeViewing;
  const currentWVMonthly = (row.sliderMonthlyWeather as Record<string, string[]>).wildlifeViewing;
  const fixedWVMonthly = currentWVMonthly.map((text, i) => {
    const month = i + 1;
    if (month === 7 || month === 8) {
      return 'Chitwan National Park is closed to visitors — the park shuts entirely for the deep monsoon.';
    }
    return text;
  });

  const patch: Record<string, unknown> = {
    wildlifeClosedMonths: [7, 8],
    sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, unknown>), wildlifeViewing: fixedWVMonthly },
  };

  console.log('\n  wildlifeViewing overview (unchanged):', currentWVOverview);
  console.log('  wildlifeViewing Jul/Aug text fixed to reflect the closure.');

  if (!dryRun) {
    const after = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'nepal'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'nepal',
        action: 'update', beforeValue: row, afterValue: after,
      });
    });
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
