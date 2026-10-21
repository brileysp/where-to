// Applies the owner's picks from the interactive chip proposals page (20 Oct 2026): approve, delete rejected drafts, create new chips as approved drafts.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-chip-picks-oct20.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}
const ALIAS: Record<string, string> = { 'Colourful reefs': 'Colorful reefs' };
(async () => {
  const apply = process.argv.includes('--apply');
  const picks = JSON.parse(readFileSync(join(__dirname, 'data', 'chip-picks-oct20.json'), 'utf8'));
  const { db } = await import('../src/lib/db/client');
  const { interestChips, placeChipOverrides } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { chipKeyFor } = await import('../src/lib/admin/interest-pages/chips');
  const all = await db.select().from(interestChips);
  const find = (i: string, l: string) => all.find((c) => c.interestKey === i && c.label === (ALIAS[l] ?? l));
  const OWNER = 'brileysp@gmail.com (picked on the proposals page 20 Oct 2026; recorded by Claude)';
  let a = 0, d = 0, n = 0; const problems: string[] = [];
  for (const [i, labels] of Object.entries<string[]>(picks.approve)) for (const l of labels) {
    const c = find(i, l); if (!c) { problems.push(`approve: no chip ${i}/${l}`); continue; }
    if (c.approvedAt) continue;
    if (apply) await db.update(interestChips).set({ approvedBy: OWNER, approvedAt: new Date('2026-10-20T04:00:00Z') }).where(and(eq(interestChips.interestKey, i), eq(interestChips.chipKey, c.chipKey)));
    a++;
  }
  for (const [i, labels] of Object.entries<string[]>(picks.reject)) for (const l of labels) {
    const c = find(i, l);
    if (!c) { console.log(`reject: no draft chip ${i}/${l} (a proposed change, nothing to delete)`); continue; }
    if (c.status === 'live') { problems.push(`reject: ${i}/${l} is LIVE, not deleted`); continue; }
    if (apply) {
      await db.delete(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, i), eq(placeChipOverrides.chipKey, c.chipKey)));
      await db.delete(interestChips).where(and(eq(interestChips.interestKey, i), eq(interestChips.chipKey, c.chipKey)));
    }
    d++;
  }
  for (const [i, label, how] of picks.newChips as Array<[string, string, string]>) {
    const existing = all.filter((c) => c.interestKey === i);
    if (existing.some((c) => c.label === label)) continue;
    const key = chipKeyFor(label, new Set(existing.map((c) => c.chipKey)));
    const order = existing.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1 + n;
    if (apply) await db.insert(interestChips).values({ interestKey: i, chipKey: key, label, sortOrder: order, status: 'draft', drivers: [], needsColumn: `New column: ${how || 'to be decided'}`, approvedBy: OWNER, approvedAt: new Date('2026-10-20T04:00:00Z'), updatedBy: 'Claude (owner-added chip, 20 Oct 2026)' });
    n++;
  }
  console.log(`${apply ? 'approved' : 'would approve'} ${a}, ${apply ? 'deleted' : 'would delete'} ${d}, ${apply ? 'added' : 'would add'} ${n}`);
  problems.forEach((p) => console.log('PROBLEM', p));
  process.exit(0);
})();
