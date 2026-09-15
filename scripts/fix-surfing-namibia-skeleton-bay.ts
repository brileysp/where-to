import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Specialist-lens review (playbook Step 5) caught a content-quality gap
 * (not a score problem): the batch3 overview described Namibia's surf
 * generically ("real, powerful desert-coast surf... near Swakopmund")
 * without naming Skeleton Bay, a real, specific, legendarily good
 * sand-bottom left-hander near Walvis Bay — among the longest barrels on
 * Earth (documented rides approaching a minute, and Koa Smith's record run
 * of nearly two minutes across eight barrels). This is exactly the kind
 * of "exciting, recognizable, real" specific fact the playbook's voice
 * rules call for. Score is untouched — peak stays 3, still genuinely
 * secondary to the wildlife/dunes this destination is known for; access to
 * Skeleton Bay is itself a real reason it doesn't score higher (remote,
 * inconsistent, serious-surfer-only).
 */

const KEY = 'surfing';
const ID = 'namibia';

const NEW_OVERVIEW = 'Skeleton Bay, near Walvis Bay, is a real, legendary sand-bottom left-hander — among the longest, most perfect barrels on Earth, with documented rides lasting close to a minute. It\'s genuinely secondary to the wildlife and dunes this destination is known for: the wave is remote, inconsistent, and cold (the Benguela current keeps water temperatures low year-round), so it draws serious specialists rather than casual surfers.';

const NEW_MONTHLY = [
  'The least workable stretch of the year.', 'The least workable stretch of the year.', 'The least workable stretch of the year.',
  'A transitional month.',
  'The season\'s best window for Skeleton Bay\'s barrels, cold Benguela-current water throughout.', 'The season\'s best window for Skeleton Bay\'s barrels, cold Benguela-current water throughout.', 'The season\'s best window for Skeleton Bay\'s barrels, cold Benguela-current water throughout.', 'The season\'s best window for Skeleton Bay\'s barrels, cold Benguela-current water throughout.', 'The season\'s best window for Skeleton Bay\'s barrels, cold Benguela-current water throughout.', 'The season\'s best window for Skeleton Bay\'s barrels, cold Benguela-current water throughout.',
  'A transitional month.',
  'The least workable stretch of the year.',
];

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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const [row] = await db.select().from(places).where(eq(places.id, ID));
  if (!row) { console.error(`${ID}: not found`); process.exit(1); }
  if (NEW_MONTHLY.length !== 12) { console.error('monthly array is not length 12'); process.exit(1); }
  const patch: Record<string, unknown> = {
    sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: NEW_OVERVIEW },
    sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, string[]>), [KEY]: NEW_MONTHLY },
  };
  console.log(`  ${ID}`);
  if (!dryRun) {
    const after = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, ID));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: ID,
        action: 'update', beforeValue: row, afterValue: after,
      });
    });
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
