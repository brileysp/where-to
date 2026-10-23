// 23 Oct 2026: re-authors every place's seasonal price swing (mild, moderate or extreme) from published evidence instead of judgment
// (owner: the crowd and price tiers looked wrong in places). Evidence per place is in scripts/data/price-swing-oct23.json (tier, basis, note;
// basis says how strong it is: rate-card, data, official, news, guide, aggregator, anecdote, or none = no figure found, tier left as it was).
// Tier rule: how much cheaper the low season is than the peak for a typical mid-range or lodge room; mild is under about 25%, moderate about
// 25 to 45%, high about 45 to 60%, extreme about 60% or more (the fourth level, high, was added the same day and the first run used extreme for 45% and up) (event spikes and closures count when they are the peak). Old values are saved to docs/backups.
// A DRY RUN unless --apply. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/set-price-swing-oct23.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'price-swing-oct23.json'), 'utf8')) as Array<{ id: string; old: string | null; new: string; basis: string }>;
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = await db.select().from(places);
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const backup: Record<string, string | null> = {};
  for (const d of data) {
    const r = rows.find((x) => x.id === d.id);
    if (!r) throw new Error(`no place ${d.id}`);
    if (r.priceSwing === d.new) continue;
    backup[d.id] = r.priceSwing ?? null;
    patches.push({ entityType: 'destination', entityId: d.id, field: 'priceSwing', value: d.new, loadedUpdatedAt: r.updatedAt.toISOString() });
  }
  console.log(patches.length, 'places change');
  if (!apply) { console.log('dry run'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'price-swing-2026-10-23-high.json'), JSON.stringify(backup, null, 1));
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
