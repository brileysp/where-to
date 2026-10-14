import { readFileSync, writeFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Northern Tanzania has no coast, so the beach and ocean interests are set N/A (7 Oct 2026). The old Zanzibar-based text and
// scores are NOT deleted: they stay on the place and are also saved to docs/zanzibar-source-content.json as source for the future Zanzibar place.
const OCEAN = ['beachesSwimming', 'sunbathing', 'diving', 'surfing', 'windSports', 'whaleWatching', 'sailing'];

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places, interestTodos, placeInterestFacts } = await import('../src/lib/db/schema');
  const { eq, and, like } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');

  const [p] = await db.select().from(places).where(eq(places.id, 'tanzania'));
  const ov = (p.sliderOverview ?? {}) as Record<string, string>;
  const mo = (p.sliderMonthlyWeather ?? {}) as Record<string, (string | null)[]>;
  const saved: Record<string, unknown> = {};
  for (const k of OCEAN) if (ov[k]) saved[k] = { overview: ov[k], monthly: mo[k] };
  const facts = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, 'tanzania'), eq(placeInterestFacts.interestKey, 'whaleWatching')));
  writeFileSync('docs/zanzibar-source-content.json', JSON.stringify({ _note: 'Text written for the old "Serengeti & Zanzibar" place (id tanzania), kept as source for the future Zanzibar place. Saved 7 Oct 2026 when Northern Tanzania was set N/A for the ocean interests.', interests: saved, whaleFacts: facts[0]?.facts ?? null, scores: 'see place data' }, null, 1));

  const na = Array.from(new Set([...p.naSliders, ...OCEAN]));
  const res = await applyAdminEdits([{ entityType: 'destination', entityId: 'tanzania', field: 'naSliders', value: na, loadedUpdatedAt: p.updatedAt.toISOString() }], CLAUDE_ACTOR);
  console.log('N/A set', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors), '| now N/A:', na.length);
  if (res.errors.length || res.conflicts.length) process.exit(1);

  // To-dos: close the "Zanzibar text to move out" items and drop Northern Tanzania from the re-check lists of the N/A interests.
  const todos = await db.select().from(interestTodos).where(like(interestTodos.source, 'Place rename, 7 Oct 2026'));
  let closed = 0, trimmed = 0, removed = 0;
  for (const t of todos) {
    if (!OCEAN.includes(t.interestKey)) continue;
    if (t.title.startsWith('Zanzibar text to move out of Northern Tanzania')) {
      const detail = 'Done 7 Oct 2026: Northern Tanzania is now N/A for this interest (it has no coast). The old Zanzibar text and scores were kept on the place and saved to docs/zanzibar-source-content.json as source for the future Zanzibar place.';
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'update', before: t, after: { ...t, detail, status: 'done' }, write: (tx) => tx.update(interestTodos).set({ detail, status: 'done', doneAt: new Date(), updatedAt: new Date() }).where(eq(interestTodos.id, t.id)).returning() });
      closed++;
      continue;
    }
    const m = /scope: (.*)\. Re-check/.exec(t.detail);
    if (m) {
      const parts = m[1].split('; ');
      const keep = parts.filter((x) => !x.startsWith('Northern Tanzania'));
      if (keep.length === parts.length) continue;
      if (keep.length === 0) {
        await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'delete', before: t, after: null, write: (tx) => tx.delete(interestTodos).where(eq(interestTodos.id, t.id)) });
        removed++;
      } else {
        const detail = t.detail.replace(m[1], keep.join('; '));
        await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'update', before: t, after: { ...t, detail }, write: (tx) => tx.update(interestTodos).set({ detail, updatedAt: new Date() }).where(eq(interestTodos.id, t.id)).returning() });
        trimmed++;
      }
    }
  }
  console.log('to-dos closed', closed, 'lists trimmed', trimmed, 'items removed', removed);
  process.exit(0);
})();
