// Snorkeling & diving "What the draw is" became a multi-select (17 Oct 2026) so a place can be several things at once (reef and wrecks, say).
// "Several equally" no longer exists and cannot be guessed, so those cells are cleared and listed for the owner. Every other stored word
// becomes a one-item list. A backup of the old values is written first.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/convert-diving-draw-type-to-multi.ts [--apply]
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const names = new Map((await db.select({ id: places.id, name: places.name }).from(places)).map((p) => [p.id, p.name]));
  const rows = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'diving'));
  const backup: Array<{ placeId: string; drawType: unknown }> = [];
  const mixed: string[] = [];
  let converted = 0;
  for (const r of rows) {
    const facts = r.facts as Record<string, unknown>;
    const v = facts.drawType;
    if (typeof v !== 'string') continue;
    backup.push({ placeId: r.placeId, drawType: v });
    const next = { ...facts };
    if (v === 'mixed') { delete next.drawType; mixed.push(names.get(r.placeId) ?? r.placeId); }
    else { next.drawType = [v]; converted++; }
    if (apply) await db.update(placeInterestFacts).set({ facts: next as never, updatedAt: new Date() }).where(and(eq(placeInterestFacts.placeId, r.placeId), eq(placeInterestFacts.interestKey, 'diving')));
  }
  if (apply) { mkdirSync(join(__dirname, '..', 'docs', 'backups'), { recursive: true }); writeFileSync(join(__dirname, '..', 'docs', 'backups', 'diving-draw-type-before-multi-2026-10-17.json'), JSON.stringify(backup, null, 1)); }
  console.log(`${apply ? 'converted' : 'would convert'} ${converted} to a one-item list; ${mixed.length} "several equally" cleared:\n${mixed.join(', ')}`);
  process.exit(0);
})();
