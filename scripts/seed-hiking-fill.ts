// Fills the empty hiking columns from scripts/data/<file>.json (16 Oct 2026 onward), for places that are not N/A. Only fills cells that are still empty,
// so nothing typed on the admin page is overwritten. Creates the facts row when a place has none. Logs one "Claude (web source check)" review per place
// that has source links. Safe to re-run. Source-checked stays false: these are first drafts from guides and general knowledge.
// Keys: d signatureDayHikes, m multiDayHikes, w ways, al altitude, st statusNotes, hr howReach, pm permits, src source links.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-hiking-fill.ts <file.json> [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const file = process.argv.find((a) => a.endsWith('.json'))!;
  const data = JSON.parse(readFileSync(join(__dirname, 'data', file), 'utf8')) as Record<string, Record<string, unknown>>;
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, interestReviews, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const defs = factDefsFor('hiking');
  const MAP: Record<string, string> = { d: 'signatureDayHikes', m: 'multiDayHikes', w: 'ways', al: 'altitude', st: 'statusNotes', hr: 'howReach', pm: 'permits' };
  const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const placeRows = await db.select({ id: places.id, name: places.name }).from(places);
  const info = new Map(placeRows.map((p) => [p.id, p]));
  const existingReviews = await db.select().from(interestReviews).where(eq(interestReviews.interestKey, 'hiking'));
  let cells = 0, touched = 0, created = 0, reviews = 0;
  const problems: string[] = [];
  for (const [id, d] of Object.entries(data)) {
    if (!info.has(id)) { problems.push(`unknown place ${id}`); continue; }
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, 'hiking')));
    const have = (existing?.facts ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...have };
    let added = 0;
    for (const [k, v] of Object.entries(d)) {
      if (k === 'src') continue;
      const key = MAP[k];
      if (!key) { problems.push(`${id}: unknown key ${k}`); continue; }
      const def = defs.find((x) => x.key === key)!;
      const parsed = parseFact(def, v);
      if (!parsed.ok) { problems.push(`${id}: bad ${key} (${parsed.message})`); continue; }
      if (empty(have[key]) && !empty(parsed.value)) { next[key] = parsed.value; added++; }
    }
    if (next.drawSourceChecked === undefined) next.drawSourceChecked = false;
    if (added) {
      cells += added; touched++;
      if (!existing) created++;
      if (apply) await db.insert(placeInterestFacts).values({ placeId: id, interestKey: 'hiking', facts: next as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: next as never, updatedAt: new Date() } });
    }
    const src = (d.src as string[] | undefined) ?? [];
    if (added && src.length && !existingReviews.some((r) => r.placeId === id && r.reviewerName === 'Claude (web source check)' && r.reviewedOn === '2026-10-16')) {
      reviews++;
      if (apply) {
        const notes = `Filled signature day hikes, multi-day hikes, what you can do, status or closure notes and (for high places) altitude from the web sources linked here plus general knowledge. Lengths are approximate; routes not covered by a source are from guides and memory and are not source-checked. Sources: ${src.join(' ; ')}`;
        const values = { interestKey: 'hiking', placeId: id, reviewerName: 'Claude (web source check)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-16', notes, createdBy: CLAUDE_ACTOR.email };
        await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: 'hiking:new', action: 'create', before: null, after: values, write: (tx: any) => tx.insert(interestReviews).values(values).returning() });
      }
    }
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${cells} cells on ${touched} places (${created} new rows); ${reviews} reviews`);
  if (problems.length) console.log('PROBLEMS:\n ' + problems.join('\n '));
  process.exit(0);
})();
