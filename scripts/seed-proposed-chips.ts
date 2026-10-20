// Step 1 of the chip rollout (17 Oct 2026): creates the proposed chips, as drafts, for the interests that have no chips yet. Each chip carries a
// "needs a new column" note describing the data it would run on, so it cannot go live until the column is added and the note is cleared.
// Skips any interest that already has chips, so it is safe to run twice.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-proposed-chips.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

(async () => {
  const apply = process.argv.includes('--apply');
  const proposals = JSON.parse(readFileSync(join(__dirname, 'data', 'chip-proposals-oct17.json'), 'utf8')) as Record<string, Array<{ label: string; how: string }>>;
  const { db } = await import('../src/lib/db/client');
  const { interestChips } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const { chipKeyFor, MAX_LIVE_CHIPS } = await import('../src/lib/admin/interest-pages/chips');
  let written = 0;
  for (const [interestKey, chips] of Object.entries(proposals)) {
    if (!SLIDERS.some((s) => s.key === interestKey)) throw new Error(`Unknown interest ${interestKey}`);
    if (chips.length < 2 || chips.length > MAX_LIVE_CHIPS) throw new Error(`${interestKey}: ${chips.length} chips`);
    const existing = await db.select().from(interestChips).where(eq(interestChips.interestKey, interestKey));
    if (existing.length) { console.log(`${interestKey}: already has ${existing.length} chips, skipped`); continue; }
    const taken = new Set<string>();
    const rows = chips.map((c, i) => {
      const chipKey = chipKeyFor(c.label, taken);
      taken.add(chipKey);
      return { interestKey, chipKey, label: c.label, sortOrder: i + 1, status: 'draft' as const, drivers: [], needsColumn: `New column: ${c.how || 'to be decided'}`, updatedBy: 'Claude (proposed set, 17 Oct 2026)' };
    });
    if (apply) await db.insert(interestChips).values(rows);
    written += rows.length;
    console.log(`${interestKey}: ${apply ? 'wrote' : 'would write'} ${rows.length}`);
  }
  console.log(`${apply ? 'Wrote' : 'Would write'} ${written} chips.`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
