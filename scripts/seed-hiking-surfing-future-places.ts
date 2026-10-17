/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/seed-hiking-surfing-future-places.ts [--apply]
// Adds the hiking (30) and surfing (15) future places from scripts/data/{hiking,surfing}-future-places.json (15 Oct 2026), skipping names already on
// the same list, and adds a "↳ Also on the X list (same name)" note to every entry that shares a name across lists.
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const LIST: Record<string, string> = { birding: 'birding', wildlifeViewing: 'wildlife-viewing', whaleWatching: 'whale-watching', safari: 'safari', diving: 'diving', hiking: 'hiking', surfing: 'surfing' };
const norm = (s: string) => s.toLowerCase().replace(/[’‘ʻ`]/g, "'");
type Item = { name: string; region: string; why: string; nearestExisting: string; placeType: string; grain: number; grainNote: string; sortOrder: number };
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestPlaceIdeas } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  let all = await db.select().from(interestPlaceIdeas);
  let added = 0;
  for (const key of ['hiking', 'surfing']) {
    const data = JSON.parse(readFileSync(`scripts/data/${key}-future-places.json`, 'utf8')) as Item[];
    const have = new Set(all.filter((i) => i.interestKey === key).map((i) => norm(i.name)));
    for (const d of data) {
      if (have.has(norm(d.name))) continue;
      const other = all.find((i) => i.interestKey !== key && norm(i.name) === norm(d.name));
      const values = { interestKey: key, name: other?.name ?? d.name, region: d.region, why: d.why, nearestExisting: d.nearestExisting, placeType: d.placeType, stage: 'idea' as const, grain: d.grain, grainNote: d.grainNote, sortOrder: d.sortOrder };
      added++;
      if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: `${key}:new`, action: 'create', before: null, after: values, write: (tx: any) => tx.insert(interestPlaceIdeas).values(values).returning() });
    }
  }
  if (apply) all = await db.select().from(interestPlaceIdeas);
  // Cross-reference notes, both ways, only for groups that include a hiking or surfing entry.
  const byName = new Map<string, any[]>();
  for (const i of all) byName.set(norm(i.name), [...(byName.get(norm(i.name)) ?? []), i]);
  let notes = 0;
  for (const group of byName.values()) {
    if (group.length < 2 || !group.some((g) => g.interestKey === 'hiking' || g.interestKey === 'surfing')) continue;
    for (const g of group) {
      let w = g.why as string;
      for (const o of group) {
        if (o.interestKey === g.interestKey) continue;
        const label = `${LIST[o.interestKey]} list`;
        if (!w.includes(label)) w = `${w}${w.includes('↳') ? ' Also' : ' ↳ Also'} on the ${label} (same name).`.replace(' Also Also', ' Also');
      }
      if (w !== g.why) {
        notes++;
        if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: g.id, action: 'update', before: g, after: { ...g, why: w }, write: (tx: any) => tx.update(interestPlaceIdeas).set({ why: w, updatedAt: new Date() }).where(eq(interestPlaceIdeas.id, g.id)).returning() });
      }
    }
  }
  console.log(`${apply ? 'added' : 'would add'} ${added} future places; ${apply ? 'updated' : 'would update'} ${notes} cross-reference notes`);
  process.exit(0);
})();
