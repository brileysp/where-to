// 31 Oct 2026: five cells switched on during the N/A rebuild kept a stored score of 0 (an existing 0 is not replaced by the placeholder 1). Sets the placeholder 1 on the ones listed.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const CELLS: Array<[string, string]> = [['nightlife', 'torres-del-paine'], ['streetFood', 'death-valley'], ['wineSpirits', 'snowdonia'], ['skiingSnowboarding', 'nice-riviera'], ['skiingSnowboarding', 'provence']];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = await db.select().from(places);
  let n = 0;
  for (const [k, pid] of CELLS) {
    const r = rows.find((x) => x.id === pid)!;
    const base = { ...(r.baseScores as Record<string, number>) };
    if (r.naSliders.includes(k) || base[k] !== 0) { console.log('skip', k, pid, base[k]); continue; }
    base[k] = 1; n++;
    if (apply) { const res = await applyAdminEdits([{ entityType: 'destination', entityId: pid, field: 'baseScores', value: base, loadedUpdatedAt: r.updatedAt.toISOString() }], CLAUDE_ACTOR); if (res.errors.length || res.conflicts.length) console.log('PROBLEM', pid, JSON.stringify(res.errors)); }
  }
  console.log(`${apply ? 'set' : 'would set'} ${n} cells to 1`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
