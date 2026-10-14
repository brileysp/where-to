// Applies owner-approved smoothing proposals (10 Oct 2026, "buckets 1 and 2") to live curves: for each {id, key, proposed[12]} it refits the
// curve through the proposed monthly values, makes sure the interest is listed in authoredCurves (so a later admin save does not refit it
// away), and writes with an audit row. Usage: npx tsx scripts/apply-smoothing-buckets.ts <proposals.json> [--dry-run]
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
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
  const file = process.argv[2];
  if (!file) throw new Error('Pass the proposals JSON path');
  const dryRun = process.argv.includes('--dry-run');
  const env = loadDotEnvLocal();
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const proposals = Object.entries(JSON.parse(readFileSync(file, 'utf8')) as Record<string, { id: string; key: string; bucket: string; live: number[]; proposed: number[] }>).filter(([, v]) => v.bucket !== 'leave');
  let worst = 0;
  for (const [label, p] of proposals) {
    const [row] = await db.select().from(places).where(eq(places.id, p.id));
    if (!row) throw new Error(`No place ${p.id}`);
    const curves = row.sliderCurves as Record<string, unknown>;
    const nowLive = Array.from({ length: 12 }, (_, i) => Math.round(curveValue(i + 1, parseSliderCurve(curves[p.key])) * 10) / 10);
    // Safety: the live curve must still be what the proposal was computed from.
    const drift = Math.max(...nowLive.map((v, i) => Math.abs(v - p.live[i])));
    if (drift > 0.05) { console.log(`SKIP ${label}: live curve changed since the proposal (max difference ${drift.toFixed(1)})`); continue; }
    const fit = fitMonthlyToCurve(p.proposed, { maxSteepness: 6, errorTolerance: 0.1 });
    const refit = Array.from({ length: 12 }, (_, i) => Math.round(curveValue(i + 1, fit.curve) * 10) / 10);
    const err = Math.max(...refit.map((v, i) => Math.abs(v - p.proposed[i])));
    worst = Math.max(worst, err);
    console.log(`${label.padEnd(34)} ${p.key.padEnd(16)} live ${nowLive.map((v) => v.toFixed(1)).join(' ')}\n${''.padEnd(51)}now  ${refit.map((v) => v.toFixed(1)).join(' ')}  (fit error ${err.toFixed(2)}, ${fit.anchorCount} anchors)`);
    if (!dryRun) {
      const authored = Array.from(new Set([...(row.authoredCurves ?? []), p.key]));
      const patch = { sliderCurves: { ...curves, [p.key]: fit.curve }, authoredCurves: authored };
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, p.id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: p.id, action: 'update', beforeValue: row, afterValue: afterRow });
      });
    }
  }
  console.log(`\n${dryRun ? 'dry run, nothing written' : 'written'}; worst fit error ${worst.toFixed(2)}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
