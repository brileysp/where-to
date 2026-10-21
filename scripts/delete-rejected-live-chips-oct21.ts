// 21 Oct 2026: the owner confirmed six LIVE chips they had rejected on the proposals page should be deleted.
// Also removes any numbers set by hand for them and any question links (a question left with no chip would become "asked of everyone", so such a
// question loses its approval, the same as the admin's own delete does).
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/delete-rejected-live-chips-oct21.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const TARGETS: Array<[string, string]> = [['wildlifeViewing', 'Large herbivores'], ['safari', 'Big cats'], ['whaleWatching', 'Swim with whales'], ['surfing', 'Learn to surf'], ['diving', 'Big animals'], ['diving', 'Caves and cenotes']];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips, interestQuestionChips, interestQuestions, placeChipOverrides } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const found: Array<{ interestKey: string; chipKey: string; label: string; status: string; overrides: number; links: string[] }> = [];
  for (const [ik, label] of TARGETS) {
    const rows = (await db.select().from(interestChips).where(eq(interestChips.interestKey, ik))).filter((c) => c.label.toLowerCase() === label.toLowerCase());
    if (rows.length !== 1) throw new Error(`Expected one chip "${label}" in ${ik}, found ${rows.length}`);
    const c = rows[0];
    const overrides = await db.select().from(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, ik), eq(placeChipOverrides.chipKey, c.chipKey)));
    const links = await db.select().from(interestQuestionChips).where(and(eq(interestQuestionChips.interestKey, ik), eq(interestQuestionChips.chipKey, c.chipKey)));
    found.push({ interestKey: ik, chipKey: c.chipKey, label: c.label, status: c.status, overrides: overrides.length, links: links.map((l) => l.questionKey) });
  }
  for (const f of found) console.log(`${f.interestKey}: ${f.label} [${f.status}] hand-set numbers ${f.overrides}, opens questions ${f.links.join(',') || 'none'}`);
  if (!apply) { console.log('dry run: pass --apply to write'); process.exit(0); }
  await db.transaction(async (tx) => {
    for (const f of found) {
      for (const q of f.links) {
        await tx.delete(interestQuestionChips).where(and(eq(interestQuestionChips.interestKey, f.interestKey), eq(interestQuestionChips.questionKey, q), eq(interestQuestionChips.chipKey, f.chipKey)));
        await tx.update(interestQuestions).set({ approvedBy: '', approvedAt: null, updatedAt: new Date() }).where(and(eq(interestQuestions.interestKey, f.interestKey), eq(interestQuestions.questionKey, q)));
      }
      await tx.delete(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, f.interestKey), eq(placeChipOverrides.chipKey, f.chipKey)));
      await tx.delete(interestChips).where(and(eq(interestChips.interestKey, f.interestKey), eq(interestChips.chipKey, f.chipKey)));
    }
  });
  console.log('deleted', found.length, 'chips');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
