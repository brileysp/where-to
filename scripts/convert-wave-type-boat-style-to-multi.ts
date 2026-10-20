// Surfing "Wave type" and Whale Watching "Boat style" became multi-selects (17 Oct 2026); "Several types" / "Several styles" no longer exist.
// Each stored single word becomes a one-item list (surfing: plus any other type its own break list shows). For a "mixed" surfing cell the list is read from the types written in that place's own break
// list ("Mundaka (river mouth, expert, ...)"); a boat style cannot be read from anything, so those cells are cleared and listed for the owner.
// A backup of the old values is written first.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/convert-wave-type-boat-style-to-multi.ts [--apply]
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

const ORDER = ['beach', 'point', 'reef', 'rivermouth'];
const typesInBreaks = (breaks: unknown): string[] => {
  const found = new Set<string>();
  for (const m of String(breaks ?? '').matchAll(/\((beach|point|reef|river mouth)\s*[,)]/g)) found.add(m[1] === 'river mouth' ? 'rivermouth' : m[1]);
  return ORDER.filter((t) => found.has(t));
};

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const names = new Map((await db.select({ id: places.id, name: places.name }).from(places)).map((p) => [p.id, p.name]));
  const nm = (id: string) => names.get(id) ?? id;
  const backup: Array<{ interestKey: string; placeId: string; column: string; value: unknown }> = [];

  for (const [interestKey, column] of [['surfing', 'waveType'], ['whaleWatching', 'boatStyle']] as const) {
    const rows = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, interestKey));
    let single = 0;
    const fromBreaks: string[] = [];
    const cleared: string[] = [];
    const alsoInBreaks: string[] = [];
    for (const r of rows) {
      const facts = r.facts as Record<string, unknown>;
      const v = facts[column];
      if (typeof v !== 'string') continue;
      backup.push({ interestKey, placeId: r.placeId, column, value: v });
      const next = { ...facts };
      if (v === 'mixed') {
        const derived = interestKey === 'surfing' ? typesInBreaks(facts.breaks) : [];
        if (derived.length) { next[column] = derived; fromBreaks.push(`${nm(r.placeId)}: ${derived.join(', ')}`); }
        else { delete next[column]; cleared.push(nm(r.placeId)); }
      } else {
        const extra = interestKey === 'surfing' ? typesInBreaks(facts.breaks).filter((t) => t !== v) : [];
        next[column] = interestKey === 'surfing' ? ORDER.filter((t) => t === v || extra.includes(t)) : [v];
        single++;
        if (extra.length) alsoInBreaks.push(`${nm(r.placeId)}: stored ${v}, breaks also list ${extra.join(', ')}`);
      }
      if (apply) await db.update(placeInterestFacts).set({ facts: next as never, updatedAt: new Date() }).where(and(eq(placeInterestFacts.placeId, r.placeId), eq(placeInterestFacts.interestKey, interestKey)));
    }
    console.log(`\n${interestKey} ${column}: ${apply ? 'converted' : 'would convert'} ${single} to a one-item list; ${fromBreaks.length} "mixed" filled from the break list; ${cleared.length} "mixed" cleared.`);
    if (fromBreaks.length) console.log('From breaks:\n  ' + fromBreaks.join('\n  '));
    if (cleared.length) console.log('Cleared (need an answer):\n  ' + cleared.join(', '));
    if (alsoInBreaks.length) console.log(`One stored type but the break list shows more, so the extra types were added (${alsoInBreaks.length}):\n  ` + alsoInBreaks.join('\n  '));
  }
  if (apply) { mkdirSync(join(__dirname, '..', 'docs', 'backups'), { recursive: true }); writeFileSync(join(__dirname, '..', 'docs', 'backups', 'wave-type-boat-style-before-multi-2026-10-17.json'), JSON.stringify(backup, null, 1)); }
  process.exit(0);
})();
