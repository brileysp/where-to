import { readFileSync } from 'fs';
import { join } from 'path';
import { desc, eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * One-time revert for scripts/smooth-hiking-family-curves.ts's first
 * (buggy) run.
 *
 * That run's fitMonthlyToCurve only ever anchored the FIRST occurrence of a
 * tied global max/min — a real gap in the core algorithm, now fixed in
 * fitCurve.ts. Under the loosened tolerance this script used, a second
 * tied peak month could drift by up to the tolerance without being
 * flagged. It did: Zion & Bryce's scenicLandscapes was 9.0 in both April
 * and October; the run rendered October as 8.3, and that alone flipped
 * which month won the destination's default ranking (a 29-rank drop, the
 * only real mover out of 200 destinations — everything else moved by at
 * most 2, pure noise).
 *
 * IDENTIFYING THE RUN'S OWN ROWS: not "the most recent write per
 * destination" — that was the first version of this script, and it was
 * wrong. A destination the smoothing run never touched (already smooth,
 * skipped) can still show its most-recent row as some EARLIER, entirely
 * legitimate change from earlier in this same session that also happened
 * to touch a hiking-family key — reverting that would silently discard
 * real, already-verified work, not undo the bug.
 *
 * The smoothing run's writes are instead identified by TIME: audit log
 * rows are written newest-first, and a single script invocation produces a
 * tight, contiguous cluster of timestamps. Scanning back from the newest
 * row, the moment the gap between two consecutive rows exceeds
 * CLUSTER_GAP_MS, everything scanned so far is the run and everything
 * after it is not. Verified against this actual database before writing
 * any code against it: the true cluster is exactly 92 rows, then a
 * 37,642-second (10.4 hour) gap to the next-older row — and the naive
 * "most recent per destination" heuristic had already produced 99, seven
 * of them destinations the smoothing run never touched at all.
 *
 * Then scripts/smooth-hiking-family-curves.ts is re-run against the
 * restored originals, this time with the corrected algorithm.
 */
const CLUSTER_GAP_MS = 5 * 60 * 1000; // 5 minutes — the run took well under this

const HIKING_FAMILY = [
  'hiking', 'mountaineering', 'cyclingRoad', 'mountainBiking', 'adventureSports',
  'golf', 'fishing', 'horsebackRiding', 'trailRunning', 'scenicLandscapes',
  'landscapePhotography', 'nationalParks', 'campingBackcountry', 'geologyVolcanoes',
  'roadtrip',
];

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = value;
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  // Find the exact cluster of rows the smoothing run wrote, by time gap —
  // see the doc comment above for why this replaces the original
  // "most recent row per destination" approach.
  // A smaller limit than you might expect for "find ~92 rows": each row
  // carries two full JSON snapshots of a destination (beforeValue/
  // afterValue), and 500 of those in one response was enough to trip the
  // pooler's own limit (CONNECTION_CLOSED, reproducibly) — 150 comfortably
  // covers the expected cluster with room to confirm the gap.
  const recent = await db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.entityType, 'destination'))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(150);
  const cluster: typeof recent = [];
  for (let i = 0; i < recent.length; i++) {
    if (i > 0) {
      const gapMs = recent[i - 1].createdAt.getTime() - recent[i].createdAt.getTime();
      if (gapMs > CLUSTER_GAP_MS) break;
    }
    cluster.push(recent[i]);
  }
  console.log(`Identified a ${cluster.length}-row write cluster as the smoothing run (gap-scanned from the newest row).`);
  if (cluster.length === 0) { console.error('No recent cluster found — refusing to guess.'); process.exit(1); }

  const clusterIds = new Set(cluster.map((r) => r.entityId));
  const rows = await db.select().from(places).where(inArray(places.id, [...clusterIds]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  let reverted = 0;
  let inspected = 0;

  for (const auditRow of cluster) {
    const row = byId.get(auditRow.entityId);
    if (!row || auditRow.action !== 'update' || !auditRow.beforeValue || !auditRow.afterValue) continue;
    inspected++;

    const before = (auditRow.beforeValue as Record<string, unknown>).sliderCurves as Record<string, unknown> | undefined;
    const after = (auditRow.afterValue as Record<string, unknown>).sliderCurves as Record<string, unknown> | undefined;
    if (!before || !after) continue;

    const touchedKeys = HIKING_FAMILY.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    if (touchedKeys.length === 0) continue;

    const beforeAuthored = new Set(((auditRow.beforeValue as Record<string, unknown>).authoredCurves as string[] | undefined) ?? []);
    const currentAuthored = (row.authoredCurves ?? []) as string[];
    const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>) };
    for (const key of touchedKeys) sliderCurves[key] = before[key];
    const authoredCurves = currentAuthored.filter((k) => !touchedKeys.includes(k) || beforeAuthored.has(k));

    console.log(`  ${row.id.padEnd(24)} reverting ${touchedKeys.join(', ')}`);
    if (!dryRun) {
      const patch = { sliderCurves, authoredCurves };
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, row.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: row.id,
          action: 'update',
          beforeValue: row,
          afterValue: { ...row, ...patch },
        });
      });
    }
    reverted++;
  }

  console.log(`\n${inspected} destinations inspected, ${reverted} reverted.`);
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
