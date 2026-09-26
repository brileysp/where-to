import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';

// Birding de-flattening pass, part 1 (docs/interest-content-authoring-
// playbook.md §2): 30 destinations where a SINGLE identical sentence
// spans 10-12 months yet the score swings 2-5 points with nothing in
// the text to justify it (e.g. Southeast Alaska: [2,2,2,2,6,6,6,3,2,2,
// 2,2] under one unchanging "bald eagles... present" sentence). This
// is the same curve-interpolation-noise pattern found throughout this
// session, just larger-magnitude here — mechanically flattened to
// each group's own rounded mean, since identical text can only ever
// justify one score, and no case-by-case judgment is needed for a
// flatten this objectively grounded. Antarctica was excluded from this
// batch (handled separately in author-birding-mecca.ts) because its
// swing isn't noise — it conflates a real hard constraint (no ships
// sail Apr-Oct) with a quality judgment, which a mean would erase
// rather than fix.
const KEY = 'birding';

const CANDIDATES: { id: string; idxs: number[]; mean: number }[] = [
  { id: 'mexicocity', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 3.9 },
  { id: 'azores', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 7 },
  { id: 'southeast-alaska', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 3.1 },
  { id: 'vancouver-island', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 3.4 },
  { id: 'glacier-waterton', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.5 },
  { id: 'banff', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.5 },
  { id: 'torres-del-paine', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.8 },
  { id: 'tierra-del-fuego', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 1.8 },
  { id: 'acadia', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.5 },
  { id: 'argentine-lake-district', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.8 },
  { id: 'yellowstone', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 3.5 },
  { id: 'denali-interior', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 1.6 },
  { id: 'upper-peninsula', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.5 },
  { id: 'yosemite', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2 },
  { id: 'singapore', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 4.3 },
  { id: 'canaries', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.5 },
  { id: 'gbr', idxs: [0,1,2,3,4,5,6,7,9,10,11], mean: 6.2 },
  { id: 'madeira', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2 },
  { id: 'mallorca', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 3.2 },
  { id: 'el-chalten', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 1.8 },
  { id: 'dubai', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 3.3 },
  { id: 'nova-scotia', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.5 },
  { id: 'great-smoky-mountains', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.8 },
  { id: 'olympic', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2 },
  { id: 'badlands-black-hills', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.5 },
  { id: 'uluru', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.8 },
  { id: 'bangkok', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 3.6 },
  { id: 'chilean-lake-district', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 2.4 },
  { id: 'oaxaca', idxs: [0,1,2,3,4,5,6,7,8,9,10,11], mean: 5.9 },
];

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

  const ids = CANDIDATES.map((c) => c.id);
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const c of CANDIDATES) {
    const row = byId.get(c.id);
    if (!row) { console.error(`${c.id}: not found`); process.exit(1); }

    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const scored = scorePlace(row);
    const live = scored.monthly[KEY];

    const finalOverride: Record<number, number> = { ...(scoreOverridesBefore[KEY] || {}) };
    let changedCount = 0;
    for (const idx of c.idxs) {
      if (live[idx] !== c.mean) changedCount++;
      finalOverride[idx] = c.mean;
    }

    const patch: Record<string, unknown> = {
      scoreOverrides: { ...scoreOverridesBefore, [KEY]: finalOverride },
    };

    console.log(`${row.name} (${c.id}) — ${changedCount} months flattened to ${c.mean}`);

    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, c.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: c.id,
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
