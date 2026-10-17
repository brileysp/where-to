// Brings the surfing to-dos in line with the 13 Oct 2026 big fill. Safe to re-run.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const todos = await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'surfing'));
  const MARK = 'Update 13 Oct 2026';
  const update = async (t: (typeof todos)[number], note: string, done: boolean) => {
    if (t.detail.includes(MARK)) return 'skipped';
    const set = { detail: `${t.detail}\n\n${MARK}: ${note}`, updatedAt: new Date(), ...(done ? { status: 'done' as const, doneAt: new Date() } : {}) };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'update', before: t, after: { ...t, ...set }, write: (tx) => tx.update(interestTodos).set(set).where(eq(interestTodos.id, t.id)).returning() });
    return done ? 'closed' : 'noted';
  };
  const out: string[] = [];
  for (const t of todos) {
    if (t.status === 'done') continue;
    if (t.title.startsWith('Fill the surfing columns for the')) out.push(`fill: ${await update(t, 'all 39 places now have surfing columns, drafted from web guides (see the reviews dated 13 Oct 2026). Closed. What is still blank is listed in the to-do "Surfing columns still blank after the 13 Oct fill".', true)}`);
    else if (t.title.startsWith('Check the six new surfing columns')) out.push(`check6: ${await update(t, 'the six columns now cover all 88 places that are not N/A, not just the first 39. Localism and wave direction are the thinnest, because the web guides rarely say.', false)}`);
    else if (t.title.startsWith('Source-check the surfing columns for the places not yet')) out.push(`srccheck: ${await update(t, '39 more places were checked against web guides on 13 Oct (reviews logged). Those checks are secondary guides, not primary sources, and the two ratings are Claude\'s own judgement. The earlier list of 23 places is unchanged.', false)}`);
  }
  const title = 'Surfing columns still blank after the 13 Oct fill';
  if (!todos.some((t) => t.title === title)) {
    const values = { interestKey: 'surfing', title, detail: 'After the 13 Oct 2026 fill, 1,133 of 1,320 cells (88 places x 15 columns) are filled. Still blank: permits, fees or limits 73 (blank on purpose when there is nothing to report), localism 39, wave direction 22, wave size 16, breaks 10, boards 7, lessons and rentals 7, wave type 5, access 4. The five sparsest places are Komodo & Flores (4 of 15), Dalmatian Coast (6), Red Sea & Nile (7), Riviera Maya (7) and Great Barrier Reef (7); for those, the web guides were about wind sports, kite surfing or diving, not wave surfing, so a call is needed on whether they should be N/A for surfing. Localism and wave direction need a local source or a person who has surfed there.', status: 'needs_you' as const, source: 'Surfing big fill, 13 Oct 2026' };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: 'surfing:new', action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    out.push('created blank-cells to-do');
  }
  console.log(out.join(' | '));
  process.exit(0);
})();
