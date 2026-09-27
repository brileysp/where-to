import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Windsurfing & Kitesurfing de-flattening pass (docs/interest-content-
// authoring-playbook.md §2). This catalog was already exceptionally
// well authored: the "identical text, sloping score" pattern that was
// a bug elsewhere in this project (Chilean Lake District, hotSprings)
// is here a deliberate, catalog-wide, physically-motivated convention
// — one shared sentence describing a genuinely continuous seasonal
// taper (trade winds weakening, a storm season building) — and is left
// alone rather than flattened.
//
// The one real over-claiming problem: SEVEN different destinations
// each independently claimed a flat, literal 10.0 across 3 months —
// Andalucia (Tarifa), Canary Islands (Fuerteventura/Sotavento), Aruba,
// Maui, Mauritius, Morocco (Essaouira), plus Cape Town's Jan/Feb/Dec.
// Not all 7 can genuinely be a top-5-in-the-world spot for the same
// activity. Real-world research this session: Tarifa, Maui, Cape Town,
// and Fuerteventura are the destinations consistently named together
// as the sport's actual top tier across multiple rankings (Red Bull,
// Mystic Boarding, GetYourGuide) — those four keep their true 10.0.
// Aruba, Mauritius, and Essaouira are real, excellent, globally known
// spots that show up on broader top-10/11 lists but are consistently
// described a tier below that group — tapered down to 9.5-9.7. Text
// is untouched everywhere: none of it makes an overclaiming "best in
// the world" claim that needs rewriting, this is a pure score fix.
const KEY = 'windSports';

const FIXES: Record<string, Record<number, number>> = {
  aruba: { 5: 9.6, 6: 9.6, 7: 9.6 }, // Jun/Jul/Aug: 10 -> 9.6
  mauritius: { 5: 9.7, 6: 9.7, 7: 9.7 }, // Jun/Jul/Aug: 10 -> 9.7
  morocco: { 6: 9.5, 7: 9.5, 8: 9.5 }, // Jul/Aug/Sep: 10 -> 9.5
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
