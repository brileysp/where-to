/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/link-and-close-todos.ts [--apply]
// 1. Links the place-specific "Rewrite X for its wider/narrower scope" to-dos (all interests) to their place and turns on close-on-apply.
// 2. Closes any of them that a Gemini generation applied after the to-do was made has already done.
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestTodos, places, contentGenerations } = await import('../src/lib/db/schema');
  const { and, eq, isNotNull } = await import('drizzle-orm');
  const { placeNameFromRewriteTitle, closeTodosForApplied } = await import('../src/lib/gemini/todo-sync');
  const idByName = new Map((await db.select({ id: places.id, name: places.name }).from(places)).map((p) => [p.name, p.id]));
  let todos = await db.select().from(interestTodos);
  let linked = 0;
  for (const t of todos) {
    if (t.placeId) continue;
    const name = placeNameFromRewriteTitle(t.title);
    const id = name ? idByName.get(name) : undefined;
    if (name && !id) console.log('no place named', name);
    if (!id) continue;
    linked++;
    if (apply) await db.update(interestTodos).set({ placeId: id, closeOnApply: true }).where(eq(interestTodos.id, t.id));
  }
  console.log(`${apply ? 'linked' : 'would link'} ${linked} to-dos to their place`);
  if (!apply) { process.exit(0); }
  todos = await db.select().from(interestTodos);
  const gens = await db.select().from(contentGenerations).where(isNotNull(contentGenerations.appliedAt));
  const closed: string[] = [];
  for (const t of todos) {
    if (!t.placeId || !t.closeOnApply || t.status === 'done') continue;
    const g = gens.filter((x) => x.placeId === t.placeId && x.interestKey === t.interestKey && x.appliedAt! > t.createdAt).sort((a, b) => +b.appliedAt! - +a.appliedAt!)[0];
    if (!g) { console.log(`still open: [${t.interestKey}] ${t.title}`); continue; }
    const out = g.parsedOutput as any;
    const na = typeof out?.overview === 'string' && out.overview.startsWith('NOT_APPLICABLE:');
    const titles = await closeTodosForApplied({ placeId: t.placeId, interestKey: t.interestKey, generationId: g.id, promptVersion: g.promptVersion, notApplicable: na });
    closed.push(...titles.map((x) => `[${t.interestKey}] ${x}`));
  }
  console.log(`closed ${closed.length}:\n  ` + closed.join('\n  '));
  process.exit(0);
})();
