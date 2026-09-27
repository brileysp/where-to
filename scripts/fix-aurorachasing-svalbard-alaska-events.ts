import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Two real scoring bugs found while surveying `auroraChasing` (see
 * docs/interest-content-authoring-playbook.md §5 — fix before/alongside content):
 *
 * 1. Svalbard (base 9) had no event for Apr-Sep, so those months fell through to the
 *    culture-formula's plain dry/wet fallback and inherited the full base-9 score —
 *    even May/Jun/Jul, when Svalbard has 24-hour midnight sun (Apr 20 - Aug 23) and
 *    the aurora is *physically impossible to see regardless of activity*. Verified:
 *    en.visitsvalbard.com, visitnorway.com.
 * 2. Southeast Alaska (base 5, no event at all) fell through to the same fallback,
 *    which happens to reward the region's "dry" months — which are summer, when
 *    Southeast AK also has near-continuous light. Real season is the opposite:
 *    Sep-Mar, best at the equinoxes. Verified: explorefairbanks/alaska.org/beyondak
 *    (regular 30-80 nights/yr at Juneau's 61° magnetic latitude, Kp4+ needed, ~70%
 *    cloud cover — genuinely modest, not apex-tier, hence the moderate weights below).
 */

const FIXES: Record<string, { label: string; weight: number; months: Record<number, number> }[]> = {
  svalbard: [
    { label: 'Aurora season', weight: 7, months: { 1: 1, 2: 1, 3: 1, 10: 1, 11: 1, 12: 1 } }, // unchanged, existing event
    { label: 'Midnight sun — no darkness for the aurora', weight: -9, months: { 4: 0.5, 5: 1, 6: 1, 7: 1, 8: 0.5 } },
  ],
  'southeast-alaska': [
    { label: 'Long dark nights, equinox activity boost', weight: 3, months: { 9: 1, 10: 0.7, 3: 1 } },
    { label: 'Regular winter viewing season', weight: 2, months: { 11: 1, 12: 1, 1: 1, 2: 1 } },
    { label: 'Near-continuous summer light — not a realistic viewing window', weight: -4, months: { 4: 0.5, 5: 1, 6: 1, 7: 1, 8: 0.5 } },
  ],
};

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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');

  for (const id of Object.keys(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const before = deriveDestinationScores(toScoringPlace(row), { skipHazards: true }).monthly.auroraChasing as number[];
    const patch = { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), auroraChasing: FIXES[id] } };
    const afterRow = { ...row, ...patch };
    const after = deriveDestinationScores(toScoringPlace(afterRow as typeof row), { skipHazards: true }).monthly.auroraChasing as number[];
    console.log(`${id}:\n  before [${before.join(',')}]\n  after  [${after.join(',')}]`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: afterRow });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
