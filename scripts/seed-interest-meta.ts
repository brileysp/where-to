import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { interestMeta } from '../src/lib/db/schema';
import { SLIDERS } from '../src/lib/scoring/constants';

/**
 * One-time seed: gives every slider key a row in interest_meta so the
 * admin Interests catalog screen's writes (via applyAdminEdits, which is
 * update-only, not upsert) always have a row to update. `emoji: null`
 * means "no override yet" — getInterestEmoji() falls back to the
 * code-defined SLIDERS[key].icon until an admin actually changes it.
 */

const ENV_LOCAL_PATH = join(__dirname, '..', '.env.local');

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(ENV_LOCAL_PATH, 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = loadDotEnvLocal();
  const supabaseUrl = env.DATABASE_URL;
  if (!supabaseUrl) {
    console.error('No DATABASE_URL found in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const db = drizzlePostgres(postgres(supabaseUrl, { prepare: false }));

  let created = 0;
  let skipped = 0;
  for (const slider of SLIDERS) {
    const existing = await db.select().from(interestMeta).where(eq(interestMeta.key, slider.key));
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    console.log(`  ${dryRun ? '[dry-run] ' : ''}seeding ${slider.key}`);
    if (!dryRun) await db.insert(interestMeta).values({ key: slider.key, emoji: null });
    created++;
  }
  console.log(`${dryRun ? '[dry-run] Would create' : 'Created'} ${created} interest_meta rows (${skipped} already existed) of ${SLIDERS.length} sliders.`);
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
