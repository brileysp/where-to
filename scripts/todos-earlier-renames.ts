import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Adds the same per-interest rewrite to-dos for the earlier renames (7 Oct 2026).
// `skip` = interests already rewritten for the new scope (Myanmar and Assam), so only their score-only interests are listed.
const PLACES: Record<string, { oldName: string; oldScope: string; newScope: string; skip: string[] }> = {
  bagan: { oldName: 'Bagan', oldScope: 'Bagan', newScope: 'all of Myanmar', skip: ['birding', 'wildlifeViewing'] },
  kaziranga: { oldName: 'Kaziranga National Park', oldScope: 'Kaziranga National Park', newScope: 'Assam and Northeast India', skip: ['safari', 'birding', 'wildlifeViewing'] },
  komodo: { oldName: 'Komodo Island', oldScope: 'Komodo Island', newScope: 'Komodo and Flores', skip: [] },
  'joshua-tree': { oldName: 'Joshua Tree National Park', oldScope: 'Joshua Tree National Park', newScope: 'Palm Springs and Joshua Tree', skip: [] },
  'punta-cana': { oldName: 'Punta Cana', oldScope: 'the Punta Cana resort coast', newScope: 'all of the Dominican Republic', skip: [] },
  whistler: { oldName: 'Whistler', oldScope: 'Whistler', newScope: 'Vancouver and Whistler', skip: [] },
  'el-chalten': { oldName: 'El Chaltén & Fitz Roy', oldScope: 'El Chaltén and Fitz Roy', newScope: 'El Chaltén and El Calafate', skip: [] },
  havana: { oldName: 'Havana', oldScope: 'Havana', newScope: 'all of Cuba', skip: [] },
};
const SOURCE = 'Place rename, 7 Oct 2026';

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places, interestTodos } = await import('../src/lib/db/schema');
  const { inArray, and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const label = (k: string) => SLIDERS.find((s) => s.key === k)?.label ?? k;
  const rows = await db.select().from(places).where(inArray(places.id, Object.keys(PLACES)));

  const rewrite: Array<{ key: string; title: string; detail: string }> = [];
  const curveOnly = new Map<string, string[]>();
  for (const r of rows) {
    const p = PLACES[r.id];
    const written = Object.keys(r.sliderOverview ?? {}).filter((k) => (r.sliderOverview as Record<string, string>)[k]);
    for (const k of written) {
      if (p.skip.includes(k)) continue;
      rewrite.push({ key: k, title: `Rewrite ${r.name} for its wider scope (was ${p.oldName})`, detail: `Fields to rewrite: the overview, all 12 monthly blurbs and the 12 monthly scores. The current text covers only ${p.oldScope}; the place is now ${p.newScope}.` });
    }
    for (const k of (Array.isArray(r.authoredCurves) ? r.authoredCurves : []) as string[]) {
      if (written.includes(k) && !p.skip.includes(k)) continue;
      curveOnly.set(k, [...(curveOnly.get(k) ?? []), `${r.name} (was ${p.oldName})`]);
    }
  }

  let created = 0, updated = 0, skipped = 0;
  for (const t of rewrite) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, t.key), eq(interestTodos.title, t.title)));
    if (ex) { skipped++; continue; }
    const values = { interestKey: t.key, title: t.title, detail: t.detail, status: 'ready_for_claude' as const, source: SOURCE, doneAt: null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${t.key}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    created++;
  }
  for (const [k, names] of curveOnly) {
    const title = `Re-check ${label(k)} scores for broadened places`;
    const [ex] = await db.select().from(interestTodos).where(and(eq(interestTodos.interestKey, k), eq(interestTodos.title, title)));
    const list = (arr: string[]) => `These places have monthly scores for ${label(k)} (no written text) that were set for the old, narrower scope: ${arr.join('; ')}. Re-check the monthly scores for the wider area; write text only if wanted.`;
    if (ex) {
      const m = /scope: (.*)\. Re-check/.exec(ex.detail);
      const have = m ? m[1].split('; ') : [];
      const add = names.filter((n) => !have.includes(n));
      if (add.length === 0) { skipped++; continue; }
      const detail = list([...have, ...add]);
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: ex.id, action: 'update', before: ex, after: { ...ex, detail }, write: (tx) => tx.update(interestTodos).set({ detail, updatedAt: new Date() }).where(eq(interestTodos.id, ex.id)).returning() });
      updated++;
    } else {
      const values = { interestKey: k, title, detail: list(names), status: 'idea' as const, source: SOURCE, doneAt: null };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${k}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
      created++;
    }
  }
  console.log('created', created, 'updated existing', updated, 'skipped', skipped, '| rewrite items', rewrite.length, '| score-check interests', curveOnly.size);
  process.exit(0);
})();
