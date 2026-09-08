import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Brings the spectacle-carried birding peaks down to what the component
 * model supports (see audit-birding-model.ts).
 *
 * Species count is 50% of that model, endemism and charisma 25% each, and
 * spectacle a bonus of up to 25% ON TOP rather than a fourth additive term.
 * A multiplier can lift a rich destination further; it cannot carry a
 * fifty-species island to the top of the scale. Every destination here was
 * being carried by spectacle alone, or — in Denali's and Tierra del Fuego's
 * case — by nothing identifiable at all.
 *
 * The Faroes appear twice in this branch's history, which is the argument
 * for having a model at all: they were notched 9 -> 7 by eye against
 * Tanzania a few commits ago, and the components put them at 3.8. Judging a
 * single destination against a single neighbour got the direction right and
 * the distance wrong.
 *
 * Iceland is included on the strength of a separate agreement, and after
 * its own components were corrected upward (charisma 8 -> 10, uniqueness
 * 2 -> 4 for Myvatn's Barrow's goldeneye) — it models at 5.6, so it takes
 * a notch rather than the cut its neighbours need.
 *
 * Nothing here is an anchor destination, so anchors.ts is untouched. Each
 * curve keeps its authored floor and seasonal shape; only the ceiling moves.
 */

const PEAKS: { id: string; peak: number; model: number; why: string }[] = [
  { id: 'antarctica', peak: 6, model: 5.6, why: 'roughly twenty species; penguins carry it and cannot carry it that far' },
  { id: 'falklands', peak: 6, model: 6.3, why: 'true endemics and five penguin species, on a very short list' },
  { id: 'iceland', peak: 6, model: 5.6, why: 'a notch, not a cut — see the corrected components' },
  { id: 'faroe-islands', peak: 4, model: 3.8, why: 'a previous by-eye notch to 7 was still 3.3 above the components' },
  { id: 'lofoten', peak: 4, model: 4.3, why: 'thinner than Iceland on every axis except the cliffs' },
  { id: 'denali-interior', peak: 4, model: 3.8, why: 'no claim on any axis — c3 u2 ch6 sp3, and no spectacle defence' },
  { id: 'tierra-del-fuego', peak: 4, model: 4.3, why: 'no claim on any axis' },
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
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  for (const e of PEAKS) {
    const row = byId.get(e.id);
    if (!row) { console.error(`${e.id}: not a primary destination`); process.exit(1); }
    const monthly = scored.find((x) => x.id === e.id)!.monthly.birding ?? [];
    const was = Math.max(...monthly);
    const floor = Math.min(...monthly);
    const raw = (row.sliderCurves as Record<string, unknown>).birding;
    if (raw === undefined) { console.error(`${e.id}: no birding curve`); process.exit(1); }

    // Keep the authored floor unless the new ceiling drops below it.
    const rescaled = rescaleCurve(parseSliderCurve(raw), Math.min(floor, e.peak), e.peak);
    const patch = {
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), birding: rescaled },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), 'birding'])),
    };

    console.log(`  ${e.id.padEnd(20)} ${was.toFixed(0)} -> ${e.peak}  (model ${e.model})   ${e.why}`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: e.id,
          action: 'update',
          beforeValue: row,
          afterValue: { ...row, ...patch },
        });
      });
    }
    byId.set(e.id, { ...row, ...patch } as typeof row);
  }

  console.log(dryRun ? `\ndry run — ${PEAKS.length} would change.` : `\ndone: ${PEAKS.length} reshaped.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
