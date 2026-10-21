// 21 Oct 2026: the owner said chips they never approved should be gone. Deletes every chip with no approval (all are drafts that nobody picked),
// after saving what each one held (name, columns it reads) to docs/backups.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/delete-unapproved-chips-oct21.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips, interestQuestionChips, placeChipOverrides } = await import('../src/lib/db/schema');
  const { and, eq, isNull } = await import('drizzle-orm');
  const rows = await db.select().from(interestChips).where(isNull(interestChips.approvedAt));
  if (rows.some((r) => r.status === 'live')) throw new Error('An unapproved chip is live: stop and look.');
  const links = await db.select().from(interestQuestionChips);
  for (const r of rows) console.log(`${r.interestKey}: ${r.label} [${r.status}] drivers ${JSON.stringify(r.drivers)}${links.some((l) => l.interestKey === r.interestKey && l.chipKey === r.chipKey) ? ' HAS LINKS' : ''}`);
  console.log(rows.length, 'unapproved chips');
  if (!apply) { console.log('dry run: pass --apply to write'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'unapproved-chips-removed-2026-10-21.json'), JSON.stringify(rows, null, 1));
  await db.transaction(async (tx) => {
    for (const r of rows) {
      await tx.delete(interestQuestionChips).where(and(eq(interestQuestionChips.interestKey, r.interestKey), eq(interestQuestionChips.chipKey, r.chipKey)));
      await tx.delete(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, r.interestKey), eq(placeChipOverrides.chipKey, r.chipKey)));
      await tx.delete(interestChips).where(and(eq(interestChips.interestKey, r.interestKey), eq(interestChips.chipKey, r.chipKey)));
    }
  });
  console.log('deleted');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
