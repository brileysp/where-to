import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Specialist-lens review of the diving/snorkeling tiers found three real
 * base-score problems (per the user's explicit calls):
 *
 * - Bora Bora (base 9, peak 10): elite snorkeling, but not a serious scuba
 *   destination — its own content says so directly ("built for snorkeling,
 *   not scuba"). The user weights diving heavier than snorkeling, so this
 *   shouldn't sit in the same peak-10 tier as Sipadan/Raja Ampat/Palau/
 *   Komodo. Lowered so peak lands at 9.
 * - North Island (base 5, peak 6): the Poor Knights Islands are one of
 *   Jacques Cousteau's personal top-10 dive sites in the world — a capped
 *   peak of 6 badly undersells this. Raised to reach the Big Island/Costa
 *   Rica/Maui/Tanzania tier (peak 8).
 * - Papua New Guinea (base 8, peak 9): serious dive publications routinely
 *   name PNG alongside Raja Ampat for some of the least-touristed,
 *   highest-quality reef diving anywhere (Milne Bay muck diving is a
 *   genuine macro-photography pilgrimage). Raised to parity with Thailand/
 *   Okinawa's peak-10 tier.
 */

const KEY = 'diving';

const FIXES: Record<string, number> = {
  borabora: 8,
  'north-island': 7,
  'papua-new-guinea': 9,
};

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

  for (const [id, newBase] of Object.entries(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const before = { base: scoring.base[KEY], monthly: deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY] };
    const patchedScoring = { ...scoring, base: { ...scoring.base, [KEY]: newBase } };
    const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`  ${id}`);
    console.log(`    before: base=${before.base}  peak=${Math.max(...before.monthly).toFixed(1)}  monthly=[${before.monthly.map((v: number) => v.toFixed(0)).join(',')}]`);
    console.log(`    after:  base=${newBase}  peak=${Math.max(...monthly).toFixed(1)}  monthly=[${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      baseScores: { ...(row.baseScores as Record<string, number>), [KEY]: newBase },
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
