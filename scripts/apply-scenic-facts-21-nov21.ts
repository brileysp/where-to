// 21 Nov 2026: writes the owner-approved Scenic ratings, ways to reach views and signature views for the 21 widened places
// (scripts/data/scenic-facts-21-proposal-nov21.json) and ticks Source-checked. Camera gear rules are left as they were (not rechecked).
// Backs up the old fact rows first. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-scenic-facts-21-nov21.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const FIELD: Record<string, string> = { m: 'mountainsRating', d: 'desertsRating', c: 'coastsRating', f: 'forestsRating', t: 'citiesRating', w: 'lakesRating', i: 'iceRating', o: 'iconicRating', g: 'hiddenGemsRating', p: 'landscapePhotography' };
(async () => {
  const apply = process.argv.includes('--apply');
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'scenic-facts-21-proposal-nov21.json'), 'utf8')) as Record<string, any>;
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, placeIdentity } = await import('../src/lib/db/schema');
  const { and, eq, inArray } = await import('drizzle-orm');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const defs = factDefsFor('scenicLandscapes');
  const ids = Object.keys(data);
  const rows = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.interestKey, 'scenicLandscapes'), inArray(placeInterestFacts.placeId, ids)));
  const idents = await db.select().from(placeIdentity).where(inArray(placeIdentity.placeId as never, ids as never));
  const ver = new Map(idents.map((x) => [x.placeId, x.scopeVersion]));
  const have = new Map(rows.map((r) => [r.placeId, r]));
  const backup = join(__dirname, 'data', 'backups', 'scenic-facts-21-before-nov21.json');
  if (apply) writeFileSync(backup, JSON.stringify(rows, null, 1));
  let cells = 0; const problems: string[] = [];
  for (const [id, d] of Object.entries(data)) {
    const row = have.get(id);
    const next: Record<string, unknown> = { ...((row?.facts ?? {}) as Record<string, unknown>) };
    const set = (key: string, v: unknown) => {
      const def = defs.find((x) => x.key === key)!;
      const p = parseFact(def, v);
      if (!p.ok) { problems.push(`${id} ${key}: ${p.message}`); return; }
      if (JSON.stringify(next[key]) !== JSON.stringify(p.value)) { next[key] = p.value; cells++; }
    };
    for (const [k, key] of Object.entries(FIELD)) set(key, d.new[k]);
    set('viewAccess', d.vaNew);
    set('signatureViews', d.sigNew);
    set('drawSourceChecked', true);
    if (apply) await db.insert(placeInterestFacts).values({ placeId: id, interestKey: 'scenicLandscapes', facts: next as never, scopeVersion: ver.get(id) ?? 1 } as never).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: next as never, scopeVersion: ver.get(id) ?? 1, updatedAt: new Date() } as never });
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${cells} cells on ${ids.length} places`);
  if (problems.length) console.log('PROBLEMS:\n ' + problems.join('\n '));
  process.exit(0);
})();
