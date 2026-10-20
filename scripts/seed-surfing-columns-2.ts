// Fills the six surfing columns added 12 Oct 2026 from scripts/data/surfing-facts-draft-2.ts. Only fills cells that are still empty, so nothing
// typed on the admin page is overwritten. Also adds one to-do saying these are first drafts to check.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-surfing-columns-2.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { SURF_DRAFT_2 } = await import('./data/surfing-facts-draft-2');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const defs = factDefsFor('surfing');
  const MAP: Record<string, string> = { d: 'waveDirection', bd: 'boards', ac: 'access', lc: 'localism', ls: 'lessons', pm: 'permits' };
  let cells = 0, touched = 0;
  const problems: string[] = [];
  for (const [id, d] of Object.entries(SURF_DRAFT_2)) {
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, 'surfing')));
    if (!existing) { problems.push(`${id}: no surfing facts row`); continue; }
    const have = existing.facts as Record<string, unknown>;
    const next = { ...have };
    let added = 0;
    for (const [k, v] of Object.entries(d)) {
      const key = MAP[k];
      const def = defs.find((x) => x.key === key)!;
      const parsed = parseFact(def, v);
      if (!parsed.ok) { problems.push(`${id}: bad ${key} (${parsed.message})`); continue; }
      const cur = have[key];
      if (cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && cur.length === 0)) { next[key] = parsed.value; added++; }
    }
    if (!added) continue;
    cells += added; touched++;
    if (apply) await db.update(placeInterestFacts).set({ facts: next as never, updatedAt: new Date() }).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, 'surfing')));
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${cells} cells on ${touched} places`);
  if (problems.length) console.log('PROBLEMS:\n ' + problems.join('\n '));
  if (apply) {
    const title = 'Check the six new surfing columns (first drafts)';
    const have = (await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'surfing'))).some((t) => t.title === title);
    if (!have) await db.insert(interestTodos).values({ interestKey: 'surfing', title, detail: `Wave direction, boards to bring, how you reach the waves, localism, lessons and rental, and permits were drafted on 12 Oct 2026 for ${Object.keys(SURF_DRAFT_2).length} places from general knowledge. None is source-checked. The weakest are localism, wave direction for the less famous breaks, and the permits and limits notes. The other places are blank on purpose (not surf destinations) or still have no surfing columns at all.`, status: 'ready_for_claude', source: 'Surfing columns, 12 Oct 2026' });
  }
  process.exit(0);
})();
