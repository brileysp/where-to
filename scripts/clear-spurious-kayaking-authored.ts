import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * 96 destinations had 'kayakingRafting' in authoredCurves despite the
 * slider having zero real sliderEvents anywhere in the catalog — the same
 * spurious-flag pattern found and cleared for fishing. Clearing all of them
 * here; author-kayaking-rafting.ts (run right after this) re-sets the flag
 * correctly for the ~19 destinations that get a real authored event.
 */

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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const KEY = 'kayakingRafting';
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  let cleared = 0;
  for (const row of rows) {
    const authored: string[] = row.authoredCurves ?? [];
    if (!authored.includes(KEY)) continue;
    const next = authored.filter((k) => k !== KEY);
    console.log(`  ${row.id}`);
    if (!dryRun) {
      const after = { ...row, authoredCurves: next };
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ authoredCurves: next, updatedAt: new Date() })
          .where(eq(places.id, row.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: row.id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
    cleared++;
  }
  console.log(`\n${cleared} destinations cleared${dryRun ? ' (dry run — nothing written)' : ''}.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
