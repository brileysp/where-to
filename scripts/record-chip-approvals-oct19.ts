// Records chip approvals (19 Oct 2026) and deletes the chips the owner turned down. Safe to run twice.
//  - 18 chips approved in chat on 19 Oct 2026 (camping, geology, skiing, wind sports, kayaking)
//  - 26 pilot chips approved on 17 Oct 2026 (the six pilot interests), recorded late
//  - chips already live before approvals existed are marked approved (they were live by the owner's choice)
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/record-chip-approvals-oct19.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}
const OWNER = 'brileysp@gmail.com';
const REJECTED: Record<string, string[]> = {
  campingBackcountry: ['remote-wilderness'], geologyVolcanoes: ['volcano-hikes'],
  skiingSnowboarding: ['learn-to-ski', 'ski-villages-and-apr-s-ski'], windSports: ['flat-water-lagoons'],
};
const APPROVED_19: string[] = ['campingBackcountry', 'geologyVolcanoes', 'skiingSnowboarding', 'windSports', 'kayakingRafting'];
const PILOT_17 = ['fineDining', 'coffeeTea', 'streetFood', 'shopping', 'nightlife', 'traditionalCrafts'];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips, placeChipOverrides } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const rows = await db.select().from(interestChips);
  let approved = 0, deleted = 0;
  for (const r of rows) {
    if (REJECTED[r.interestKey]?.includes(r.chipKey)) {
      console.log('delete', r.interestKey, r.chipKey);
      if (apply) {
        await db.delete(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, r.interestKey), eq(placeChipOverrides.chipKey, r.chipKey)));
        await db.delete(interestChips).where(and(eq(interestChips.interestKey, r.interestKey), eq(interestChips.chipKey, r.chipKey)));
      }
      deleted++; continue;
    }
    if (r.approvedAt) continue;
    let at: Date | null = null, by = '';
    if (APPROVED_19.includes(r.interestKey)) { at = new Date('2026-10-19T12:00:00Z'); by = `${OWNER} (said yes in chat, 19 Oct 2026; recorded by Claude)`; }
    else if (PILOT_17.includes(r.interestKey)) { at = new Date('2026-10-17T12:00:00Z'); by = `${OWNER} (said yes in chat, 17 Oct 2026; recorded by Claude on 19 Oct)`; }
    else if (r.status === 'live') { at = new Date('2026-10-17T12:00:00Z'); by = `${OWNER} (live before approvals were tracked; recorded by Claude on 19 Oct)`; }
    if (!at) continue;
    if (apply) await db.update(interestChips).set({ approvedAt: at, approvedBy: by }).where(and(eq(interestChips.interestKey, r.interestKey), eq(interestChips.chipKey, r.chipKey)));
    approved++;
  }
  console.log(`${apply ? 'approved' : 'would approve'} ${approved}, ${apply ? 'deleted' : 'would delete'} ${deleted}`);
  process.exit(0);
})();
