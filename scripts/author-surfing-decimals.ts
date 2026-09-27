import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Surfing de-flattening pass (docs/interest-content-authoring-
// playbook.md §2). Like windSports, most of this catalog's shared-
// text/sloping-score pattern is a deliberate, physically-motivated
// convention (one sentence narrating a continuous seasonal taper) and
// was left alone. Two real classes of issue were found and fixed here:
//
//  1. Three destinations claimed a wide flat-10.0 plateau that
//     contradicts their OWN text's internal phase distinctions:
//     - bali: 7 straight months at 10.0 (Apr-Oct). Only May-Sep
//       actually share identical "at their best" text; Apr ("dry
//       season begins") and Oct ("winding down, still excellent")
//       already have their own distinct, lesser-claiming text, yet
//       were tied to the exact same literal max. Tapered the shared
//       May-Sep block down to 9.7 (still effectively peak, no longer
//       claiming a literal, 5-months-wide maximum) and stepped Apr/Oct
//       down further to match their own honest, lesser text.
//     - lisbon (Ericeira/Nazaré): 6 months at 10.0. Jan/Feb/Nov/Dec
//       share one "real peak season" sentence and keep the true 10.0
//       — Nazaré is the most famous big-wave arena in the world, this
//       is a defensible top-tier claim. But March ("continues, same
//       caveats as the peak winter months") and October ("swell
//       building again") already use distinctly lesser language and
//       were nonetheless tied to the identical literal max — real
//       bug. Tapered to match their own text.
//     - maui (Ho'okipa/Jaws): 5 months at 10.0. Jan/Feb/Nov/Dec share
//       the full "winter north swell...Jaws is a watch-only spectacle"
//       framing and keep 10.0. March's text is the shorter, lesser
//       "continues, same caveats as the peak winter months" — same
//       bug as Lisbon's March, same fix.
//  2. Plain same-text/different-score bugs, no real basis found:
//     - ghana: April and August share the identical "a brief better
//       window within the wetter stretch" sentence but scored 3.5 vs 4.
//     - jamaica: July and August share the identical "brief better
//       window within hurricane season" sentence but scored 1.7 vs 0.6
//       — a real, unexplained gap on identical text.
//     - belize: June/July share one sentence at 0.85 and August/
//       September/October share the SAME identical sentence at 0.3 —
//       a two-tier split hiding inside one unbroken run of identical
//       text, unlike this catalog's other hurricane-season destinations
//       (Bahamas, Turks & Caicos, Havana), which all change the
//       sentence itself when the score level shifts.
const KEY = 'surfing';

const FIXES: Record<string, Record<number, number>> = {
  bali: { 3: 9, 4: 9.7, 5: 9.7, 6: 9.7, 7: 9.7, 8: 9.7, 9: 8.8 },
  lisbon: { 2: 8.5, 9: 7.5 },
  maui: { 2: 8.5 },
  ghana: { 3: 4 },
  jamaica: { 6: 1.2, 7: 1.2 },
  belize: { 5: 0.6, 6: 0.6, 7: 0.6, 8: 0.6, 9: 0.6 },
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const ids = Object.keys(FIXES);
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const scored = scorePlace(row);
    const live = scored.monthly[KEY];

    const finalOverride: Record<number, number> = { ...(scoreOverridesBefore[KEY] || {}) };
    let changedCount = 0;
    for (const [idxStr, val] of Object.entries(FIXES[id])) {
      const idx = Number(idxStr);
      if (live[idx] !== val) changedCount++;
      finalOverride[idx] = val;
    }

    const patch: Record<string, unknown> = {
      scoreOverrides: { ...scoreOverridesBefore, [KEY]: finalOverride },
    };

    console.log(`\n${row.name} (${id}) — ${changedCount} scores changed`);
    for (const [idxStr, val] of Object.entries(FIXES[id])) {
      const idx = Number(idxStr);
      if (live[idx] !== val) console.log(`  ${MONTH_NAMES[idx].padEnd(10)} ${live[idx]} -> ${val}`);
    }

    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
  }

  console.log(dryRun ? '\n\ndry run — nothing written.' : '\n\ndone — written to scoreOverrides.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
