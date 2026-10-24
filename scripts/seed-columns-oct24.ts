// 24 Oct 2026: fills new interest columns from a JSON file of { placeId: { columnKey: value } }. Fills only empty cells, so nothing typed on the admin page
// is overwritten, and creates the facts row when a place has none. Safe to re-run. Skips places where the interest is N/A.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-columns-oct24.ts --interest=streetFood --file=scripts/data/street-food-facts-draft.json [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const apply = process.argv.includes('--apply');
  const interest = arg('interest')!, file = arg('file')!;
  const data = JSON.parse(readFileSync(join(__dirname, '..', file), 'utf8')) as Record<string, Record<string, unknown>>;
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const defs = factDefsFor(interest);
  const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const info = new Map((await db.select({ id: places.id, na: places.naSliders }).from(places)).map((p) => [p.id, p]));
  let cells = 0, touched = 0, created = 0;
  const problems: string[] = [];
  for (const [id, d] of Object.entries(data)) {
    const p = info.get(id);
    if (!p) { problems.push(`unknown place ${id}`); continue; }
    if ((p.na as string[]).includes(interest)) { problems.push(`${id} is N/A for this interest, skipped`); continue; }
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, interest)));
    const have = (existing?.facts ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...have };
    let added = 0;
    for (const [key, v] of Object.entries(d)) {
      const def = defs.find((x) => x.key === key);
      if (!def) { problems.push(`${id}: unknown column ${key}`); continue; }
      const parsed = parseFact(def, v);
      if (!parsed.ok) { problems.push(`${id}: bad ${key} (${parsed.message})`); continue; }
      if (empty(have[key]) && !empty(parsed.value)) { next[key] = parsed.value; added++; }
    }
    if (next.drawSourceChecked === undefined) next.drawSourceChecked = false;
    if (added) {
      cells += added; touched++;
      if (!existing) created++;
      if (apply) await db.insert(placeInterestFacts).values({ placeId: id, interestKey: interest, facts: next as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: next as never, updatedAt: new Date() } });
    }
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${cells} cells on ${touched} places (${created} new rows)`);
  if (problems.length) console.log('PROBLEMS:\n ' + problems.join('\n '));
  process.exit(0);
})();
