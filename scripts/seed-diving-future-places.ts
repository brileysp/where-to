/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/seed-diving-future-places.ts [--apply]
// Adds the diving future places (scripts/data/diving-future-places.json: the diving list from the old Catalog Wishlist plus new ones),
// skipping names already on the diving list, then makes every same-name place carry an "Also on the X list (same name)" note on both lists.
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const LIST: Record<string, string> = { birding: 'birding', wildlifeViewing: 'wildlife-viewing', whaleWatching: 'whale-watching', safari: 'safari', diving: 'diving' };
const norm = (s: string) => s.toLowerCase().replace(/[’‘ʻ`]/g, "'");
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestPlaceIdeas } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const data = JSON.parse(readFileSync('scripts/data/diving-future-places.json', 'utf8')) as Array<{ name: string; region: string; why: string; nearestExisting: string; placeType: string }>;
  let all = await db.select().from(interestPlaceIdeas);
  const haveDiving = new Set(all.filter((i) => i.interestKey === 'diving').map((i) => norm(i.name)));
  let added = 0;
  for (const d of data) {
    if (haveDiving.has(norm(d.name))) continue;
    // Use the exact spelling of the name already on another list.
    const other = all.find((i) => i.interestKey !== 'diving' && norm(i.name) === norm(d.name));
    const values = { interestKey: 'diving', name: other?.name ?? d.name, region: d.region, why: d.why, nearestExisting: d.nearestExisting, placeType: d.placeType, stage: 'idea' as const };
    added++;
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: 'diving:new', action: 'create', before: null, after: values, write: (tx) => tx.insert(interestPlaceIdeas).values(values).returning() });
  }
  if (apply) all = await db.select().from(interestPlaceIdeas);
  // Cross-references, both ways.
  let notes = 0;
  const fix = (why: string, listKey: string, mark: boolean) => {
    let w = why.replace(/ and on the diving list in the old Catalog Wishlist \(not yet imported\)/, ' and on the diving list (same name)').replace(/↳ Also on the diving list in the old Catalog Wishlist \(not yet imported\)\./, '↳ Also on the diving list (same name).');
    if (!w.includes(`${LIST[listKey]} list`) && mark) w = `${w}${w.includes('↳') ? ' Also' : ' ↳ Also'} on the ${LIST[listKey]} list (same name).`.replace(' Also Also', ' Also');
    return w;
  };
  const byName = new Map<string, any[]>();
  for (const i of all) byName.set(norm(i.name), [...(byName.get(norm(i.name)) ?? []), i]);
  for (const group of byName.values()) {
    if (group.length < 2 || !group.some((g) => g.interestKey === 'diving')) continue;
    for (const g of group) {
      let w = g.why as string;
      for (const o of group) if (o.interestKey !== g.interestKey) w = fix(w, o.interestKey, true);
      w = fix(w, 'diving', false);
      if (w !== g.why) {
        notes++;
        if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: g.id, action: 'update', before: g, after: { ...g, why: w }, write: (tx) => tx.update(interestPlaceIdeas).set({ why: w, updatedAt: new Date() }).where(eq(interestPlaceIdeas.id, g.id)).returning() });
      }
    }
  }
  console.log(`${apply ? 'added' : 'would add'} ${added} diving future places; ${apply ? 'updated' : 'would update'} ${notes} cross-reference notes`);
  process.exit(0);
})();
