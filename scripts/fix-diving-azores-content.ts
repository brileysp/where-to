import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Specialist-lens fix: the original Azores diving content was framed around
 * whale migration passing offshore — but that's whaleWatching's story (and
 * not really "part of the dive" for a boat-based sighting anyway, per the
 * same disclaimer used for Los Cabos' gray whales). The real enthusiast-
 * grade diving product here is cage-free, baited open-water diving with
 * blue sharks (and mako sharks as a real bonus) between Pico and Faial,
 * Jul-Oct — a genuine specialist activity, verified against current
 * operator/season data before writing this.
 */

const KEY = 'diving';
const ID = 'azores';

const OVERVIEW = 'Blue and mako sharks are the real, specific draw here — cage-free, baited dives in open water between Pico and Faial, with sharks passing within a few meters at 5-10m depth. It\'s a genuine specialist product, not a broader reef destination; underwater terrain elsewhere is volcanic rock rather than coral.';

const MONTHLY = [
  'Rougher Atlantic conditions and the least consistent stretch of the year; shark season hasn\'t started.',
  'Rougher Atlantic conditions and the least consistent stretch of the year; shark season hasn\'t started.',
  'Conditions are improving; general diving is good, though shark season hasn\'t started yet.',
  'Conditions are improving; general diving is good, though shark season hasn\'t started yet.',
  'Conditions are improving; general diving is good, though shark season hasn\'t started yet.',
  'Conditions are improving; general diving is good, though shark season hasn\'t started yet.',
  'Blue shark season — cage-free dives reliably find sharks between Pico and Faial, with mako sharks a real possibility. The clearest water and best conditions of the year.',
  'Blue shark season — cage-free dives reliably find sharks between Pico and Faial, with mako sharks a real possibility. The clearest water and best conditions of the year.',
  'Blue shark season — cage-free dives reliably find sharks between Pico and Faial, with mako sharks a real possibility. The clearest water and best conditions of the year.',
  'Blue shark season — cage-free dives reliably find sharks between Pico and Faial, with mako sharks a real possibility. The clearest water and best conditions of the year.',
  'Rougher conditions return, and shark season has ended for the year.',
  'Rougher conditions return, and shark season has ended for the year.',
];

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
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
  return env;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const [row] = await db.select().from(places).where(eq(places.id, ID));
  if (!row) { console.error('not found'); process.exit(1); }
  if (MONTHLY.length !== 12) { console.error('monthly array is not length 12'); process.exit(1); }
  const patch: Record<string, unknown> = {
    sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEW },
    sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY },
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
