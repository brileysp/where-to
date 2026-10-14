import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Renames four more places (Oct 2026 batch 3) and logs, per interest, what still needs rewriting.
// Only name, region (where it changes) and search terms are edited here. No blurb, score or overview is touched.
const CHANGES: Record<string, { oldName: string; name: string; oldScope: string; newScope: string; addAliases: string[] }> = {
  kruger: { oldName: 'Kruger National Park', name: 'Kruger & Sabi Sands', oldScope: 'Kruger National Park', newScope: 'Kruger and the Sabi Sands private reserve', addAliases: ['Kruger National Park', 'Sabi Sands', 'Greater Kruger'] },
  aspen: { oldName: 'Aspen', name: 'Aspen Snowmass', oldScope: 'Aspen', newScope: 'Aspen and Snowmass', addAliases: ['Aspen', 'Snowmass', 'Aspen Highlands', 'Buttermilk'] },
  napa: { oldName: 'Napa Valley', name: 'Napa & Sonoma', oldScope: 'Napa Valley', newScope: 'Napa and Sonoma', addAliases: ['Napa Valley', 'Sonoma', 'Sonoma Valley'] },
  borabora: { oldName: 'Bora Bora', name: 'French Polynesia', oldScope: 'Bora Bora', newScope: 'all of French Polynesia', addAliases: ['Bora Bora', 'Tahiti', 'Moorea', 'Rangiroa'] },
};

const SOURCE = 'Place rename, 7 Oct 2026';

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places, interestTodos } = await import('../src/lib/db/schema');
  const { inArray, and, eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const label = (k: string) => SLIDERS.find((s) => s.key === k)?.label ?? k;

  const rows = await db.select().from(places).where(inArray(places.id, Object.keys(CHANGES)));
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const oldNames: Record<string, string> = {};
  for (const r of rows) {
    const c = CHANGES[r.id];
    oldNames[r.id] = CHANGES[r.id].oldName; // fixed names, so re-running never writes a wrong 'was' name
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    patches.push({ ...base, field: 'name', value: c.name });
    const aliases = [...r.searchAliases];
    for (const a of c.addAliases.concat([r.name])) if (!aliases.some((x) => x.toLowerCase() === a.toLowerCase())) aliases.push(a);
    patches.push({ ...base, field: 'searchAliases', value: aliases });
  }
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('renamed', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  if (res.errors.length || res.conflicts.length) process.exit(1);

  // Per-interest to-dos.
  const wanted = new Map<string, Array<{ title: string; detail: string; status: 'ready_for_claude' | 'idea' }>>();
  const add = (key: string, t: { title: string; detail: string; status: 'ready_for_claude' | 'idea' }) => wanted.set(key, [...(wanted.get(key) ?? []), t]);
  const curveOnly = new Map<string, string[]>();
  for (const r of rows) {
    const c = CHANGES[r.id];
    const written = Object.keys(r.sliderOverview ?? {}).filter((k) => (r.sliderOverview as Record<string, string>)[k]);
    for (const k of written) {
      add(k, {
        title: `Rewrite ${c.name} for its wider scope (was ${oldNames[r.id]})`,
        detail: `Fields to rewrite: the overview, all 12 monthly blurbs and the 12 monthly scores. The current text covers only ${c.oldScope}; the place is now ${c.newScope}.`,
        status: 'ready_for_claude',
      });
    }
    const curves = (Array.isArray(r.authoredCurves) ? r.authoredCurves : []) as string[];
    for (const k of curves) {
      if (written.includes(k)) continue;
      curveOnly.set(k, [...(curveOnly.get(k) ?? []), `${c.name} (was ${oldNames[r.id]})`]);
    }
  }
  for (const [k, names] of curveOnly) {
    add(k, {
      title: `Re-check ${label(k)} scores for broadened places`,
      detail: `These places have monthly scores for ${label(k)} (no written text) that were set for the old, narrower scope: ${names.join('; ')}. Re-check the monthly scores for the wider area; write text only if wanted.`,
      status: 'idea',
    });
  }

  let created = 0;
  let skipped = 0;
  for (const [interestKey, items] of wanted) {
    for (const t of items) {
      const [existing] = await db.select().from(interestTodos).where(and(eq(interestTodos.interestKey, interestKey), eq(interestTodos.title, t.title)));
      if (existing) {
        const m = /scope: (.*)\. Re-check/.exec(existing.detail);
        const mine = /scope: (.*)\. Re-check/.exec(t.detail);
        if (m && mine) {
          const have = m[1].split('; ');
          const add = mine[1].split('; ').filter((n) => !have.includes(n));
          if (add.length) {
            const detail = existing.detail.replace(m[1], [...have, ...add].join('; '));
            await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: existing.id, action: 'update', before: existing, after: { ...existing, detail }, write: (tx) => tx.update(interestTodos).set({ detail, updatedAt: new Date() }).where(eq(interestTodos.id, existing.id)).returning() });
            created++;
            continue;
          }
        }
        skipped++;
        continue;
      }
      const values = { interestKey, ...t, source: SOURCE, doneAt: null };
      await withAdminAudit({
        actor: CLAUDE_ACTOR,
        skipPlaceCache: true,
        entityType: 'interest_todo',
        entityId: `${interestKey}:new`,
        action: 'create',
        before: null,
        after: values,
        write: (tx) => tx.insert(interestTodos).values(values).returning(),
      });
      created++;
    }
  }
  console.log('to-dos created', created, 'skipped (already there)', skipped, 'interests touched', wanted.size);
  for (const [k, items] of wanted) console.log(' ', k, items.length);
  process.exit(0);
})();
