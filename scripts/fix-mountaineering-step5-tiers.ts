import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

// Mountaineering Step 5 (specialist-lens review) tier corrections, applied as
// score-only shifts on the already-authored scoreOverrides so every text group
// keeps its shared score. Text is untouched except Cornwall, whose Chair Ladder
// closure note named a specific buttress that the research did not support.
//  - paris:       Fontainebleau peak 9.8 -> 9.6 (bouldering world centre, but not the 10-list)
//  - joshua-tree: 9.5 -> 9.0 (below Squamish / Indian Creek)
//  - tanzania:    Kilimanjaro is a trek, 9.4 -> 8.9
//  - mendoza:     Aconcagua is a non-technical expedition, 9.6 -> 9.1
//  - ecuadorian-andes: Cotopaxi/Cayambe are non-technical glacier climbs, 9.3 -> 8.7
//  - barcelona:   Siurana/Margalef/Montserrat are top-tier sport/multipitch, 8.6 -> 9.0
//  - thailand:    Railay is iconic but only ~380 routes, 9.0 -> 8.6
//  - snowdonia / lake-district: mountain trad heritage sits above sea-cliff trad (+0.8)
const KEY = 'mountaineering';
type Fn = (s: number, i: number) => number;
const r1 = (x: number) => Math.round(x * 10) / 10;
const TRANSFORMS: Record<string, Fn> = {
  paris: (s) => (s >= 9 ? r1(s - 0.2) : s),
  'joshua-tree': (s) => (s >= 8.3 ? r1(s - 0.5) : s),
  tanzania: (s) => (s >= 8.4 ? r1(s - 0.5) : s),
  mendoza: (s) => (s >= 7.4 ? r1(s - 0.5) : s),
  'ecuadorian-andes': (s) => (s >= 8.2 ? r1(s - 0.6) : s),
  barcelona: (s) => (s >= 8.0 ? r1(s + 0.4) : s),
  thailand: (s) => (s >= 7.4 ? r1(s - 0.4) : s),
  snowdonia: (s, i) => (i >= 2 && i <= 8 ? r1(s + 0.8) : i === 9 ? r1(s + 0.4) : s),
  'lake-district': (s, i) => (i >= 2 && i <= 8 ? r1(s + 0.8) : i === 9 ? r1(s + 0.4) : s),
};
const OLD_COR = 'Sea-cliff climbing is in season, though some cliffs, such as Chair Ladder’s Bishop’s Buttress, are closed for nesting until the end of June.';
const NEW_COR = 'Sea-cliff climbing is in season, though some cliffs, such as at Chair Ladder, have nesting restrictions until the end of June.';

function env(): string {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  return raw.split('\n').find((l) => l.startsWith('DATABASE_URL='))!.slice(13).replace(/^["']|["']$/g, '');
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzle(postgres(env(), { prepare: false }));
  const ids = [...Object.keys(TRANSFORMS), 'cornwall'];
  for (const id of ids) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(id + ' not found'); process.exit(1); }
    const so = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const before = Array.from({ length: 12 }, (_, i) => so[KEY][i]);
    const fn = TRANSFORMS[id];
    const after = fn ? before.map((s, i) => fn(s, i)) : before;
    const patch: Record<string, unknown> = {};
    if (fn) patch.scoreOverrides = { ...so, [KEY]: Object.fromEntries(after.map((s, i) => [i, s])) };
    if (id === 'cornwall') {
      const tx = (row.sliderMonthlyWeather as Record<string, string[]>)[KEY];
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as object), [KEY]: tx.map((t) => (t === OLD_COR ? NEW_COR : t)) };
    }
    console.log(`${id}: ${before.join(' ')}\n${' '.repeat(id.length)}  ${after.join(' ')}${id === 'cornwall' ? '  (text fix)' : ''}`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: { ...row, ...patch },
        });
      });
    }
  }
  console.log(dryRun ? 'dry run' : 'written');
  process.exit(0);
})();
