// Fills a pilot interest's chip columns from a data file (scripts/data/<name>-oct17.json: {placeId: {columnKey: value}}), 17 Oct 2026. Judgement drafts for the owner to review.
// Only fills a column that is still empty for that place; creates the place's facts row when there is none.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-pilot-facts.ts <interestKey> <dataFileName> [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const [interestKey, file] = process.argv.slice(2);
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const defs = factDefsFor(interestKey);
  const data = JSON.parse(readFileSync(join(__dirname, 'data', file), 'utf8')) as Record<string, Record<string, unknown>>;
  const existing = new Map((await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, interestKey))).map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  const ids = new Set((await db.select({ id: places.id }).from(places)).map((r) => r.id));
  let cells = 0, rows = 0, skipped = 0;
  for (const [placeId, cols] of Object.entries(data)) {
    if (!ids.has(placeId)) throw new Error(`Unknown place ${placeId}`);
    const facts: Record<string, unknown> = { ...(existing.get(placeId) ?? {}) };
    let changed = false;
    for (const [key, raw] of Object.entries(cols)) {
      const def = defs.find((d) => d.key === key);
      if (!def) throw new Error(`${interestKey} has no column ${key}`);
      if (facts[key] !== undefined && facts[key] !== null) { skipped++; continue; }
      const p = parseFact(def, raw);
      if (!p.ok) throw new Error(`${placeId} ${key}: ${p.message}`);
      facts[key] = p.value; changed = true; cells++;
    }
    if (!changed) continue;
    rows++;
    if (apply) await db.insert(placeInterestFacts).values({ placeId, interestKey, facts: facts as never, updatedAt: new Date() }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${cells} cells in ${rows} places (${skipped} already filled, skipped)`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
