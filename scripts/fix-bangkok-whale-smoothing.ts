// Smooths Bangkok's whale watching curve (owner approved, 10 Oct 2026): the live curve had two-month blocks on its slope
// (4.4, 4.4 then 3.8, 3.8). Uses src/lib/gemini/smooth-scores.ts on the live monthly values (text-aware), refits the curve,
// and writes it with an audit row. Usage: npx tsx scripts/fix-bangkok-whale-smoothing.ts [--dry-run]
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';
const ID = process.argv.find((a) => a.startsWith('--id='))?.slice(5) ?? 'bangkok';

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
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) throw new Error('No DATABASE_URL');
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { smoothBlockyScores, isBlocky } = await import('../src/lib/gemini/smooth-scores');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const [row] = await db.select().from(places).where(eq(places.id, ID));
  if (!row) throw new Error(`No place ${ID}`);
  const curve = parseSliderCurve((row.sliderCurves as Record<string, unknown>)[KEY]);
  const live = Array.from({ length: 12 }, (_, i) => Math.round(curveValue(i + 1, curve) * 10) / 10);
  const texts = ((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] ?? []).map((t) => t ?? '');
  if (!isBlocky(live)) { console.log('Not blocky; nothing to do.'); process.exit(0); }
  const smoothed = smoothBlockyScores(live, texts.length === 12 ? texts : undefined);
  const fit = fitMonthlyToCurve(smoothed, { maxSteepness: 6, errorTolerance: 0.25 });
  const refit = Array.from({ length: 12 }, (_, i) => Math.round(curveValue(i + 1, fit.curve) * 10) / 10);
  console.log(row.name);
  console.log('live     :', live.map((v) => v.toFixed(1)).join(' '));
  console.log('smoothed :', smoothed.map((v) => v.toFixed(1)).join(' '));
  console.log('refit    :', refit.map((v) => v.toFixed(1)).join(' '), ` (max error ${fit.maxError.toFixed(2)}, ${fit.anchorCount} anchors)`);
  if (!dryRun) {
    const patch = { sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve } };
    const afterRow = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, ID));
      await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: ID, action: 'update', beforeValue: row, afterValue: afterRow });
    });
  }
  console.log(dryRun ? '\ndry run, nothing written' : '\ndone');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
