import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * scripts/audit-birding-model.ts scores birding from first principles
 * (species count on a log curve, endemism, charisma, a spectacle bonus)
 * and flags where the catalog disagrees — comparing its model score
 * against `actual = Math.max(monthly.birding)`, i.e. PEAK, not base.
 *
 * All 16 of these destinations use the birdingPeak fallback (no real
 * sliderEvents.birding), so with the just-fixed +3 fallback bonus, target
 * peak = newBase + 3 whenever birdingPeak is flagged (confirmed present
 * for all 16). newBase = round(model) - 3.
 *
 * Three of the OVER-scored destinations (uyuni, canaries, yellowstone)
 * also carried a sliderCaps.birding entry — almost certainly a defensive
 * patch for the old +7 fallback bug rather than a deliberate ceiling;
 * removed since it's now inert (their corrected base+3 sits well under
 * the old cap) and would otherwise read as an unexplained leftover.
 *
 * Morocco is the one destination here with REAL authored events (Spring/
 * Autumn passage, weight 2.5 each) — its sliderCaps.birding: 6 was
 * silently capping those events down to flat 6 all year, suppressing
 * legitimately good content. Removed the cap and tuned the event weight
 * down slightly (2.5 -> 2.0) so the real events land on the model's own
 * target peak (~8) instead of overshooting to 9.
 */

const KEY = 'birding';

const FALLBACK_CORRECTIONS: { id: string; newBase: number; model: number; removeCap?: boolean }[] = [
  { id: 'azores', newBase: 0, model: 2.9 },
  { id: 'svalbard', newBase: 1, model: 3.9 },
  { id: 'uyuni', newBase: 2, model: 4.9, removeCap: true },
  { id: 'maldives', newBase: 0, model: 3.2 },
  { id: 'canaries', newBase: 1, model: 4.4, removeCap: true },
  { id: 'madeira', newBase: 1, model: 3.5 },
  { id: 'yellowstone', newBase: 3, model: 5.5, removeCap: true },
  { id: 'north-island', newBase: 5, model: 8.1 },
  { id: 'milford-sound-fiordland', newBase: 5, model: 7.7 },
  { id: 'sydney', newBase: 4, model: 7.2 },
  { id: 'nepal', newBase: 5, model: 7.8 },
  { id: 'oaxaca', newBase: 5, model: 7.7 },
  { id: 'ghana', newBase: 6, model: 8.7 },
  { id: 'kerala', newBase: 5, model: 7.5 },
  { id: 'monterey-big-sur', newBase: 4, model: 6.5 },
  { id: 'taiwan', newBase: 6, model: 8.5 },
];

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try { raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8'); } catch { return out; }
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
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  console.log('Fallback-based corrections (base only — curve refit happens in refit-birding-from-raw.ts):');
  for (const e of FALLBACK_CORRECTIONS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const oldBase = (row.baseScores as Record<string, number>)[KEY];
    const patch: Record<string, unknown> = { baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: e.newBase } };
    if (e.removeCap) {
      const caps = { ...(row.sliderCaps as Record<string, unknown>) };
      delete caps[KEY];
      patch.sliderCaps = caps;
    }
    const scoring = toScoringPlace({ ...row, ...patch } as typeof row);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    console.log(`  ${e.id.padEnd(24)} base ${oldBase} -> ${e.newBase}  model=${e.model}  new peak=${Math.max(...monthly[KEY]).toFixed(1)}${e.removeCap ? '  (cap removed)' : ''}`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: e.id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  console.log('\nMorocco (real events, cap was suppressing them):');
  {
    const [row] = await db.select().from(places).where(eq(places.id, 'morocco'));
    const events = (row.sliderEvents as any)[KEY].map((e: any) => ({ ...e, weight: 2.0 }));
    const caps = { ...(row.sliderCaps as Record<string, unknown>) };
    delete caps[KEY];
    const patch = { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events }, sliderCaps: caps };
    const scoring = toScoringPlace({ ...row, ...patch } as typeof row);
    const { monthly } = deriveDestinationScores(scoring, { skipHazards: true });
    console.log(`  morocco                  events weight 2.5 -> 2.0, cap removed  new peak=${Math.max(...monthly[KEY]).toFixed(1)}  model=7.6`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, 'morocco'));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'morocco',
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone. Curves NOT refit yet — run refit-birding-from-raw.ts next.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
