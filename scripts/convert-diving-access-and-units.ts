// Diving cleanup (13 Oct 2026), three changes to the stored diving columns:
//  1. "How you do it" became a multi-select: each stored single word becomes a one-item list. "Mixed" said nothing, so those cells are cleared
//     and listed for the owner to fill (same as the wildlife "How you watch" conversion).
//  2. Water temperature in Celsius ("17-26 C") becomes Fahrenheit ("63-79 F"), keeping any note in brackets.
//  3. Typical depth in metres ("5-30 m") becomes feet ("15-100 ft"), rounded the way diving text is (nearest 5 ft).
// Also rewrites scripts/data/diving-fill.json the same way. A backup of every changed value is written first. Safe to re-run.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/convert-diving-access-and-units.ts [--apply]
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { convertTemperaturesToF } = await import('../src/lib/text/temperature');
  const { metersToFeet } = await import('../src/lib/text/length');
  const tempToF = (t: string) => convertTemperaturesToF(t).replace(/°F/g, ' F');
  const depthToFt = (t: string) => t.replace(/(\d+(?:\.\d+)?)(?:\s*(-|–|to)\s*(\d+(?:\.\d+)?))?\s*(?:m|metres?|meters?)\b/g, (_m, a, sep, b) => `${metersToFeet(Number(a))}${b ? `${sep === 'to' ? ' to ' : '-'}${metersToFeet(Number(b))}` : ''} ft`);
  const names = new Map((await db.select({ id: places.id, name: places.name }).from(places)).map((p) => [p.id, p.name]));
  const rows = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'diving'));
  const backup: Array<{ placeId: string; before: Record<string, unknown> }> = [];
  const mixed: string[] = [];
  let access = 0, temp = 0, depth = 0;
  for (const r of rows) {
    const f = r.facts as Record<string, unknown>;
    const next = { ...f };
    if (typeof f.accessStyle === 'string') { if (f.accessStyle === 'mixed') { delete next.accessStyle; mixed.push(names.get(r.placeId) ?? r.placeId); } else next.accessStyle = [f.accessStyle]; access++; }
    if (typeof f.waterTemp === 'string' && /\d\s?°?\s?C\b/.test(f.waterTemp)) { next.waterTemp = tempToF(f.waterTemp); temp++; }
    if (typeof f.typicalDepth === 'string' && /\d\s?(?:m|metres?|meters?)\b/.test(f.typicalDepth)) { next.typicalDepth = depthToFt(f.typicalDepth); depth++; }
    if (JSON.stringify(next) === JSON.stringify(f)) continue;
    backup.push({ placeId: r.placeId, before: f });
    if (apply) await db.update(placeInterestFacts).set({ facts: next as never, updatedAt: new Date() }).where(and(eq(placeInterestFacts.placeId, r.placeId), eq(placeInterestFacts.interestKey, 'diving')));
    if (backup.length <= 3) console.log(names.get(r.placeId), '|', f.waterTemp, '->', next.waterTemp, '|', f.typicalDepth, '->', next.typicalDepth);
  }
  // The seed file used by build-diving-facts.ts.
  const fillPath = join(__dirname, 'data', 'diving-fill.json');
  const fill = JSON.parse(readFileSync(fillPath, 'utf8')) as Record<string, Record<string, unknown>>;
  let fillChanged = 0;
  for (const v of Object.values(fill)) {
    if (typeof v.waterTemp === 'string' && /\d\s?°?\s?C\b/.test(v.waterTemp)) { v.waterTemp = tempToF(v.waterTemp); fillChanged++; }
    if (typeof v.typicalDepth === 'string' && /\d\s?(?:m|metres?|meters?)\b/.test(v.typicalDepth)) { v.typicalDepth = depthToFt(v.typicalDepth); fillChanged++; }
    if (typeof v.accessStyle === 'string') { if (v.accessStyle === 'mixed') delete v.accessStyle; else v.accessStyle = [v.accessStyle]; fillChanged++; }
  }
  if (apply) {
    mkdirSync(join(__dirname, '..', 'docs', 'backups'), { recursive: true });
    writeFileSync(join(__dirname, '..', 'docs', 'backups', 'diving-facts-before-units-and-access-2026-10-13.json'), JSON.stringify(backup, null, 1));
    writeFileSync(fillPath, JSON.stringify(fill, null, 1));
  }
  console.log(`${apply ? 'changed' : 'would change'} ${backup.length} places: access ${access} (${mixed.length} "mixed" cleared), temperature ${temp}, depth ${depth}; seed file fields ${fillChanged}.\nMixed cleared: ${mixed.join(', ')}`);
  process.exit(0);
})();
