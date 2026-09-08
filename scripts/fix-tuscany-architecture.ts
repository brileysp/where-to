import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Tuscany's architecture and history, corrected.
 *
 * The hiking deflation pass dropped Tuscany from rank 37 to 49, breaking
 * its editorial band — and that break was the useful part. Tuscany had been
 * held inside the top 40 by a hiking 9 (walking between hill towns), while
 * Florence's architecture sat at 8 and its history at "strong". The
 * Renaissance began there. The Duomo, Brunelleschi's dome, the Uffizi, the
 * Palazzo Vecchio, Siena's Campo and Pisa are not an 8, and they are not
 * incidental to why anyone goes.
 *
 * Tuscany joins the architecture anchor set in anchors.ts at the same time.
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const [row] = await db.select().from(places).where(eq(places.id, 'tuscany'));
  if (!row) { console.error('no tuscany row'); process.exit(1); }
  const scored = await getAllScoredPlaces();
  const d = scored.find((x) => x.id === 'tuscany')!;

  const monthly = d.monthly.architecture ?? [];
  const raw = (row.sliderCurves as Record<string, unknown>).architecture;
  if (raw === undefined) { console.error('no architecture curve'); process.exit(1); }
  const rescaled = rescaleCurve(parseSliderCurve(raw), Math.min(...monthly), 10);

  const patch = {
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), architecture: rescaled },
    authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), 'architecture'])),
    signatureTier: {
      ...(row.signatureTier as Record<string, unknown>),
      architecture: 'signature',
      historyArchaeology: 'signature',
    },
  };

  console.log(`  architecture ${Math.max(...monthly).toFixed(0)} -> 10, tier -> signature`);
  console.log(`  historyArchaeology tier -> signature (the Renaissance began here)`);
  if (!dryRun) {
    await db.transaction(async (tx) => {
      await tx.update(places)
        .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
        .where(eq(places.id, 'tuscany'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: 'tuscany',
        action: 'update',
        beforeValue: row,
        afterValue: { ...row, ...patch },
      });
    });
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
