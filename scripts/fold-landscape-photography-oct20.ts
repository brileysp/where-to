// 20 Oct 2026 (owner decisions in chat): fold Landscape Photography into Scenic Landscapes, and rename Wildflowers & Seasonal Blooms to
// "Blooms and Fall Colors". Database side only; the code side (hidden interest, new label) is in src/lib/scoring/constants.ts.
//   - Retire the five draft Landscape Photography chips (none was approved, none opens a question).
//   - Add the "Landscape photography" chip to Scenic Landscapes and the "Fall foliage" chip to Blooms and Fall Colors, as approved drafts that wait on a column.
//   - Change the Blooms pill name to "Blooms & Colors".
//   - Add to-dos for the Scenic and Blooms authoring so the new scope is not forgotten.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fold-landscape-photography-oct20.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const OWNER = 'brileysp@gmail.com (said yes in chat, 20 Oct 2026; recorded by Claude)';
const SRC = 'Chat, 20 Oct 2026 (folds)';

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips, interestQuestionChips, placeChipOverrides, interestMeta, interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');

  const old = await db.select().from(interestChips).where(eq(interestChips.interestKey, 'landscapePhotography'));
  const ties = await db.select().from(interestQuestionChips).where(eq(interestQuestionChips.interestKey, 'landscapePhotography'));
  const overrides = await db.select().from(placeChipOverrides).where(eq(placeChipOverrides.interestKey, 'landscapePhotography'));
  if (ties.length || overrides.length || old.some((c) => c.status === 'live' || c.approvedAt)) throw new Error('A Landscape Photography chip is live, approved, tied to a question or has hand-set numbers: stop and look.');
  const scenic = await db.select().from(interestChips).where(eq(interestChips.interestKey, 'scenicLandscapes'));
  const blooms = await db.select().from(interestChips).where(eq(interestChips.interestKey, 'wildflowerBlooms'));
  console.log(`retire ${old.length} Landscape Photography chips; Scenic has ${scenic.length} chips, Blooms has ${blooms.length}`);
  const has = (rows: typeof scenic, key: string) => rows.some((c) => c.chipKey === key);

  const plan = [
    { interestKey: 'scenicLandscapes', chipKey: 'landscape-photography', label: 'Landscape photography', sortOrder: Math.max(0, ...scenic.map((c) => c.sortOrder)) + 1, needsColumn: 'Uses the existing Landscape Photography place scores (174 places, kept as hidden data and capped at each place\'s Scenic peak). Needs a column, or a way for a chip to read a place score, before it can go live.' },
    { interestKey: 'wildflowerBlooms', chipKey: 'fall-foliage', label: 'Fall foliage', sortOrder: Math.max(0, ...blooms.map((c) => c.sortOrder)) + 1, needsColumn: 'New column: foliage peak months for each place (a timed event, like the bloom events) and how reliable the timing is. Places to sweep: New England, eastern Canada, Japan, Korea, Alps and Dolomites larches, Patagonia in autumn, Tasmania.' },
  ].filter((c) => !has(c.interestKey === 'scenicLandscapes' ? scenic : blooms, c.chipKey));
  console.log('add chips:', plan.map((c) => `${c.interestKey}:${c.label}`).join(', ') || 'none (already there)');

  const todos = [
    { interestKey: 'scenicLandscapes', title: 'Scenic Landscapes authoring covers photography too', detail: 'Landscape Photography was folded into Scenic Landscapes on 20 Oct 2026 (one "Landscape photography" chip). The Scenic brief and Gemini directive should mention photographic subjects (famous viewpoints, golden-hour and alpenglow spots) so the chip has facts behind it, without a separate photography blurb. The 174 Landscape Photography place scores stay as hidden data and feed the chip.', status: 'idea' as const },
    { interestKey: 'scenicLandscapes', title: 'Photography follow-up questions open on the Landscape photography chip', detail: 'How far will you go for the shot? What gear will you carry? Do you want a photo guide or workshop? Approve them on the Chips and Questions page, then link them to the chip (Only when the traveler ticks one of these chips).', status: 'needs_you' as const },
    { interestKey: 'wildflowerBlooms', title: 'Add fall foliage to Blooms and Fall Colors', detail: 'Renamed from Wildflowers & Seasonal Blooms on 20 Oct 2026. Sweep all 200 places for notable fall color; each gets a timed "Fall foliage" event (peak months, reliability). Also rescore the thin existing bloom scores (only 40 places are scored; many are a generic "Bloom season" at 2). Add foliage reference places to the anchors, recheck the thresholds, and make the Gemini brief and place scope sheets cover both flowers and foliage.', status: 'ready_for_claude' as const },
  ];

  if (!apply) { console.log('dry run: pass --apply to write'); process.exit(0); }
  await db.transaction(async (tx) => {
    await tx.delete(interestChips).where(eq(interestChips.interestKey, 'landscapePhotography'));
    for (const c of plan) await tx.insert(interestChips).values({ interestKey: c.interestKey, chipKey: c.chipKey, label: c.label, sortOrder: c.sortOrder, status: 'draft', drivers: [], needsColumn: c.needsColumn, approvedBy: OWNER, approvedAt: new Date('2026-10-20T12:00:00Z'), updatedBy: 'Claude (fold, 20 Oct 2026)' });
    await tx.update(interestMeta).set({ shortName: 'Blooms & Colors', updatedAt: new Date() }).where(eq(interestMeta.key, 'wildflowerBlooms'));
    await tx.insert(interestTodos).values(todos.map((t) => ({ interestKey: t.interestKey, title: t.title, detail: t.detail, status: t.status, source: SRC, priority: 2 })));
  });
  const after = await db.select().from(interestChips).where(and(eq(interestChips.interestKey, 'scenicLandscapes')));
  console.log('done; Scenic chips now:', after.map((c) => c.label).join(', '));
  process.exit(0);
})();
