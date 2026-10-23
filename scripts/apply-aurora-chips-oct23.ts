// 23 Oct 2026: connects the approved Northern Lights / Aurora chips to their columns and makes them live (the columns are filled for all 22
// places). A chip must be approved first; nothing unapproved is touched. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-aurora-chips-oct23.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
// Aurora plus winter activities counts when any one of four activities is on offer (the chip fit is its best driver).
const DRIVERS: Record<string, Array<{ column: string; option?: string }>> = {
  'southern-lights': [{ column: 'southernLights' }],
  'easy-from-a-town': [{ column: 'easyFromTown' }],
  'aurora-plus-winter-activities': ['dogSledding', 'snowmobiling', 'skiing', 'hotSprings'].map((option) => ({ column: 'winterActivities', option })),
};
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const { driverProblem } = await import('../src/lib/admin/interest-pages/chips');
  const defs = factDefsFor('auroraChasing');
  for (const [chipKey, drivers] of Object.entries(DRIVERS)) {
    const where = and(eq(interestChips.interestKey, 'auroraChasing'), eq(interestChips.chipKey, chipKey));
    const [cur] = await db.select().from(interestChips).where(where);
    if (!cur) throw new Error(`no chip ${chipKey}`);
    if (!cur.approvedAt) { console.log(`${chipKey}: NOT approved, left alone`); continue; }
    for (const d of drivers) { const problem = driverProblem(d, defs); if (problem) throw new Error(`${chipKey}: ${problem}`); }
    console.log(`${chipKey}: ${cur.status} -> live, reads ${drivers.map((d) => d.column + (d.option ? ':' + d.option : '')).join(', ')}`);
    if (!apply) continue;
    const next = { ...cur, drivers, needsColumn: '', status: 'live' as const, updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_chip', entityId: `auroraChasing:${chipKey}`, action: 'update', before: cur, after: next, write: (tx) => tx.update(interestChips).set({ drivers, needsColumn: '', status: 'live', updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() }).where(where).returning() });
  }
  if (!apply) console.log('dry run');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
