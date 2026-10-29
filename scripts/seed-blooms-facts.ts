// 23 Oct 2026: fills the Blooms and Fall Colors columns for every place where the interest applies, from scripts/data/blooms-facts-draft.json.
// Fills only empty cells, so nothing typed on the admin page is overwritten; creates the facts row when a place has none. Safe to re-run.
// Keys: t blossoming trees, d desert, f flower fields, c fall color, m meadows, w woodland and heath, r timing, s how you see it, k crowds, e organised event, g signature blooms.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-blooms-facts.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  // --overwrite=p,s replaces those keys even where a cell is already filled (used after a source check).
  const overwrite = new Set((process.argv.find((a) => a.startsWith('--overwrite='))?.split('=')[1] ?? '').split(',').filter(Boolean));
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'blooms-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const defs = factDefsFor('wildflowerBlooms');
  const MAP: Record<string, string> = { t: 'blossomRating', d: 'desertRating', f: 'fieldsRating', c: 'fallRating', m: 'meadowRating', w: 'woodlandRating', r: 'timingReliability', s: 'howSeen', k: 'bloomCrowds', e: 'organisedEvent', g: 'signatureBlooms' };
  const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const placeRows = await db.select({ id: places.id, na: places.naSliders }).from(places);
  const info = new Map(placeRows.map((p) => [p.id, p]));
  let cells = 0, touched = 0, created = 0;
  const problems: string[] = [];
  for (const [id, d] of Object.entries(data)) {
    const p = info.get(id);
    if (!p) { problems.push(`unknown place ${id}`); continue; }
    if ((p.na as string[]).includes('wildflowerBlooms')) { problems.push(`${id} is N/A for this interest, skipped`); continue; }
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, 'wildflowerBlooms')));
    const have = (existing?.facts ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...have };
    let added = 0;
    for (const [k, v] of Object.entries(d)) {
      const key = MAP[k];
      if (!key) { problems.push(`${id}: unknown key ${k}`); continue; }
      const def = defs.find((x) => x.key === key)!;
      const parsed = parseFact(def, v);
      if (!parsed.ok) { problems.push(`${id}: bad ${key} (${parsed.message})`); continue; }
      if ((empty(have[key]) || overwrite.has(k)) && !empty(parsed.value) && JSON.stringify(have[key]) !== JSON.stringify(parsed.value)) { next[key] = parsed.value; added++; }
    }
    if (next.drawSourceChecked === undefined) next.drawSourceChecked = false;
    if (added) {
      cells += added; touched++;
      if (!existing) created++;
      if (apply) await db.insert(placeInterestFacts).values({ placeId: id, interestKey: 'wildflowerBlooms', facts: next as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: next as never, updatedAt: new Date() } });
    }
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${cells} cells on ${touched} places (${created} new rows)`);
  if (problems.length) console.log('PROBLEMS:\n ' + problems.join('\n '));
  process.exit(0);
})();
