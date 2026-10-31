// 31 Oct 2026: applies the owner's rulings on the N/A rebuild review (scripts/data/na-rebuild-rulings.json; everything not ticked "keep as is" was accepted).
// A: N/A -> applicable (N/A mark and reason removed; base score 1 where the place has none). B: applicable -> N/A with its short reason.
// C: specialist list, N/A -> applicable (base score 1 where none) plus one build-queue to-do per interest. types: place-type corrections.
// Only touches a cell that is still in the state the audit saw. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-na-rebuild-oct31.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type Plan = { A: string[][]; B: string[][]; C: string[][]; types: Record<string, string> };
(async () => {
  const apply = process.argv.includes('--apply');
  const plan = JSON.parse(readFileSync(join(__dirname, 'data', 'na-rebuild-rulings.json'), 'utf8')) as Plan;
  const { db } = await import('../src/lib/db/client');
  const { places, interestTodos } = await import('../src/lib/db/schema');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { and, eq } = await import('drizzle-orm');
  const rows = await db.select().from(places);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const at = new Date().toISOString();
  type Work = { na: string[]; reasons: Record<string, unknown>; base: Record<string, number>; type?: string };
  const work = new Map<string, Work>();
  const get = (pid: string): Work | null => {
    const r = byId.get(pid);
    if (!r) return null;
    if (!work.has(pid)) work.set(pid, { na: [...r.naSliders], reasons: { ...((r.naReasons ?? {}) as Record<string, unknown>) }, base: { ...(r.baseScores as Record<string, number>) } });
    return work.get(pid)!;
  };
  const n = { A: 0, B: 0, C: 0, types: 0, skipped: 0 };
  const flipOn = (w: Work, k: string) => { w.na = w.na.filter((x) => x !== k); delete w.reasons[k]; if (w.base[k] == null) w.base[k] = 1; };
  for (const [k, pid] of plan.A.map((x) => [x[0], x[1]])) { const w = get(pid); if (!w || !w.na.includes(k)) { n.skipped++; continue; } flipOn(w, k); n.A++; }
  for (const [k, pid, , reason] of plan.B) { const w = get(pid); if (!w || w.na.includes(k)) { n.skipped++; continue; } w.na.push(k); w.reasons[k] = { reason, source: 'manual', by: 'Claude (map evidence, owner-ruled 31 Oct 2026)', at }; n.B++; }
  const cBy = new Map<string, string[]>();
  for (const [k, pid, name] of plan.C) { const w = get(pid); if (!w || !w.na.includes(k)) { n.skipped++; continue; } flipOn(w, k); cBy.set(k, [...(cBy.get(k) ?? []), name]); n.C++; }
  for (const [pid, t] of Object.entries(plan.types)) { const w = get(pid); if (!w) { n.skipped++; continue; } if (byId.get(pid)!.placeType !== t) { w.type = t; n.types++; } }
  console.log(`A ${n.A} on, B ${n.B} off, C ${n.C} on (${[...cBy].map(([k, v]) => `${k} ${v.length}`).join(', ')}), types ${n.types}, skipped ${n.skipped}, ${work.size} places`);
  if (!apply) { console.log('dry run'); process.exit(0); }
  let saved = 0;
  for (const [pid, w] of work) {
    const loaded = byId.get(pid)!.updatedAt.toISOString();
    const patches = [
      { entityType: 'destination', entityId: pid, field: 'naSliders', value: w.na, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: pid, field: 'naReasons', value: w.reasons, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: pid, field: 'baseScores', value: w.base, loadedUpdatedAt: loaded },
      ...(w.type ? [{ entityType: 'destination', entityId: pid, field: 'placeType', value: w.type, loadedUpdatedAt: loaded }] : []),
    ];
    const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
    saved += res.saved.length ? 1 : 0;
    if (res.errors.length || res.conflicts.length) console.log('PROBLEM', pid, JSON.stringify(res.errors), JSON.stringify(res.conflicts));
  }
  for (const [k, names] of cBy) {
    const title = `Build ${names.length} newly switched-on ${k} places (N/A review, 31 Oct 2026)`;
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, k), eq(interestTodos.title, title)));
    if (ex) continue;
    const values = { interestKey: k, title, detail: `Switched on from "N/A" because they look like the places already on this list, with a placeholder score of 1: ${names.join(', ')}. Each needs a real score, month curve and columns.`, status: 'idea' as const, source: 'N/A rebuild, 31 Oct 2026', priority: 2 };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${k}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
  }
  console.log('saved', saved, 'places;', cBy.size, 'to-dos');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
