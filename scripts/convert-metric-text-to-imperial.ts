// Turns metric figures and Celsius in stored text into the stored US form (13 Oct 2026, owner request): km -> miles, m -> ft, km/h -> mph,
// km² -> sq mi, °C -> °F. Text is stored once in US units; the visitor's home country decides what they see (src/lib/text/units.ts).
// Walks the text of places, reviews, place ideas, to-dos and reference sites; prints every change (dry run) or applies it with a backup.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/convert-metric-text-to-imperial.ts [--apply]
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Phrases the general rules would turn into something awkward; settled by hand first.
const HAND: Array<[string, string]> = [
  ['roughly 7 meters of rain a year', 'roughly 275 inches of rain a year'],
  ['(25-30 per 100 km²)', '(25-30 per 40 sq mi)'],
  ['the 1,000m-plus granite walls', 'the 3,300-foot-plus granite walls'],
  ['30 metre rule', '100-foot rule'],
  ['8,000m', '26,000-foot'], // the "eight-thousanders" category
  ['7,000m', '23,000-foot'],
];
const SKIP_KEYS = new Set(['id', 'placeId', 'createdAt', 'updatedAt', 'doneAt', 'userId', 'url', 'slug']);

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const s = await import('../src/lib/db/schema');
  const { eq, getTableColumns } = await import('drizzle-orm');
  const { metricToImperial } = await import('../src/lib/text/units');
  const conv = (t: string) => { let x = t; for (const [a, b] of HAND) x = x.split(a).join(b); return metricToImperial(x); };
  const changes: string[] = [];
  const backup: Array<{ table: string; id: string; column: string; before: unknown }> = [];
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return conv(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SKIP_KEYS.has(k) ? x : walk(x)]));
    return v;
  };
  const tables: Array<[string, any, string]> = [['places', s.places, 'id'], ['interestReviews', s.interestReviews, 'id'], ['interestPlaceIdeas', s.interestPlaceIdeas, 'id'], ['interestTodos', s.interestTodos, 'id'], ['interestReferenceSites', s.interestReferenceSites, 'id']];
  for (const [name, table, idCol] of tables) {
    const cols = Object.keys(getTableColumns(table));
    const rows = (await db.select().from(table)) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const patch: Record<string, unknown> = {};
      for (const c of cols) {
        if (SKIP_KEYS.has(c)) continue;
        const before = r[c];
        if (before === null || before === undefined || typeof before === 'number' || typeof before === 'boolean' || before instanceof Date) continue;
        const after = walk(before);
        if (JSON.stringify(after) !== JSON.stringify(before)) {
          patch[c] = after;
          backup.push({ table: name, id: String(r[idCol]), column: c, before });
          // print each changed sentence fragment
          const flat = (x: unknown): string[] => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(flat) : x && typeof x === 'object' ? Object.values(x).flatMap(flat) : []);
          const b = flat(before), a = flat(after);
          b.forEach((t, i) => { if (t !== a[i]) { const m = [...a[i]].findIndex((ch, k) => ch !== t[k]); const at = Math.max(0, m - 40); changes.push(`${name}/${r[idCol]}.${c}: ...${t.slice(at, at + 90).replace(/\n/g, ' ')}...  =>  ...${a[i].slice(at, at + 96).replace(/\n/g, ' ')}...`); } });
        }
      }
      if (apply && Object.keys(patch).length) {
        if (name === 'places') patch.updatedAt = new Date();
        await db.update(table).set(patch as never).where(eq(table[idCol], r[idCol] as never));
      }
    }
  }
  console.log(changes.join('\n'));
  if (apply) { mkdirSync(join(__dirname, '..', 'docs', 'backups'), { recursive: true }); writeFileSync(join(__dirname, '..', 'docs', 'backups', 'metric-text-before-imperial-2026-10-13.json'), JSON.stringify(backup, null, 1)); }
  console.log(`\n${apply ? 'changed' : 'would change'} ${backup.length} fields in ${new Set(backup.map((b) => b.table + b.id)).size} rows.`);
  process.exit(0);
})();
