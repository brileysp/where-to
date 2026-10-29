// 29 Oct 2026: stores the drafted N/A reasons for batch A (measured facts) or batch B (what the place is visited for) from scripts/data/na-reasons-draft.json.
// Fills blanks only: a place that already has a reason for the interest, or that is no longer N/A for it, is skipped. Lines the owner flagged in the review
// artifact are skipped through --skip=file.json (a JSON array of "interestKey__placeId"). Doubtful marks (the "doubts" list) have no draft and are never touched.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/store-na-reasons-oct29.ts --batch=A|B [--skip=flags.json] [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const apply = process.argv.includes('--apply');
  const batch = arg('batch');
  if (batch !== 'A' && batch !== 'B') { console.log('Usage: --batch=A|B [--skip=flags.json] [--apply]'); process.exit(1); }
  const drafts = JSON.parse(readFileSync(join(__dirname, 'data', 'na-reasons-draft.json'), 'utf8')).out[batch] as Record<string, Array<{ pid: string; reason: string }>>;
  const skip = new Set<string>(arg('skip') ? JSON.parse(readFileSync(arg('skip')!, 'utf8')) : []);
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const rows = await db.select().from(places);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const touched = new Map<string, Record<string, unknown>>();
  const at = new Date().toISOString();
  let stored = 0, skippedFlag = 0, skippedHave = 0, skippedNotNa = 0;
  for (const [k, list] of Object.entries(drafts)) {
    for (const d of list) {
      if (skip.has(`${k}__${d.pid}`)) { skippedFlag++; continue; }
      const r = byId.get(d.pid);
      if (!r || !r.naSliders.includes(k)) { skippedNotNa++; continue; }
      const have = touched.get(r.id) ?? ((r.naReasons as Record<string, unknown>) ?? {});
      if ((have as any)[k]?.reason) { skippedHave++; continue; }
      touched.set(r.id, { ...have, [k]: { reason: d.reason, source: 'manual', by: 'Claude (data rule, 29 Oct 2026)', at } });
      stored++;
    }
  }
  const patches = [...touched.entries()].map(([id, value]) => ({ entityType: 'destination', entityId: id, field: 'naReasons', value, loadedUpdatedAt: byId.get(id)!.updatedAt.toISOString() }));
  console.log(`batch ${batch}: ${stored} reasons on ${patches.length} places; skipped ${skippedFlag} flagged, ${skippedHave} already had one, ${skippedNotNa} no longer N/A`);
  if (!apply) { console.log('dry run'); process.exit(0); }
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  let saved = 0;
  for (let i = 0; i < patches.length; i += 25) {
    const res = await applyAdminEdits(patches.slice(i, i + 25), CLAUDE_ACTOR);
    saved += res.saved.length;
    if (res.errors.length || res.conflicts.length) console.log('PROBLEM', JSON.stringify(res.errors), JSON.stringify(res.conflicts));
  }
  console.log('saved', saved, 'places');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
